import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, accessSync, constants, statSync, symlinkSync, lstatSync } from 'fs';
import { copyFile, readdir, readFile, writeFile, rm, cp, mkdtemp } from 'fs/promises';
import { resolve, join, basename, delimiter, relative } from 'path';
import { spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { VybesScoringEngine, VybesResult, VybesTaskConfig, CommandSummary } from './vybes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface EnvArgConfig {
  env: string;
  required?: boolean;
  default?: string;
  sensitive?: boolean;
}

interface PromptArgConfig {
  prompt: true;
}

type ArgValue = string | EnvArgConfig | PromptArgConfig;

interface Configuration {
  cli: string;
  name: string;
  description?: string;
  args: ArgValue[];
  timeout: number;
  promptPrefix?: string;
}

const SENSITIVE_FLAGS = new Set(['--key', '--keyfile', '--auth-key', '--auth-keyfile']);
const SENSITIVE_VALUE_SUBSTRINGS = ['key=', 'token=', 'secret=', 'authorization='];
const MIN_AGENT_TIMEOUT_MS = 15 * 60 * 1000;

function isExecutable(filePath: string): boolean {
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      return false;
    }
    if (process.platform !== 'win32') {
      accessSync(filePath, constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

function findExecutable(command: string): string | null {
  if (!command) {
    return null;
  }

  if (command.includes('/') || command.includes('\\')) {
    return isExecutable(command) ? command : null;
  }

  const pathEnv = process.env.PATH || '';
  for (const segment of pathEnv.split(delimiter)) {
    if (!segment) {
      continue;
    }
    const candidate = join(segment, command);
    if (isExecutable(candidate)) {
      return candidate;
    }

    if (process.platform === 'win32') {
      const extensions = ['.exe', '.cmd', '.bat', '.ps1'];
      for (const ext of extensions) {
        const winCandidate = candidate + ext;
        if (isExecutable(winCandidate)) {
          return winCandidate;
        }
      }
    }
  }

  return null;
}

function resolveCliCommand(cli: string): string {
  const candidates: (string | undefined)[] = [];

  if (cli === 'llxprt') {
    candidates.push(process.env.LLXPRT_PATH, process.env.LLXPRT_BIN);
  }

  if (cli.startsWith('/')) {
    candidates.push(cli);
  } else {
    candidates.push(join(__dirname, '..', cli));
  }

  const pathResolved = findExecutable(cli);
  if (pathResolved) {
    candidates.push(pathResolved);
  }

  for (const candidate of candidates) {
    if (candidate && isExecutable(candidate)) {
      return candidate;
    }
  }

  return candidates.find(Boolean) || cli;
}

interface CommandDefinition {
  command: string;
  args: string[];
  timeout: number;
}

interface StepResult {
  label: string;
  stdout: string;
  stderr: string;
  success: boolean;
  exitCode: number;
  command: string;
  durationMs: number;
}

interface RunCommandSummary {
  command: string;
  exitCode: number;
  durationMs: number;
}

interface EvaluationConfig {
  workspace: string;
  grading: string;
  prompt: string;
}

async function resolveArgumentValue(
  value: ArgValue,
  env: { [key: string]: string | undefined }
): Promise<string> {
  if (typeof value === 'string') {
    return value;
  }

  if ('prompt' in value) {
    // In production, this would prompt the user
    // For now, we'll throw an error
    throw new Error('Prompt arguments are not supported in CI mode');
  }

  if ('env' in value) {
    const envValue = env[value.env] || value.default;
    if (!envValue && value.required) {
      throw new Error(`Required environment variable ${value.env} is not set`);
    }
    return envValue || '';
  }

  throw new Error(`Invalid argument configuration: ${JSON.stringify(value)}`);
}

function maskSensitiveValues(command: CommandDefinition): CommandDefinition {
  const maskedArgs = command.args.map(arg => {
    // Check if this argument is a sensitive flag
    const isSensitiveFlag = SENSITIVE_FLAGS.has(arg);
    if (!isSensitiveFlag) {
      return arg;
    }

    // Find the next argument (the value) and mask it
    const index = command.args.indexOf(arg);
    if (index >= 0 && index + 1 < command.args.length) {
      return arg;
    }
    return arg;
  }).map((arg, index) => {
    // Check if this argument value contains sensitive information
    if (SENSITIVE_VALUE_SUBSTRINGS.some(substr => arg.toLowerCase().includes(substr))) {
      return '[MASKED]';
    }

    // Check if this is a value following a sensitive flag
    if (index > 0 && SENSITIVE_FLAGS.has(command.args[index - 1])) {
      return '[MASKED]';
    }

    return arg;
  });

  return {
    command: command.command,
    args: maskedArgs,
    timeout: command.timeout
  };
}

class ConfigurationManager {
  private configs: Map<string, Configuration> = new Map();

  constructor() {
    try {
      // Use multiple fallback paths for config file
      const possiblePaths = [
        join(__dirname, 'config', 'cli-config.json'),
        join(__dirname, '..', 'config', 'cli-config.json'),
        resolve(__dirname, '..', '..', 'config', 'cli-config.json'),
        resolve(__dirname, '..', '..', '..', 'evals', 'config', 'cli-config.json'),
      ];
      
      let configPath = '';
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          configPath = path;
          break;
        }
      }
      
      if (!configPath) {
        console.error(`Config file not found at: ${configPath}`);
        console.error('File exists check:', existsSync(configPath));
        throw new Error(`Config file not found: ${configPath}`);
      }
      
      const configData = JSON.parse(readFileSync(configPath, 'utf8'));
      
      // The config file has a structure where configurations are nested under a "configurations" key
      if (configData.configurations) {
        console.log(`Loaded ${Object.keys(configData.configurations).length} configurations from ${configPath}`);
        console.log('Available configurations:', Object.keys(configData.configurations));
        
        for (const [id, config] of Object.entries(configData.configurations)) {
          this.configs.set(id, config as Configuration);
        }
      } else {
        console.log(`Loaded ${Object.keys(configData).length} configurations from ${configPath}`);
        console.log('Available configurations:', Object.keys(configData));
        
        for (const [id, config] of Object.entries(configData)) {
          this.configs.set(id, config as Configuration);
        }
      }
      
    } catch (error) {
      console.error('Failed to load configurations:', error);
      // Don't throw, just continue with empty configurations
    }
  }

  getConfig(id: string): Configuration | undefined {
    return this.configs.get(id);
  }

  getAllConfigurations(): string[] {
    return Array.from(this.configs.keys());
  }

  getDefaultConfigurations(): string[] {
    // Return configurations that should run by default
    return this.getAllConfigurations().filter(id => 
      // Filter out configurations that are specific to certain providers
      !id.includes('codepuppy')
    );
  }
}

