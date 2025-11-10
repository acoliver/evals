import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { copyFile, readdir, readFile, writeFile, rm, cp, mkdtemp } from 'fs/promises';
import { resolve, join, basename } from 'path';
import { spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { VybesScoringEngine, VybesResult, VybesTaskConfig } from './vybes.js';

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

interface CommandDefinition {
  command: string;
  args: string[];
  timeout: number;
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
}

interface EvaluationRecord {
  evalName: string;
  configId: string;
  success: boolean;
  totalDuration: number;
  passes: PassExecutionRecord[];
}

class UnifiedRunner {
  private maxPasses: number;
  private multipassEnabled: boolean;
  private repoRoot: string;

  constructor(options: { maxPasses?: number; multipassEnabled?: boolean } = {}) {
    this.repoRoot = resolve(__dirname, '..', '..');
    this.maxPasses = options.maxPasses || 3;
    this.multipassEnabled = options.multipassEnabled !== false;
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

    const uniqueId = uuidv4();
    const workdir = join(this.repoRoot, 'evals', 'outputs', `${evalName}-${new Date().toISOString().replace(/[:.]/g, '-')}-${uniqueId}`);
    mkdirSync(workdir, { recursive: true });

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

        // Read the prompt
        const promptContent = readFileSync(evalConfig.prompt, 'utf8');

        // Execute CLI tool
        const executionResult = await this.executeCliWithTimeout(
          config,
          promptContent,
          workdir
        );

        // Check for quick exit with no changes (failsafe)
        const executionDurationSec = (Date.now() - passStartTime) / 1000;
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
          
          if (pass === 1) {
            console.log(`     Stopping multi-pass attempts - please fix the configuration`);
            break;
          }
        }

        // Run grading
        const gradeResults = await this.runGrading(evalConfig.grading, workdir, config.args);

        // Save artifacts
        const workspaceArchive = await this.archiveWorkspace(workdir, pass);
        const resultsArchive = await this.archiveGradingResults(workdir, gradeResults);

        const passDuration = Date.now() - passStartTime;
        const passed = gradeResults.every(result => result.success === true);

        passes.push({
          passNumber: pass,
          duration: passDuration,
          success: passed,
          workspaceArchive,
          resultsArchive
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
      await cp(workspaceSourceDir, targetDir, { recursive: true });
    } else {
      await cp(sourceDir, targetDir, { recursive: true });
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
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const env = { ...process.env };

      // Process all arguments, resolving environment variables
      const processedArgs = Promise.all(
        config.args.map(arg => resolveArgumentValue(arg, env))
      );

      processedArgs.then(args => {
        const commandDefinition: CommandDefinition = {
          command: config.cli.startsWith('/') ? config.cli : join(__dirname, '..', config.cli),
          args,
          timeout: config.timeout
        };

        const maskedCommand = maskSensitiveValues(commandDefinition);
        console.log(`     Executing: ${maskedCommand.command} ${maskedCommand.args.join(' ')}`);

        const child = spawnSync(
          commandDefinition.command,
          commandDefinition.args,
          {
            cwd: workdir,
            encoding: 'utf8',
            timeout: commandDefinition.timeout,
            env,
            input: prompt
          }
        );

        resolve({
          stdout: child.stdout || '',
          stderr: child.stderr || '',
          exitCode: child.status || 0
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
    cliArgs: ArgValue[]
  ): Promise<{ label: string; stdout: string; stderr: string; success: boolean }[]> {
    if (!existsSync(gradingDir)) {
      return [{
        label: 'gradle',
        stdout: '',
        stderr: 'No grading configuration found',
        success: false
      }];
    }

    const results: { label: string; stdout: string; stderr: string; success: boolean }[] = [];

    // Look for package.json in the grading directory
    const packageJsonPath = join(gradingDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      console.log(`     Running npm test in ${gradingDir}`);
      
      const testResult = spawnSync(
        'npm',
        ['test'],
        {
          cwd: gradingDir,
          encoding: 'utf8',
          timeout: 30000,
          env: { ...process.env }
        }
      );

      results.push({
        label: 'test',
        stdout: testResult.stdout || '',
        stderr: testResult.stderr || '',
        success: (testResult.status || 0) === 0
      });
    }

    // Look for build scripts
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.scripts?.build) {
      console.log(`     Running npm build in ${gradingDir}`);
      
      const buildResult = spawnSync(
        'npm',
        ['run', 'build'],
        {
          cwd: gradingDir,
          encoding: 'utf8',
          timeout: 30000,
          env: { ...process.env }
        }
      );

      results.push({
        label: 'build',
        stdout: buildResult.stdout || '',
        stderr: buildResult.stderr || '',
        success: (buildResult.status || 0) === 0
      });
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
    gradeResults: { label: string; stdout: string; stderr: string; success: boolean }[]
  ): Promise<string> {
    const outputsDir = join(workdir, '.eval-outputs');
    mkdirSync(outputsDir, { recursive: true });

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