class EvaluationLoader {
  private evalsPath: string;

  constructor() {
    // Use multiple fallback paths for problems directory
    const possiblePaths = [
      join(__dirname, '..', '..', 'problems'),
      join(__dirname, '..', 'problems'),
      resolve(__dirname, '..', '..', '..', 'problems'),
      resolve(__dirname, '..', '..', '..', 'evals', 'problems'),
    ];
    
    let foundPath = '';
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        foundPath = path;
        break;
      }
    }
    
    if (foundPath) {
      this.evalsPath = foundPath;
    } else {
      // Fallback to hardcoded path if none found
      this.evalsPath = join(__dirname, '..', '..', 'problems');
    }
  }

  getAllEvaluations(): string[] {
    if (!existsSync(this.evalsPath)) {
      return [];
    }

    return readdirSync(this.evalsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }

  getEvaluationConfig(evalName: string): EvaluationConfig | null {
    const evalPath = join(this.evalsPath, evalName);
    if (!existsSync(evalPath)) {
      return null;
    }

    // Look for problem.md in the workspace subdirectory
    const workspacePath = join(evalPath, 'workspace');
    const promptPath = existsSync(join(workspacePath, 'problem.md')) 
      ? join(workspacePath, 'problem.md')
      : join(evalPath, 'problem.md');

    return {
      workspace: existsSync(workspacePath) ? workspacePath : evalPath,
      grading: join(__dirname, '..', 'grading', evalName),
      prompt: promptPath
    };
  }
}

interface PassExecutionRecord {
  passNumber: number;
  duration: number;
  success: boolean;
  workspaceArchive?: string;
  resultsArchive?: string;
  appliedFeedback?: string[];
  publicTestFailures?: string[];
  hiddenTestFailures?: string[];
  vybes?: VybesResult | null;
  cliDurationMs?: number;
  cliExitCode?: number;
  cliCommand?: string;
  partialSuccess?: boolean;
}

interface EvaluationRecord {
  evalName: string;
  configId: string;
  success: boolean;
  totalDuration: number;
  passes: PassExecutionRecord[];
}

interface EvaluationArchiveRecord {
  evalName: string;
  configId: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  repoVersion: string;
  runSessionId?: string;
  runSessionStartedAt?: string;
  commands: RunCommandSummary[];
  multipass?: Record<string, any>;
  passes: PassExecutionRecord[];
  vybes?: VybesResult | null;
  workspaceArchive?: string | null;
  resultsArchive?: string | null;
  remediationNotes?: string[];
  overallSuccess: boolean;
}

class UnifiedRunner {
  private maxPasses: number;
  private multipassEnabled: boolean;
  private repoRoot: string;
  private vybesEngine: VybesScoringEngine;
  private repoVersion: string;
  private runSessionId: string;
  private runSessionStartedAt: string;

  constructor(options: { maxPasses?: number; multipassEnabled?: boolean } = {}) {
    this.repoRoot = resolve(__dirname, '..', '..');
    this.maxPasses = options.maxPasses || 3;
    this.multipassEnabled = options.multipassEnabled !== false;
    this.vybesEngine = new VybesScoringEngine();
    this.repoVersion = this.detectRepoVersion();
    this.runSessionId = uuidv4();
    this.runSessionStartedAt = new Date().toISOString();
  }

  private detectRepoVersion(): string {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.repoRoot,
        stdio: ['ignore', 'pipe', 'ignore']
      })
        .toString()
        .trim();
    } catch {
      return 'unknown';
    }
  }

  getMaxPasses(): number {
    return this.maxPasses;
  }

  isMultipassEnabled(): boolean {
    return this.multipassEnabled;
  }

  async runSingleEvaluation(
    evalName: string, 
    configId: string
  ): Promise<EvaluationRecord> {
    const startTime = Date.now();
    const passes: PassExecutionRecord[] = [];
    let finalSuccess = false;

    console.log(` STARTED: ${evalName} + ${configId}`);

    const configManager = new ConfigurationManager();
    const config = configManager.getConfig(configId);
    if (!config) {
      throw new Error(`Unknown configuration: ${configId}`);
    }

    const evalLoader = new EvaluationLoader();
    const evalConfig = evalLoader.getEvaluationConfig(evalName);
    if (!evalConfig) {
      throw new Error(`Unknown evaluation: ${evalName}`);
    }

    const basePromptContent = readFileSync(evalConfig.prompt, 'utf8');
    const runStartTime = new Date();
    const uniqueId = uuidv4();
    const runId = `${evalName}-${runStartTime.toISOString().replace(/[:.]/g, '-')}-${uniqueId}`;
    const workdir = join(this.repoRoot, 'evals', 'outputs', runId);
    mkdirSync(workdir, { recursive: true });

    const remediationNotes: string[] = [];
    const commandHistory: RunCommandSummary[] = [];
    const addRemediationNotes = (passNumber: number, notes: string[]) => {
      if (!notes || notes.length === 0) {
        return;
      }
      const filtered = notes
        .map(note => note?.trim())
        .filter((note): note is string => Boolean(note && note.length > 0));
      if (filtered.length === 0) {
        return;
      }
      for (const note of filtered) {
        remediationNotes.push(`Pass ${passNumber}: ${note}`);
      }
      const MAX_NOTES = 10;
      if (remediationNotes.length > MAX_NOTES) {
        remediationNotes.splice(0, remediationNotes.length - MAX_NOTES);
      }
    };

    try {
      for (let pass = 1; pass <= this.maxPasses; pass++) {
        const passStartTime = Date.now();
        
        console.log(`   Pass ${pass}/${this.maxPasses} – remediation bullets: ${pass - 1}`);
        console.log(`     Workspace: ${workdir}`);

        // Copy evaluation files
        await this.setupWorkspace(evalConfig.workspace, workdir);

        // Apply remediation bullet points from previous pass if available
        if (pass > 1 && passes.length > 0) {
          await this.applyRemediation(passes[passes.length - 1].workspaceArchive || '', workdir);
        }

        // Build prompt with remediation context if available
        const remediationContext = remediationNotes.length > 0
          ? `\n\n## Previous Attempt Feedback\nYou previously attempted this task. Address each item before finishing:\n${remediationNotes.map(note => `- ${note}`).join('\n')}\n\nAlways rerun the requested npm commands (typecheck, lint, test:public, start) before exiting.\n`
          : '';
        const promptContent = `${basePromptContent}${remediationContext}`;

        // Execute CLI tool
        const executionResult = await this.executeCliWithTimeout(
          config,
          promptContent,
          workdir
        );
        const cliSummary = {
          command: executionResult.commandString,
          exitCode: executionResult.exitCode,
          durationMs: executionResult.durationMs
        };
        commandHistory.push(cliSummary);

        // Check for quick exit with no changes (failsafe)
        const executionDurationSec = executionResult.durationMs / 1000;
        const outputLength = (executionResult.stdout + executionResult.stderr).length;
        
        if (executionDurationSec < 15 && outputLength < 500) {
          console.log(`     WARNING:  WARNING: CLI exited very quickly (${executionDurationSec.toFixed(1)}s) with minimal output (${outputLength} chars)`);
          console.log(`     This likely indicates a model misconfiguration or CLI error.`);
          console.log(`     --- CLI STDOUT ---`);
          console.log(executionResult.stdout || '(empty)');
          console.log(`     --- CLI STDERR ---`);
          console.log(executionResult.stderr || '(empty)');
          console.log(`     --- EXIT CODE ---`);
          console.log(executionResult.exitCode);
          
          await this.archiveGradingResults(workdir, [], executionResult);
          const earlyWorkspaceArchive = await this.archiveWorkspace(workdir, pass);
          const earlyResultsArchive = join(earlyWorkspaceArchive, '.eval-outputs');
          const earlySavedOutputs = earlyResultsArchive;
          if (existsSync(earlySavedOutputs)) {
            console.log(`  → Archived CLI/build/grade outputs to ${earlySavedOutputs}`);
          }

          const quickNotes = this.buildQuickExitNotes(executionResult, executionDurationSec, outputLength);
          addRemediationNotes(pass, quickNotes);

          passes.push({
            passNumber: pass,
            duration: Date.now() - passStartTime,
            success: false,
            workspaceArchive: earlyWorkspaceArchive,
            resultsArchive: earlyResultsArchive,
            appliedFeedback: quickNotes,
            publicTestFailures: [],
            hiddenTestFailures: [],
            vybes: null,
            cliDurationMs: cliSummary.durationMs,
            cliExitCode: cliSummary.exitCode,
            cliCommand: cliSummary.command
          });
          
          if (pass === 1) {
            console.log(`     Stopping multi-pass attempts - please fix the configuration`);
            break;
          }

          continue;
        }

        // Run grading
        const gradeResults = await this.runGrading(evalConfig.grading, workdir, config.args);

        // Save artifacts including llxprt output
        await this.archiveGradingResults(workdir, gradeResults, executionResult);
        const workspaceArchive = await this.archiveWorkspace(workdir, pass);
        const resultsArchive = join(workspaceArchive, '.eval-outputs');
        if (existsSync(resultsArchive)) {
          console.log(`  → Archived CLI/build/grade outputs to ${resultsArchive}`);
        }

        const harnessIssue = this.detectHarnessIssue(gradeResults);
        const failureNotes = harnessIssue ? [] : this.buildFailureNotes(gradeResults, executionResult);
        if (failureNotes.length > 0) {
          addRemediationNotes(pass, failureNotes);
        }

        const passDuration = Date.now() - passStartTime;
        const passed = gradeResults.every(result => result.success === true);
        const { publicFailures, hiddenFailures } = this.collectTestFailures(gradeResults);
        const workspaceSteps = gradeResults.filter(result => result.label.startsWith('workspace-'));
        const gradingSteps = gradeResults.filter(result => result.label.startsWith('grading-'));
        let vybesResult: VybesResult | null = null;

        try {
          if (workspaceArchive && existsSync(workspaceArchive)) {
            vybesResult = this.vybesEngine.calculate({
              evalName,
              configId,
              archivePath: workspaceArchive,
              cliResult: {
                command: cliSummary.command,
                exitCode: cliSummary.exitCode,
                duration: cliSummary.durationMs
              },
              buildResults: this.mapCommandSummaries(workspaceSteps),
              gradeResults: this.mapCommandSummaries(gradingSteps),
              overallSuccess: passed,
              totalCliDuration: cliSummary.durationMs,
              passCount: pass,
              selectedPassIndex: pass - 1
            });
          }
        } catch (error) {
          console.warn(`     Warning: failed to calculate Vybes score for ${evalName} (${configId}) pass ${pass}:`, error);
        }

        passes.push({
          passNumber: pass,
          duration: passDuration,
          success: passed,
          workspaceArchive,
          resultsArchive,
          appliedFeedback: failureNotes,
          publicTestFailures: publicFailures,
          hiddenTestFailures: hiddenFailures,
          vybes: vybesResult,
          cliDurationMs: cliSummary.durationMs,
          cliExitCode: cliSummary.exitCode,
          cliCommand: cliSummary.command,
          partialSuccess: !passed && (publicFailures.length > 0 || hiddenFailures.length > 0)
        });

        console.log(`     Result: ${passed ? 'PASS' : 'FAIL'} (${Math.round(passDuration / 1000)}s)`);

        if (passed) {
          finalSuccess = true;
          console.log(`   [OK] PASSED on pass ${pass}`);
          break;
        }

        // If not the last pass, generate remediation
        if (pass < this.maxPasses && this.multipassEnabled) {
          console.log(`   → Generating remediation and trying again...`);
        } else {
          console.log(`    FAILED after ${pass} passes`);
        }

        if (harnessIssue) {
          console.log(`   Detected grading harness issue (${harnessIssue}) – stopping further passes until it is resolved.`);
          break;
        }
      }
    } catch (error) {
      console.error(`    ERROR running evaluation: ${error}`);
      passes.push({
        passNumber: passes.length + 1,
        duration: 0,
        success: false
      });
    } finally {
      // Clean up working directory
      if (existsSync(workdir)) {
        rmSync(workdir, { recursive: true });
      }
    }

    const runResultRecord = this.buildRunResult({
      evalName,
      configId,
      runId,
      startedAt: runStartTime,
      finishedAt: new Date(),
      passes,
      remediationNotes,
      overallSuccess: finalSuccess,
      commandHistory
    });
    const selectedPass = passes[this.selectPassIndex(passes)];
    await this.persistRunResult(runId, configId, runResultRecord, selectedPass?.workspaceArchive);

    const totalDuration = Date.now() - startTime;
    
    return {
      evalName,
      configId,
      success: finalSuccess,
      totalDuration,
      passes
    };
  }

  async runMultipleEvaluations(
    evalNames: string[], 
    configIds: string[]
  ): Promise<EvaluationRecord[]> {
    const results: EvaluationRecord[] = [];
    this.runSessionId = uuidv4();
    this.runSessionStartedAt = new Date().toISOString();

    for (const evalName of evalNames) {
      for (const configId of configIds) {
        try {
          const result = await this.runSingleEvaluation(evalName, configId);
          results.push(result);
        } catch (error) {
          console.error(`Failed to run ${evalName} with ${configId}:`, error);
          results.push({
            evalName,
            configId,
            success: false,
            totalDuration: 0,
            passes: []
          });
        }
      }
    }

    return results;
  }

  private async setupWorkspace(sourceDir: string, targetDir: string): Promise<void> {
    // Only copy the workspace subdirectory if it exists, not the entire eval directory
    const workspaceSourceDir = join(sourceDir, 'workspace');
    if (existsSync(workspaceSourceDir)) {
      await cp(workspaceSourceDir, targetDir, { 
        recursive: true,
        filter: (source) => !source.includes('node_modules')
      });
    } else {
      await cp(sourceDir, targetDir, { 
        recursive: true,
        filter: (source) => !source.includes('node_modules')
      });
    }
  }

  private async applyRemediation(workspaceArchive: string, targetDir: string): Promise<void> {
    // This is a placeholder - in a real implementation, you'd extract the previous workspace
    // and apply remediation changes based on the failure analysis
    // For now, we'll just copy the previous workspace, skipping node_modules to avoid symlink issues
    if (existsSync(workspaceArchive)) {
      await cp(workspaceArchive, targetDir, { 
        recursive: true,
        filter: (source) => {
          // Skip node_modules to avoid symlink copy issues
          return !source.includes('node_modules');
        }
      });
    }
  }

  private async executeCliWithTimeout(
    config: Configuration,
    prompt: string,
    workdir: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number; commandString: string }> {
    return new Promise((resolve) => {
      const env = { 
        ...process.env, 
        DEBUG: 'llxprt:*',
        OPENAI_API_KEY: process.env.CEREBRAS_KEY || process.env.SYNTHETIC_KEY || process.env.ZAI_KEY || process.env.OPENAI_API_KEY
      };
      const commandStart = Date.now();

      // Process all arguments, resolving environment variables
      const processedArgs = Promise.all(
        config.args.map(arg => resolveArgumentValue(arg, env))
      );

      processedArgs.then(args => {
        const finalArgs = [...args];
        const promptPrefixText = config.promptPrefix ? `${config.promptPrefix.trim()}\n\n` : '';
        const finalPrompt = `${promptPrefixText}${prompt}`;
        const promptFlagExists = finalArgs.some(arg => arg === '--prompt' || arg === '-p');
        let stdinInput: string | undefined;
        if (promptFlagExists) {
          stdinInput = finalPrompt;
        } else {
          finalArgs.push('--prompt');
          finalArgs.push(finalPrompt);
        }

        const augmentedEnv = { ...env };
        const baseurlFlagIndex = finalArgs.indexOf('--baseurl');
        if (baseurlFlagIndex >= 0 && baseurlFlagIndex + 1 < finalArgs.length) {
          augmentedEnv.OPENAI_BASE_URL = finalArgs[baseurlFlagIndex + 1];
        }

        const resolvedCommand = resolveCliCommand(config.cli);
        const effectiveTimeout = Math.max(config.timeout ?? 0, MIN_AGENT_TIMEOUT_MS);

        const commandDefinition: CommandDefinition = {
          command: resolvedCommand,
          args: finalArgs,
          timeout: effectiveTimeout
        };

        const maskedCommand = maskSensitiveValues(commandDefinition);
        const maskedArgsForSummary: string[] = [];
        for (let i = 0; i < maskedCommand.args.length; i++) {
          const arg = maskedCommand.args[i];
          maskedArgsForSummary.push(arg);
          if (arg === '--prompt' || arg === '-p') {
            maskedArgsForSummary.push('[PROMPT]');
            i += 1;
          }
        }
        const maskedCommandString = `${maskedCommand.command} ${maskedCommand.args.join(' ')}`.trim();
        const summaryCommandString = `${maskedCommand.command} ${maskedArgsForSummary.join(' ')}`.trim();
        console.log(`     Executing: ${maskedCommandString}`);

        const child = spawnSync(
          commandDefinition.command,
          commandDefinition.args,
          {
            cwd: workdir,
            encoding: 'utf8',
            timeout: commandDefinition.timeout,
            env: augmentedEnv,
            input: stdinInput
          }
        );

        let finalStderr = child.stderr || '';
        try { const files = readdirSync('/tmp'); const errorFiles = files.filter(f => f.includes('llxprt-client-error')); for (const file of errorFiles) { try { const content = readFileSync(join('/tmp', file), 'utf8'); finalStderr = finalStderr + ' ERROR_REPORT: ' + file + ' ' + content; } catch (e) {} } } catch (e) {}

        if (child.error) {
          const errorMessage = `Error executing ${commandDefinition.command}: ${child.error.message}`;
          finalStderr = finalStderr ? `${finalStderr}\n${errorMessage}` : errorMessage;
        }

        if (child.signal) {
          const signalMessage = `Process terminated with signal ${child.signal}`;
          finalStderr = finalStderr ? `${finalStderr}\n${signalMessage}` : signalMessage;
        }

        const exitCode = typeof child.status === 'number'
          ? child.status
          : (child.error || child.signal ? 1 : 0);

        const durationMs = Date.now() - commandStart;

        resolve({
          stdout: child.stdout || '',
          stderr: finalStderr,
          exitCode,
          durationMs,
          commandString: summaryCommandString
        });
      }).catch(error => {
        console.error(`Error processing CLI arguments:`, error);
        resolve({
          stdout: '',
          stderr: `Error: ${error}`,
          exitCode: 1
        });
      });
    });
  }

  private async runGrading(
    gradingDir: string,
    workdir: string,
    _cliArgs: ArgValue[]
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];

    const runNpmCommand = (
      cwd: string,
      args: string[],
      label: string,
      timeout = 120000
    ) => {
      const start = Date.now();
      const cmdResult = spawnSync(
        'npm',
        args,
        {
          cwd,
          encoding: 'utf8',
          timeout,
          env: { ...process.env }
        }
      );

      let stderrOutput = cmdResult.stderr || '';
      if (cmdResult.error) {
        const errorMessage = `Command failed: ${cmdResult.error.message}`;
        stderrOutput = stderrOutput ? `${stderrOutput}\n${errorMessage}` : errorMessage;
      }
      if (cmdResult.signal) {
        const signalMessage = `Process terminated with signal ${cmdResult.signal}`;
        stderrOutput = stderrOutput ? `${stderrOutput}\n${signalMessage}` : signalMessage;
      }

      const exitCode = typeof cmdResult.status === 'number'
        ? cmdResult.status
        : (cmdResult.error || cmdResult.signal ? 1 : 0);
      const durationMs = Date.now() - start;
      const commandString = `npm ${args.join(' ')}`;

      const wrapped = {
        label,
        stdout: cmdResult.stdout || '',
        stderr: stderrOutput,
        success: exitCode === 0,
        exitCode,
        command: commandString,
        durationMs
      };

      results.push(wrapped);
      return wrapped;
    };

    const ensureDependencies = (cwd: string, label: string) => {
      if (!existsSync(join(cwd, 'package.json'))) {
        return;
      }
      if (existsSync(join(cwd, 'node_modules'))) {
        return;
      }
      console.log(`     Installing npm dependencies in ${cwd}`);
      runNpmCommand(cwd, ['install'], label, 180000);
    };

    const runScriptsIfAvailable = (
      cwd: string,
      packageJson: Record<string, any> | null,
      scripts: string[],
      labelPrefix: string
    ) => {
      if (!packageJson?.scripts) {
        return;
      }

      for (const script of scripts) {
        if (!packageJson.scripts[script]) {
          continue;
        }
        console.log(`     Running ${labelPrefix} ${script} in ${cwd}`);
        runNpmCommand(cwd, ['run', script], `${labelPrefix}-${script}`);
      }
    };

    // Workspace-level commands
    const workspacePackageJsonPath = join(workdir, 'package.json');
    const workspacePackageJson = existsSync(workspacePackageJsonPath)
      ? JSON.parse(readFileSync(workspacePackageJsonPath, 'utf8'))
      : null;

    if (workspacePackageJson) {
      ensureDependencies(workdir, 'workspace-install');
      runScriptsIfAvailable(
        workdir,
        workspacePackageJson,
        ['typecheck', 'lint', 'test:public', 'build', 'test'],
        'workspace'
      );
    } else {
      results.push({
        label: 'workspace',
        stdout: '',
        stderr: 'No package.json found in workspace',
        success: false,
        exitCode: 1,
        command: 'workspace',
        durationMs: 0
      });
    }

    // Grading-level commands
    if (!existsSync(gradingDir)) {
      results.push({
        label: 'grading',
        stdout: '',
        stderr: 'No grading configuration found',
        success: false,
        exitCode: 1,
        command: 'grading',
        durationMs: 0
      });
      return results;
    }

    const workspaceLinkPath = join(gradingDir, 'workspace');
    let workspaceLinked = false;

    try {
      workspaceLinked = this.ensureGradingWorkspaceLink(workspaceLinkPath, workdir);

      const gradingPackageJsonPath = join(gradingDir, 'package.json');
      const gradingPackageJson = existsSync(gradingPackageJsonPath)
        ? JSON.parse(readFileSync(gradingPackageJsonPath, 'utf8'))
        : null;

      if (gradingPackageJson) {
        ensureDependencies(gradingDir, 'grading-install');
        runScriptsIfAvailable(
          gradingDir,
          gradingPackageJson,
          ['lint', 'typecheck', 'test:hidden', 'test', 'build'],
          'grading'
        );
      } else {
        results.push({
          label: 'grading',
          stdout: '',
          stderr: 'No grading package.json found',
          success: false,
          exitCode: 1,
          command: 'grading',
          durationMs: 0
        });
      }
    } finally {
      if (workspaceLinked) {
        this.cleanupGradingWorkspaceLink(workspaceLinkPath);
      }
    }

    return results;
  }

  private async archiveWorkspace(workdir: string, passNumber: number): Promise<string> {
    const archivePath = join(this.repoRoot, 'evals', 'outputs', `workspace-${passNumber}-${Date.now()}`);
    if (existsSync(workdir)) {
      await cp(workdir, archivePath, { 
        recursive: true,
        filter: (source) => {
          // Skip node_modules to avoid symlink copy issues
          return !source.includes('node_modules');
        }
      });
    }
    return archivePath;
  }

  private async archiveGradingResults(
    workdir: string,
    gradeResults: { label: string; stdout: string; stderr: string; success: boolean }[],
    executionResult?: { stdout: string; stderr: string; exitCode: number }
  ): Promise<string> {
    const outputsDir = join(workdir, '.eval-outputs');
    mkdirSync(outputsDir, { recursive: true });

    // Save llxprt/CLI execution outputs
    if (executionResult) {
      if (executionResult.stdout) {
        await writeFile(join(outputsDir, 'llxprt-stdout.txt'), executionResult.stdout, 'utf8');
      }
      if (executionResult.stderr) {
        await writeFile(join(outputsDir, 'llxprt-stderr.txt'), executionResult.stderr, 'utf8');
      }
      await writeFile(join(outputsDir, 'llxprt-exitcode.txt'), String(executionResult.exitCode), 'utf8');
    }

    // Save grade step outputs
    for (let i = 0; i < gradeResults.length; i++) {
      const result = gradeResults[i];
      const label = result.label || `grade-${i}`;
      if (result.stdout) {
        await writeFile(join(outputsDir, `${label}-stdout.txt`), result.stdout, 'utf8');
      }
      if (result.stderr) {
        await writeFile(join(outputsDir, `${label}-stderr.txt`), result.stderr, 'utf8');
      }
    }

    console.log(`  → Saved CLI/build/grade outputs to ${outputsDir}`);
    return outputsDir;
  }

  private ensureGradingWorkspaceLink(linkPath: string, targetPath: string): boolean {
    try {
      if (existsSync(linkPath)) {
        const linkStats = lstatSync(linkPath);
        if (linkStats.isSymbolicLink() || linkStats.isDirectory()) {
          rmSync(linkPath, { recursive: true, force: true });
        }
      }

      const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
      symlinkSync(targetPath, linkPath, symlinkType);
      return true;
    } catch (error) {
      console.warn(`     Warning: failed to link grading workspace (${linkPath} -> ${targetPath}):`, error);
      return false;
    }
  }

  private cleanupGradingWorkspaceLink(linkPath: string): void {
    try {
      if (existsSync(linkPath)) {
        rmSync(linkPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`     Warning: failed to remove grading workspace link ${linkPath}:`, error);
    }
  }

  private relativePath(target?: string): string | null {
    if (!target) {
      return null;
    }
    return relative(this.repoRoot, target).replace(/\\/g, '/');
  }

  private buildFailureNotes(
    gradeResults: { label: string; stdout: string; stderr: string; success: boolean }[],
    executionResult?: { stdout: string; stderr: string; exitCode: number }
  ): string[] {
    const notes: string[] = [];

    if (executionResult && executionResult.exitCode !== 0) {
      notes.push(
        `Command exited with status ${executionResult.exitCode}. Recent output: ${this.sanitizeFailureSnippet(executionResult.stderr || executionResult.stdout)}`
      );
    }

    const failingSteps = gradeResults.filter(result => result.success === false);
    for (const step of failingSteps) {
      const friendlyLabel = this.getFriendlyStepName(step.label || 'step');
      notes.push(
        `${friendlyLabel} failed. Recent output: ${this.sanitizeFailureSnippet(step.stderr || step.stdout)}`
      );
    }

    if (notes.length === 0 && gradeResults.length > 0) {
      notes.push('Evaluation failed but no specific step reported errors. Inspect the saved .eval-outputs logs for details.');
    }

    return notes;
  }

  private buildQuickExitNotes(
    executionResult: { stdout: string; stderr: string; exitCode: number },
    durationSeconds: number,
    outputLength: number
  ): string[] {
    const note = `Command exited after ${durationSeconds.toFixed(1)}s with ${outputLength} characters of output (exit ${executionResult.exitCode}). Recent output: ${this.sanitizeFailureSnippet(executionResult.stderr || executionResult.stdout)}`;
    return [note];
  }

  private sanitizeFailureSnippet(text?: string, maxLines = 4): string {
    if (!text) {
      return '(see logs)';
    }

    const filtered = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.toLowerCase().includes('see the typescript-eslint docs'))
      .filter(line => !/^https?:\/\//i.test(line))
      .map(line => line.replace(/tests\/hidden/gi, 'tests'));

    const snippet = filtered.slice(-maxLines).join(' | ');
    return snippet.length > 400 ? snippet.slice(-400) : (snippet || '(see logs)');
  }

  private getFriendlyStepName(label: string): string {
    const map: Record<string, string> = {
      'workspace-lint': 'lint',
      'grading-lint': 'lint',
      'workspace-typecheck': 'typecheck',
      'grading-typecheck': 'typecheck',
      'workspace-test:public': 'tests',
      'grading-test:hidden': 'tests',
      'workspace-build': 'build'
    };
    if (map[label]) {
      return map[label];
    }
    return label.replace(/^workspace-/, '').replace(/^grading-/, '');
  }

  private detectHarnessIssue(
    gradeResults: { label: string; stdout: string; stderr: string; success: boolean }[]
  ): string | null {
    for (const result of gradeResults) {
      if (result.label !== 'grading-lint') {
        continue;
      }
      const text = (result.stderr || result.stdout || '').toLowerCase();
      if (text.includes('tsconfig.eslint') || text.includes('cannot read file') || text.includes('parseroptions.project')) {
        return 'lint configuration issue';
      }
    }
    return null;
  }

  private collectTestFailures(stepResults: StepResult[]): { publicFailures: string[]; hiddenFailures: string[] } {
    const publicFailures: string[] = [];
    const hiddenFailures: string[] = [];
    for (const result of stepResults) {
      if (result.success) {
        continue;
      }
      const snippet = this.sanitizeFailureSnippet(result.stderr || result.stdout);
      if (result.label.includes('workspace-test:public')) {
        publicFailures.push(snippet);
      } else if (result.label.includes('grading-test:hidden')) {
        hiddenFailures.push(snippet);
      }
    }
    return { publicFailures, hiddenFailures };
  }

  private mapCommandSummaries(stepResults: StepResult[]): CommandSummary[] {
    return stepResults.map((result) => ({
      command: result.label || result.command,
      exitCode: result.exitCode,
      duration: result.durationMs
    }));
  }

  private selectPassIndex(passes: PassExecutionRecord[]): number {
    if (passes.length === 0) {
      return 0;
    }
    const successIndex = passes.findIndex((pass) => pass.success);
    if (successIndex >= 0) {
      return successIndex;
    }
    return passes.length - 1;
  }

  private buildMultipassPayload(
    passes: PassExecutionRecord[],
    remediationNotes: string[],
    selectedPass: number
  ): Record<string, any> {
    const totalCliDuration = passes.reduce((sum, pass) => sum + (pass.cliDurationMs ?? 0), 0);
    return {
      enabled: this.multipassEnabled,
      maxPasses: this.maxPasses,
      passCount: passes.length,
      selectedPass,
      totalCliDuration,
      feedback: remediationNotes,
      passes: passes.map((pass) => ({
        passNumber: pass.passNumber,
        duration: pass.duration,
        success: pass.success,
        partialSuccess: pass.partialSuccess ?? false,
        publicTestFailures: pass.publicTestFailures ?? [],
        hiddenTestFailures: pass.hiddenTestFailures ?? [],
        appliedFeedback: pass.appliedFeedback ?? [],
        workspaceArchive: this.relativePath(pass.workspaceArchive),
        resultsArchive: this.relativePath(pass.resultsArchive),
        vybes: pass.vybes ?? null
      }))
    };
  }

  private buildRunResult(params: {
    evalName: string;
    configId: string;
    runId: string;
    startedAt: Date;
    finishedAt: Date;
    passes: PassExecutionRecord[];
    remediationNotes: string[];
    overallSuccess: boolean;
    commandHistory: RunCommandSummary[];
  }): EvaluationArchiveRecord {
    const selectedPass = this.selectPassIndex(params.passes);
    const selected = params.passes[selectedPass] ?? params.passes[params.passes.length - 1];
    return {
      evalName: params.evalName,
      configId: params.configId,
      runId: params.runId,
      startedAt: params.startedAt.toISOString(),
      finishedAt: params.finishedAt.toISOString(),
      repoVersion: this.repoVersion,
      runSessionId: this.runSessionId,
      runSessionStartedAt: this.runSessionStartedAt,
      commands: params.commandHistory,
      multipass: this.buildMultipassPayload(params.passes, params.remediationNotes, selectedPass),
      passes: params.passes,
      vybes: selected?.vybes ?? null,
      workspaceArchive: this.relativePath(selected?.workspaceArchive),
      resultsArchive: this.relativePath(selected?.resultsArchive),
      remediationNotes: params.remediationNotes,
      overallSuccess: params.overallSuccess
    };
  }

  private async persistRunResult(runId: string, configId: string, result: EvaluationArchiveRecord, workspaceArchive?: string): Promise<void> {
    const runBaseDir = join(this.repoRoot, 'evals', 'outputs', runId, configId);
    const workspaceTarget = join(runBaseDir, 'workspace');
    await rm(workspaceTarget, { recursive: true, force: true }).catch(() => {});
    mkdirSync(runBaseDir, { recursive: true });
    let finalWorkspacePath: string | null = null;
    if (workspaceArchive && existsSync(workspaceArchive)) {
      await cp(workspaceArchive, workspaceTarget, {
        recursive: true
      });
      finalWorkspacePath = workspaceTarget;
    }
    const finalWorkspaceArchive = finalWorkspacePath ? this.relativePath(finalWorkspacePath) : result.workspaceArchive ?? null;
    const finalResultsArchive = finalWorkspacePath
      ? this.relativePath(join(finalWorkspacePath, '.eval-outputs'))
      : result.resultsArchive ?? null;
    const payload = {
      ...result,
      workspaceArchive: finalWorkspaceArchive,
      resultsArchive: finalResultsArchive
    };
    await writeFile(join(runBaseDir, 'results.json'), JSON.stringify(payload, null, 2), 'utf8');
  }
}

interface Args {
  eval?: string;
  config?: string;
  configs?: string[];
  quick?: boolean;
  maxPasses?: number;
  skipMultipass?: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--eval':
        result.eval = args[++i];
        break;
      case '--config':
        if (!result.configs) {
          result.configs = [];
        }
        result.configs.push(args[++i]);
        break;
      case '--quick':
        result.quick = true;
        break;
      case '--max-passes': {
        const value = args[++i];
        const numeric = Number.parseInt(value ?? '', 10);
        if (Number.isFinite(numeric) && numeric > 0) {
          result.maxPasses = numeric;
        } else {
          console.warn(`Invalid --max-passes value "${value}", falling back to default.`);
        }
        break;
      }
      case '--skip-multipass':
        result.skipMultipass = true;
        break;
    }
  }

  return result;
}

async function main() {
  try {
    const args = parseArgs();
    const runner = new UnifiedRunner({
      maxPasses: args.maxPasses,
      multipassEnabled: args.skipMultipass ? false : undefined
    });
    const configManager = new ConfigurationManager();
    const evalLoader = new EvaluationLoader();

    // Determine which evaluations to run
    const evalNames = args.eval === 'ALL' || !args.eval 
      ? evalLoader.getAllEvaluations()
      : args.eval.split(',');

    // Determine which configurations to run
    const configIds = args.configs && args.configs.length > 0
      ? args.configs
      : (args.config === 'ALL' || !args.config
        ? (args.quick ? ['llxprt-synthetic-glm46'] : configManager.getDefaultConfigurations())
        : args.config.split(','));

    console.log(` RUNNING EVALUATIONS`);
    console.log(`   Evaluations: ${evalNames.join(', ')}`);
    console.log(`   Configurations: ${configIds.join(', ')}`);
    console.log(`   Total evals: ${evalNames.length * configIds.length}`);
    console.log(
      `   Multipass: ${runner.isMultipassEnabled() ? 'enabled' : 'disabled'} (max ${runner.getMaxPasses()} passes)`
    );

    // Run evaluations
    const results = await runner.runMultipleEvaluations(evalNames, configIds);

    // Print summary
    console.log(`\n EVALUATION SUMMARY`);
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    console.log(`   Successful: ${successful}/${total}`);

    for (const result of results) {
      const status = result.success ? '[OK]' : '[ERROR]';
      console.log(`   ${status} ${result.evalName} + ${result.configId} (${Math.round(result.totalDuration/1000)}s)`);
    }

    console.log(`\n FINISHED`);

    if (successful === 0) {
      console.warn('   All runs reported failures; continuing so artifacts can still be published.');
    }

  } catch (error) {
    console.error(`\n FATAL ERROR:`);
    console.error(`   ${error}`);
    process.exit(1);
  }
}

main();
