#!/usr/bin/env ts-node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { copyFile, readdir, readFile, writeFile, rm, cp, mkdtemp } from 'fs/promises';
import { resolve, join, basename } from 'path';
import { spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { VybesScoringEngine, VybesResult, VybesTaskConfig } from './vybes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface EnvArgConfig {
  env: string;
  required?: boolean;
  default?: string;
  sensitive?: boolean;
}

type ArgValue = string | EnvArgConfig;

interface Configuration {
  cli: string;
  name: string;
  description?: string;
  args: ArgValue[];
  timeout: number;
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
  buildSteps: string[];
  gradeSteps: string[];
  vybes?: VybesTaskConfig;
}

interface CLIConfig {
  configurations: Record<string, Configuration>;
  defaultConfigurations: string[];
}

interface EvalConfig {
  evaluations: Record<string, EvaluationConfig>;
}

class ConfigurationManager {
  private cliConfig: CLIConfig;
  private commandRegistry: Record<string, CommandDefinition>;

  constructor() {
    const evalRoot = resolve(__dirname, '..');
    
    // Load CLI configurations
    const cliConfigPath = join(__dirname, 'config/cli-config.json');
    if (!existsSync(cliConfigPath)) {
      throw new Error(`CLI config not found at ${cliConfigPath}`);
    }
    this.cliConfig = JSON.parse(readFileSync(cliConfigPath, 'utf8'));

    // Load command registry
    const commandRegistryPath = join(__dirname, 'config/command-registry.json');
    if (!existsSync(commandRegistryPath)) {
      throw new Error(`Command registry not found at ${commandRegistryPath}`);
    }
    this.commandRegistry = JSON.parse(readFileSync(commandRegistryPath, 'utf8'));
  }

  getConfiguration(configId: string): Configuration {
    const config = this.cliConfig.configurations[configId];
    if (!config) {
      throw new Error(`Configuration not found: ${configId}. Available: ${Object.keys(this.cliConfig.configurations).join(', ')}`);
    }
    return config;
  }

  getDefaultConfigurations(): string[] {
    return this.cliConfig.defaultConfigurations;
  }

  getAllConfigurations(): string[] {
    return Object.keys(this.cliConfig.configurations);
  }

  async runConfiguration(configId: string, promptInstruction: string, cwd: string): Promise<CommandResult> {
    // Read the full prompt content from the file we already wrote
    const promptContent = await readFile(join(cwd, 'prompt.md'), 'utf8');
    const config = this.getConfiguration(configId);
    
    // Both LLxprt and Codex read from stdin when no prompt argument is provided
    const { args, maskArgIndices } = this.resolveArgs(configId, config.args);
    
    return await this.runCommand(config.cli, args, { 
      cwd, 
      timeout: config.timeout,
      input: promptContent,
      maskArgIndices,
      label: configId
    });
  }

  async runCommandByName(commandName: string, cwd: string): Promise<CommandResult> {
    const commandDef = this.commandRegistry[commandName];
    if (!commandDef) {
      throw new Error(`Command not found: ${commandName}. Available: ${Object.keys(this.commandRegistry).join(', ')}`);
    }
    
    return await this.runCommand(commandDef.command, commandDef.args, {
      cwd,
      timeout: commandDef.timeout,
      label: commandName
    });
  }

  private resolveArgs(configId: string, argDefinitions: ArgValue[] = []): { args: string[]; maskArgIndices: Set<number> } {
    const args: string[] = [];
    const maskArgIndices = new Set<number>();

    argDefinitions.forEach((definition) => {
      if (typeof definition === 'string') {
        args.push(definition);
        return;
      }

      if (!definition || typeof definition !== 'object') {
        throw new Error(`Invalid argument definition encountered for ${configId}`);
      }

      const envName = definition.env;
      if (!envName) {
        throw new Error(`Invalid env placeholder in configuration ${configId}`);
      }

      let value = process.env[envName];
      if (value === undefined || value === null || value === '') {
        if (definition.default !== undefined) {
          value = definition.default;
        }
      }

      if ((value === undefined || value === null || value === '') && definition.required !== false) {
        throw new Error(`Missing required environment variable ${envName} for configuration ${configId}`);
      }

      const resolved = value ?? '';
      args.push(resolved);
      if (definition.sensitive) {
        maskArgIndices.add(args.length - 1);
      }
    });

    return { args, maskArgIndices };
  }

  private async runCommand(
    command: string,
    args: string[],
    options: { cwd: string; timeout: number; input?: string; maskArgIndices?: Set<number>; label?: string }
  ): Promise<CommandResult> {
    const start = Date.now();
    
    // Configure stdio for stdin if input is provided
    const stdioOption = options.input ? ['pipe', 'pipe', 'pipe'] : 'pipe';
    
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      stdio: stdioOption,
      encoding: 'utf8',
      input: options.input,
      timeout: options.timeout
    });

    const duration = Date.now() - start;
    const sanitizedCommand = this.buildSanitizedCommand(command, args, options.maskArgIndices);

    // Proper error handling: timeouts or spawn failures should be non-zero exit
    let exitCode: number;
    if (result.error) {
      // Spawn failed
      exitCode = 1;
    } else if (result.signal !== null) {
      // Killed by signal (timeout)
      exitCode = 1;
    } else {
      exitCode = result.status || 0;
    }

    const stdout = result.stdout ? (typeof result.stdout === 'string' ? result.stdout : result.stdout.toString()) : '';
    const stderr = result.stderr ? (typeof result.stderr === 'string' ? result.stderr : result.stderr.toString()) : '';

    return {
      command: sanitizedCommand,
      cwd: options.cwd,
      exitCode,
      stdout,
      stderr,
      duration,
      label: options.label
    };
  }

  private buildSanitizedCommand(command: string, args: string[], maskArgIndices?: Set<number>): string {
    if (!args?.length) {
      return command;
    }

    const sanitizedArgs = args.map((arg, index) => {
      const shouldMask = this.shouldMaskArg(args, index, maskArgIndices);
      return shouldMask ? '***' : this.formatArg(arg);
    });

    return `${command} ${sanitizedArgs.join(' ')}`.trim();
  }

  private formatArg(value: string): string {
    if (value === undefined || value === null) {
      return '""';
    }

    if (value === '') {
      return '""';
    }

    if (/\s/.test(value) || value.includes('"')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }

    return value;
  }

  private shouldMaskArg(args: string[], index: number, maskArgIndices?: Set<number>): boolean {
    if (maskArgIndices?.has(index)) {
      return true;
    }

    const current = args[index] ?? '';
    const previous = index > 0 ? args[index - 1] : '';
    const lowerCurrent = current.toLowerCase();
    if (SENSITIVE_FLAGS.has(previous)) {
      return true;
    }

    if (previous === '--set' && this.containsSensitiveKeyword(lowerCurrent)) {
      return true;
    }

    if (
      lowerCurrent.startsWith('--key=') ||
      lowerCurrent.startsWith('--keyfile=') ||
      lowerCurrent.startsWith('--auth-key=') ||
      lowerCurrent.startsWith('--auth-keyfile=')
    ) {
      return true;
    }

    if (!current.startsWith('--') && this.containsSensitiveKeyword(lowerCurrent)) {
      return true;
    }

    return false;
  }

  private containsSensitiveKeyword(value: string): boolean {
    return SENSITIVE_VALUE_SUBSTRINGS.some((needle) => value.includes(needle));
  }
}

interface CommandResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  label?: string;
}

interface FailureSummaryDetail {
  step: string;
  exitCode: number;
  message: string;
  snippet?: string;
}

interface RemediationFeedback {
  bullets: string[];
  failingSteps: FailureSummaryDetail[];
  hiddenAssertions: string[];
  publicTestFailures: string[];
}

interface PromptBuildResult {
  prompt: string;
  appliedBullets: string[];
}

interface PassExecutionRecord {
  passNumber: number;
  startedAt: string;
  finishedAt: string;
  totalDuration: number;
  promptHash: string;
  appliedFeedback: string[];
  cliResult: CommandResult;
  buildResults: CommandResult[];
  gradeResults: CommandResult[];
  success: boolean;
  partialSuccess?: boolean;
  workspaceArchive?: string;
  resultsArchive?: string;
  feedbackForNextPass?: RemediationFeedback;
  vybesScore?: VybesResult;
  publicTestFailures: string[];
}

class FailureFeedbackGenerator {
  private static readonly INTRO = "It isn't working correctly.";
  private static readonly REMINDER =
    'Please resolve the issues and re-run lint, tests, and build before finishing.';
  private static readonly MAX_BULLETS = 6;

  generate(context: {
    cliResult: CommandResult;
    buildResults: CommandResult[];
    gradeResults: CommandResult[];
    publicTestFailures?: string[];
  }): RemediationFeedback | undefined {
    const failingCommands = [...context.buildResults, ...context.gradeResults].filter(
      (result) => result.exitCode !== 0
    );
    const cliFailed = context.cliResult.exitCode !== 0;
    const hasPublicFailures = (context.publicTestFailures?.length ?? 0) > 0;

    if (!cliFailed && failingCommands.length === 0 && !hasPublicFailures) {
      return undefined;
    }

    const bullets: string[] = [];
    const failingSteps: FailureSummaryDetail[] = [];
    const hiddenAssertions: string[] = [];

    bullets.push(FailureFeedbackGenerator.INTRO);

    const publicFailures = (context.publicTestFailures ?? []).map((title) =>
      this.formatPublicTestFailure(title)
    );
    for (const bullet of publicFailures) {
      bullets.push(bullet);
    }

    if (cliFailed) {
      const message = this.describeCliFailure(context.cliResult);
      bullets.push(message);
      failingSteps.push({
        step: context.cliResult.label ?? 'cli',
        exitCode: context.cliResult.exitCode,
        message
      });
    }

    for (const command of failingCommands) {
      const stepLabel = this.resolveStepLabel(command);
      const detail: FailureSummaryDetail = {
        step: stepLabel,
        exitCode: command.exitCode,
        message: this.describeStepFailure(stepLabel, command)
      };
      const snippet = this.extractHiddenAssertion(command);
      if (snippet) {
        hiddenAssertions.push(snippet);
        detail.snippet = snippet;
        bullets.push(snippet.endsWith('.') ? snippet : `${snippet}`);
      } else {
        bullets.push(detail.message);
      }
      failingSteps.push(detail);
    }

    bullets.push(FailureFeedbackGenerator.REMINDER);

    const uniqueBullets = this.dedupeBullets(bullets);
    const finalBullets = this.enforceBulletLimit(uniqueBullets);

    return {
      bullets: finalBullets,
      failingSteps,
      hiddenAssertions,
      publicTestFailures: [...(context.publicTestFailures ?? [])]
    };
  }

  private describeCliFailure(result: CommandResult): string {
    const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 'unknown';
    return `Your previous attempt exited with code ${exitCode}. Review the CLI logs to diagnose the issue.`;
  }

  private formatPublicTestFailure(title: string): string {
    const normalized = title.trim().replace(/\s+/g, ' ');
    const stripped = normalized.replace(/\.+$/, '');
    let sentence = stripped.length ? stripped : 'the failing test';
    const lower = sentence.toLowerCase();
    if (lower.startsWith('it should ')) {
      sentence = sentence.slice(9).trim();
    } else if (lower.startsWith('should ')) {
      sentence = sentence.slice(7).trim();
    }
    const withPeriod = sentence.endsWith('.') ? sentence : `${sentence}.`;
    return `It should ${withPeriod}`;
  }

  private resolveStepLabel(result: CommandResult): string {
    if (result.label) {
      return result.label;
    }

    const command = result.command.toLowerCase();
    if (command.includes('test:hidden')) return 'test:hidden';
    if (command.includes('test:public')) return 'test:public';
    if (command.includes('typecheck')) return 'typecheck';
    if (command.includes('lint')) return 'lint';
    if (command.includes('build')) return 'build';
    if (command.includes('install')) return 'workspace-install';

    return 'step';
  }

  private describeStepFailure(step: string, result: CommandResult): string {
    const normalized = step.toLowerCase();
    if (normalized.includes('lint')) {
      return 'Lint failed. Fix the reported lint errors.';
    }
    if (normalized.includes('typecheck')) {
      return 'Typecheck failed. Resolve the TypeScript errors.';
    }
    if (normalized.includes('test:public')) {
      return 'Public tests failed. Investigate the failing cases.';
    }
    if (normalized.includes('test:hidden')) {
      const snippet = this.extractHiddenAssertion(result);
      if (snippet) {
        return snippet;
      }
      return 'One of the verification checks failed. Review the output for details.';
    }
    if (normalized.includes('build')) {
      return 'Build failed. Address the build-time errors.';
    }
    if (normalized.includes('install')) {
      return 'Dependency install failed. Check npm install logs.';
    }

    return `Step "${result.command}" failed (exit ${result.exitCode}).`;
  }

  private extractHiddenAssertion(result: CommandResult): string | undefined {
    const output = [result.stdout ?? '', result.stderr ?? ''].join('\n');
    if (!output.trim()) {
      return undefined;
    }

    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (/^expected\b/i.test(line)) {
        return this.truncate(line);
      }
      if (line.includes('Expected') && line.includes('Received')) {
        return this.truncate(line);
      }
      if (/assertionerror/i.test(line) && line.includes(':')) {
        return this.truncate(line);
      }
      if (line.startsWith('Received:') || line.startsWith('Received ')) {
        return this.truncate(line);
      }
      if (line.startsWith('Difference:')) {
        return this.truncate(line);
      }
    }

    return undefined;
  }

  private truncate(value: string, limit = 160): string {
    if (value.length <= limit) {
      return value;
    }
    return `${value.slice(0, limit).trimEnd()}…`;
  }

  private dedupeBullets(bullets: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const bullet of bullets) {
      const normalized = bullet.trim();
      if (!normalized) {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }

  private enforceBulletLimit(bullets: string[]): string[] {
    if (bullets.length <= FailureFeedbackGenerator.MAX_BULLETS) {
      return bullets;
    }

    const intro = bullets[0];
    const reminder = bullets[bullets.length - 1];
    const middle = bullets.slice(1, bullets.length - 1);
    const available = FailureFeedbackGenerator.MAX_BULLETS - 2;
    const trimmed = middle.slice(0, Math.max(available, 0));

    return [intro, ...trimmed, reminder];
  }
}

class RemediationPromptBuilder {
  private readonly basePrompt: string;
  private remediationBullets: string[] = [];

  constructor(basePrompt: string) {
    this.basePrompt = basePrompt;
  }

  setFeedback(bullets: string[] | undefined): string[] {
    if (!bullets?.length) {
      this.remediationBullets = [];
      return this.remediationBullets;
    }

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const bullet of bullets) {
      const normalized = bullet.trim();
      if (!normalized) {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      unique.push(normalized);
    }
    this.remediationBullets = unique;
    return this.remediationBullets;
  }

  buildPrompt(): PromptBuildResult {
    if (this.remediationBullets.length === 0) {
      return {
        prompt: this.basePrompt,
        appliedBullets: []
      };
    }

    const bulletList = this.remediationBullets.map((bullet) => `- ${bullet}`).join('\n');
    const prompt = `${this.basePrompt}\n\n### Remediation Guidance\n${bulletList}\n`;
    return {
      prompt,
      appliedBullets: [...this.remediationBullets]
    };
  }
}

interface EvalResult {
  evalName: string;
  configId: string;
  workspace: string;
  grading: string;
  cliResult: CommandResult;
  buildResults: CommandResult[];
  gradeResults: CommandResult[];
  success: boolean;
  totalDuration: number;
  totalCliDuration: number;
  passes: PassExecutionRecord[];
  selectedPass: number;
  multipassEnabled: boolean;
  maxPasses: number;
  feedbackSummary: string[];
  archivePath: string;
  vybesScore?: VybesResult;
  repoVersion?: string;
  runSessionId?: string;
  runSessionStartedAt?: string;
}

class EvaluationLoader {
  private evalRoot: string;
  private evaluations: Record<string, EvaluationConfig>;

  constructor() {
    this.evalRoot = resolve(__dirname, '..');
    
    // Load evaluation configurations
    const evalConfigPath = join(__dirname, 'config/eval-config.json');
    if (!existsSync(evalConfigPath)) {
      throw new Error(`Evaluation config not found at ${evalConfigPath}`);
    }
    const evalConfig: EvalConfig = JSON.parse(readFileSync(evalConfigPath, 'utf8'));
    this.evaluations = evalConfig.evaluations;
  }

  resolvePath(path: string): string {
    return path.replace('${EVAL_ROOT}', this.evalRoot);
  }

  getEvaluation(evalName: string): EvaluationConfig {
    const evalConfig = this.evaluations[evalName];
    if (!evalConfig) {
      throw new Error(`Evaluation not found: ${evalName}. Available: ${Object.keys(this.evaluations).join(', ')}`);
    }
    
    // Resolve paths
    return {
      ...evalConfig,
      workspace: this.resolvePath(evalConfig.workspace),
      grading: this.resolvePath(evalConfig.grading)
    };
  }

  getAllEvaluations(): string[] {
    return Object.keys(this.evaluations);
  }
}

class WorkspaceManager {
  constructor() {}

  async createWorkspace(sourcePath: string): Promise<string> {
    // Create temporary directory in source location (like old scripts)
    const sourceDir = dirname(sourcePath);
    const tempRoot = await mkdtemp(join(sourceDir, `.tmp-workspace-${uuidv4()}-`));
    const workspacePath = join(tempRoot, 'workspace');
    
    mkdirSync(workspacePath, { recursive: true });
    await this.copyDirectory(sourcePath, workspacePath);
    return workspacePath;
  }

  private async copyDirectory(source: string, target: string): Promise<void> {
    // Use fs/promises cp for robust copying with filter
    await cp(source, target, {
      recursive: true,
      filter: (src) => {
        const segments = src.split('/');
        if (segments.includes('node_modules')) {
          return false;
        }
        if (segments.includes('coverage')) {
          return false;
        }
        // Keep dist/ directories - they're needed for hidden tests
        if (segments.includes('dist')) {
          return true;
        }
        return true;
      }
    });
  }

  async syncWorkspaceForGrading(source: string, gradingDir: string): Promise<void> {
    const targetPath = join(gradingDir, 'workspace');
    
    // Remove existing workspace in grading dir if it exists
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
    
    // Copy to grading directory with filter (like old scripts)
    await cp(source, targetPath, {
      recursive: true,
      filter: (src) => {
        const segments = src.split('/');
        if (segments.includes('node_modules')) {
          return false;
        }
        if (segments.includes('coverage')) {
          return false;
        }
        if (segments.includes('dist')) {
          return true;
        }
        return true;
      }
    });
    
    console.log(`  → Synced workspace to ${targetPath}`);
  }

  async archiveWorkspace(
    source: string,
    archiveBaseDir: string
  ): Promise<string> {
    // Create archive directory structure: outputs/evalname-timestamp/configname/workspace
    const archiveDir = join(archiveBaseDir, 'workspace');
    mkdirSync(archiveDir, { recursive: true });
    
    // Copy workspace to archive with filter
    await cp(source, archiveDir, {
      recursive: true,
      filter: (src) => {
        const segments = src.split('/');
        if (segments.includes('node_modules')) {
          return false;
        }
        if (segments.includes('coverage')) {
          return false;
        }
        if (segments.includes('dist')) {
          return true;
        }
        return true;
      }
    });
    
    console.log(`  → Archived workspace to ${archiveDir}`);
    return archiveDir;
  }

  cleanup(path: string): void {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
  }
}

class ResultsManager {
  private resultsDir: string;

  constructor() {
    // Use outputs/ instead of evals/results/ for separation
    this.resultsDir = join(__dirname, '..', 'outputs');
    mkdirSync(this.resultsDir, { recursive: true });
  }

  createRunDirectory(evalName: string, configId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const runDir = join(this.resultsDir, `${evalName}-${timestamp}`, configId);
    mkdirSync(runDir, { recursive: true });
    return runDir;
  }

  async saveResults(evalName: string, configId: string, result: EvalResult): Promise<string> {
    const resultsPath = result.archivePath;
    const resultsFile = join(resultsPath, 'results.json');
    
    const multipass = {
      enabled: result.multipassEnabled,
      selectedPass: result.selectedPass,
      maxPasses: result.maxPasses,
      totalCliDuration: result.totalCliDuration,
      passCount: result.passes.length,
      feedback: result.feedbackSummary,
      passes: result.passes.map((pass) => ({
        passNumber: pass.passNumber,
        startedAt: pass.startedAt,
        finishedAt: pass.finishedAt,
        totalDuration: pass.totalDuration,
        promptHash: pass.promptHash,
        appliedFeedback: pass.appliedFeedback,
        success: pass.success,
        partialSuccess: pass.partialSuccess ?? false,
        workspaceArchive: pass.workspaceArchive,
        resultsArchive: pass.resultsArchive,
        cliResult: pass.cliResult,
        buildResults: pass.buildResults,
        gradeResults: pass.gradeResults,
        feedbackForNextPass: pass.feedbackForNextPass,
        publicTestFailures: pass.publicTestFailures,
        vybes: pass.vybesScore
      }))
    };

    const results = {
      evalName,
      configId,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: result.success ? 'pass' : 'fail',
      totalDuration: result.totalDuration,
      totalCliDuration: result.totalCliDuration,
      commands: [result.cliResult, ...result.buildResults, ...result.gradeResults].map(cmd => ({
        name: cmd.label ?? cmd.command.split(' ')[0],
        command: cmd.command,
        cwd: cmd.cwd,
        exitCode: cmd.exitCode,
        stdout: cmd.stdout,
        stderr: cmd.stderr,
        duration: cmd.duration,
        success: cmd.exitCode === 0
      })),
      workspaceArchive: result.archivePath,
      runSessionId: result.runSessionId,
      runSessionStartedAt: result.runSessionStartedAt,
      repoVersion: result.repoVersion,
      multipass
    };

    if (result.vybesScore) {
      results.vybes = result.vybesScore;
    }

    await writeFile(resultsFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`  → Results saved to ${resultsFile}`);
    
    return resultsPath;
  }
}

interface RunSessionContext {
  id: string;
  startedAt: string;
}

interface RunnerOptions {
  maxPasses?: number;
  multipassEnabled?: boolean;
}

class UnifiedRunner {
  private configManager: ConfigurationManager;
  private evalLoader: EvaluationLoader;
  private workspaceManager: WorkspaceManager;
  private resultsManager: ResultsManager;
  private vybesEngine: VybesScoringEngine;
  private repoRoot: string;
  private maxPasses: number;
  private multipassEnabled: boolean;

  constructor(options: RunnerOptions = {}) {
    this.configManager = new ConfigurationManager();
    this.evalLoader = new EvaluationLoader();
    this.workspaceManager = new WorkspaceManager();
    this.resultsManager = new ResultsManager();
    this.vybesEngine = new VybesScoringEngine();
    this.repoRoot = resolve(__dirname, '..');

    const envMax = Number(process.env.EVALS_MAX_PASSES);
    const resolvedMax = options.maxPasses ?? (Number.isFinite(envMax) ? envMax : undefined);
    this.maxPasses = Math.max(1, resolvedMax ?? 3);

    const envSkip =
      (process.env.EVALS_SKIP_MULTIPASS ?? '')
        .toLowerCase()
        .trim();
    const skipMultipass = ['1', 'true', 'yes', 'on'].includes(envSkip);
    this.multipassEnabled = options.multipassEnabled ?? !skipMultipass;
  }

  async runEvaluation(evalName: string, configId: string, session?: RunSessionContext): Promise<EvalResult> {
    console.log(`\n STARTED: ${evalName} + ${configId}`);
    
    const start = Date.now();
    const evalConfig = this.evalLoader.getEvaluation(evalName);
    const repoVersion = this.getRepoVersion();

    // Create archive directory for this run
    const archivePath = this.resultsManager.createRunDirectory(evalName, configId);

    // Create temporary workspace in same directory (like old scripts)
    const workspace = await this.workspaceManager.createWorkspace(evalConfig.workspace);
    console.log(`   Workspace: ${workspace}`);

    const basePrompt = await this.composeBasePrompt(workspace, evalConfig.prompt);
    const promptBuilder = new RemediationPromptBuilder(basePrompt);
    const feedbackGenerator = new FailureFeedbackGenerator();
    const passes: PassExecutionRecord[] = [];
    const multipassEnabled = this.multipassEnabled && this.maxPasses > 1;
    const maxPasses = multipassEnabled ? this.maxPasses : 1;
    let pendingFeedback: RemediationFeedback | undefined;
    let cumulativeDuration = 0;

    try {
      for (let passNumber = 1; passNumber <= maxPasses; passNumber++) {
        promptBuilder.setFeedback(pendingFeedback?.bullets);
        const { prompt, appliedBullets } = promptBuilder.buildPrompt();
        await writeFile(join(workspace, 'prompt.md'), prompt, 'utf8');
        const promptHash = this.hashContent(prompt);

        console.log(`   Pass ${passNumber}/${maxPasses} – remediation bullets: ${appliedBullets.length}`);
        const passStartTime = Date.now();

        const cliResult = await this.configManager.runConfiguration(
          configId,
          'Execute the instructions in ./prompt.md',
          workspace
        );
        const cliStatus = cliResult.exitCode === 0 ? '[OK]' : '[ERROR]';
        console.log(`  ${cliStatus} CLI completed (${cliResult.duration}ms, exit: ${cliResult.exitCode})`);

        const buildResults: CommandResult[] = [];
        console.log(`   Running build steps (${evalConfig.buildSteps.length} steps)`);
        for (const step of evalConfig.buildSteps) {
          const result = await this.configManager.runCommandByName(step, workspace);
          buildResults.push(result);
          if (result.exitCode !== 0) {
            console.log(`  [ERROR] ${step} failed (${result.exitCode})`);
          } else {
            console.log(`  [OK] ${step} passed (${result.duration}ms)`);
          }
        }

        console.log(`   Syncing workspace for grading`);
        await this.workspaceManager.syncWorkspaceForGrading(workspace, evalConfig.grading);

        const gradeResults: CommandResult[] = [];
        console.log(`   Running grade steps (${evalConfig.gradeSteps.length} steps)`);
        for (const step of evalConfig.gradeSteps) {
          const result = await this.configManager.runCommandByName(step, evalConfig.grading);
          gradeResults.push(result);
          if (result.exitCode !== 0) {
            console.log(`  [ERROR] ${step} failed (${result.exitCode})`);
          } else {
            console.log(`  [OK] ${step} passed (${result.duration}ms)`);
          }
        }

        const passEndTime = Date.now();
        const passDuration = passEndTime - passStartTime;
        cumulativeDuration += passDuration;
        const passArchiveBase = join(archivePath, 'passes', `pass-${passNumber}`);
        mkdirSync(passArchiveBase, { recursive: true });
        const passPromptPath = join(passArchiveBase, 'prompt.md');
        await writeFile(passPromptPath, prompt, 'utf8');

        const workspaceArchive = await this.workspaceManager.archiveWorkspace(workspace, passArchiveBase);
        const resultsArchive = await this.copyGradingResults(
          evalConfig.grading,
          passArchiveBase,
          workspaceArchive
        );

        const publicTestFailures = this.collectPublicTestFailures([...buildResults, ...gradeResults]);

        const stageSucceeded =
          cliResult.exitCode === 0 &&
          buildResults.every((result) => result.exitCode === 0) &&
          gradeResults.every((result) => result.exitCode === 0);

        let passVybes: VybesResult | undefined;
        try {
          passVybes = this.vybesEngine.calculate({
            evalName,
            configId,
            providedConfig: evalConfig.vybes,
            archivePath: workspaceArchive,
            cliResult,
            buildResults,
            gradeResults,
            overallSuccess: stageSucceeded,
            totalCliDuration: cliResult.duration,
            passCount: passNumber,
            selectedPassIndex: passNumber - 1
          });
          if (passVybes) {
            const scorePercent = (passVybes.successPercentage * 100).toFixed(1);
            console.log(
              `   Pass ${passNumber} vybes: ${passVybes.finalScore.toFixed(2)} (${scorePercent}% success)`
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`  [WARN] Failed to calculate vybes for pass ${passNumber}: ${message}`);
        }

        const successPercentage = passVybes?.successPercentage ?? (stageSucceeded ? 1 : 0);
        const fullySuccessful = stageSucceeded && successPercentage >= 0.9999;
        const partialSuccess = stageSucceeded && successPercentage > 0 && !fullySuccessful;

        const passRecord: PassExecutionRecord = {
          passNumber,
          startedAt: new Date(passStartTime).toISOString(),
          finishedAt: new Date(passEndTime).toISOString(),
          totalDuration: passDuration,
          promptHash,
          appliedFeedback: appliedBullets,
          cliResult,
          buildResults,
          gradeResults,
          success: fullySuccessful,
          partialSuccess,
          workspaceArchive,
          resultsArchive,
          publicTestFailures,
          vybesScore: passVybes
        };

        passes.push(passRecord);

        if (fullySuccessful) {
          console.log(`  [OK] Pass ${passNumber} completed with full credit`);
          pendingFeedback = undefined;
          break;
        }

        const allowRetry = multipassEnabled && passNumber < maxPasses;

        if (!allowRetry) {
          if (partialSuccess) {
            console.log(
              `  [WARN] Pass ${passNumber} finished with partial credit ${(successPercentage * 100).toFixed(
                1
              )}%; multipass retries exhausted.`
            );
          } else {
            console.log(`  [WARN] Pass ${passNumber} failed; multipass retries exhausted.`);
          }
          pendingFeedback = undefined;
          continue;
        }

        pendingFeedback = feedbackGenerator.generate({
          cliResult,
          buildResults,
          gradeResults,
          publicTestFailures
        });
        passRecord.feedbackForNextPass = pendingFeedback;

        if (partialSuccess) {
          console.log(
            `  [PARTIAL] Pass ${passNumber} finished with ${(successPercentage * 100).toFixed(
              1
            )}% credit; retrying with remediation.`
          );
        } else {
          console.log(`  [WARN] Pass ${passNumber} failed; retrying with remediation.`);
        }

        if (pendingFeedback?.bullets?.length) {
          console.log(`   Feedback for next pass:`);
          for (const bullet of pendingFeedback.bullets) {
            console.log(`     - ${bullet}`);
          }
        } else {
          console.log(`   No remediation feedback generated; next pass will reuse the base prompt.`);
        }
      }

      if (passes.length === 0) {
        throw new Error('No passes were executed for this evaluation.');
      }

      for (const pass of passes) {
        if (!pass.workspaceArchive || pass.vybesScore) {
          continue;
        }
        try {
          pass.vybesScore = this.vybesEngine.calculate({
            evalName,
            configId,
            providedConfig: evalConfig.vybes,
            archivePath: pass.workspaceArchive,
            cliResult: pass.cliResult,
            buildResults: pass.buildResults,
            gradeResults: pass.gradeResults,
            overallSuccess: pass.success || !!pass.partialSuccess
          });
          if (pass.vybesScore) {
            const scorePercent = (pass.vybesScore.successPercentage * 100).toFixed(1);
            console.log(
              `   Pass ${pass.passNumber} vybes (post-run): ${pass.vybesScore.finalScore.toFixed(
                2
              )} (${scorePercent}% success)`
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`  [WARN] Failed to calculate vybes for pass ${pass.passNumber}: ${message}`);
        }
      }

      const selectedPassIndex = this.selectBestPassIndex(passes);
      const selectedPass =
        passes[selectedPassIndex] ?? passes[passes.length - 1];
      const totalDuration = Date.now() - start;
      const feedbackSummary = selectedPass?.appliedFeedback ?? [];

      await this.promotePassArtifacts(selectedPass, archivePath);
      const workspaceArchive = join(archivePath, 'workspace');

      let vybesScore: VybesResult | undefined;
      try {
        vybesScore = this.vybesEngine.calculate({
          evalName,
          configId,
          providedConfig: evalConfig.vybes,
          archivePath: workspaceArchive,
          cliResult: selectedPass.cliResult,
          buildResults: selectedPass.buildResults,
          gradeResults: selectedPass.gradeResults,
          overallSuccess: selectedPass.success || !!selectedPass.partialSuccess,
          totalCliDuration: cumulativeDuration,
          passCount: passes.length,
          selectedPassIndex
        });
        if (vybesScore) {
          vybesScore.repoVersion = repoVersion;
          const scorePercent = (vybesScore.successPercentage * 100).toFixed(1);
          console.log(
            `  → Vybes score: ${vybesScore.finalScore.toFixed(
              2
            )} (${scorePercent}% success, penalty ${vybesScore.timePenaltyMultiplier.toFixed(2)})`
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`  [WARN] Failed to calculate vybes score: ${message}`);
      }
      const finalSuccess =
        (vybesScore?.successPercentage ?? 0) >= 0.9999 && vybesScore?.status === 'ok';

      const result: EvalResult = {
        evalName,
        configId,
        workspace,
        grading: evalConfig.grading,
        cliResult: selectedPass.cliResult,
        buildResults: selectedPass.buildResults,
        gradeResults: selectedPass.gradeResults,
        success: finalSuccess,
        totalDuration,
        totalCliDuration: cumulativeDuration,
        passes,
        selectedPass: selectedPassIndex,
        multipassEnabled,
        maxPasses,
        feedbackSummary,
        archivePath: workspaceArchive,
        vybesScore,
        repoVersion,
        runSessionId: session?.id,
        runSessionStartedAt: session?.startedAt
      };

      await this.resultsManager.saveResults(evalName, configId, result);
      return result;
    } finally {
      // Cleanup workspace
      this.workspaceManager.cleanup(workspace);
      console.log(`   Cleaned up workspace`);
    }
  }

  private async composeBasePrompt(workspace: string, promptFile: string): Promise<string> {
    const promptsRoot = resolve(__dirname, '..', 'prompts');
    const problemPrompt = await readFile(join(promptsRoot, 'problems', promptFile), 'utf8');
    const problemDescription = await readFile(join(workspace, 'problem.md'), 'utf8');
    const sharedInstructions = await readFile(join(promptsRoot, 'shared/evaluation-instructions.md'), 'utf8');

    return [problemPrompt, problemDescription, sharedInstructions].join('\n\n');
  }

  async runMultipleEvaluations(evalNames: string[], configIds: string[]): Promise<EvalResult[]> {
    const results: EvalResult[] = [];
    const sessionContext: RunSessionContext = {
      id: uuidv4(),
      startedAt: new Date().toISOString()
    };
    
    for (const evalName of evalNames) {
      for (const configId of configIds) {
        try {
          const result = await this.runEvaluation(evalName, configId, sessionContext);
          results.push(result);
        } catch (error) {
          console.error(`\n FATAL: ${evalName} + ${configId}`);
          console.error(`   Error: ${error}`);
          // Continue with other evaluations
        }
      }
    }
    
    return results;
  }

  getMaxPasses(): number {
    return this.maxPasses;
  }

  isMultipassEnabled(): boolean {
    return this.multipassEnabled && this.maxPasses > 1;
  }

  private selectBestPassIndex(passes: PassExecutionRecord[]): number {
    if (passes.length === 0) {
      return 0;
    }

    const EPSILON = 1e-6;
    let bestIndex = 0;
    let bestSuccess = -1;
    let bestRaw = -Infinity;

    passes.forEach((pass, index) => {
      const vybes = pass.vybesScore;
      const successPercentage = vybes
        ? vybes.successPercentage
        : pass.success
        ? 1
        : 0;
      const rawScore = vybes
        ? vybes.rawScore
        : pass.success
        ? Number.POSITIVE_INFINITY
        : 0;

      if (successPercentage > bestSuccess + EPSILON) {
        bestSuccess = successPercentage;
        bestRaw = rawScore;
        bestIndex = index;
        return;
      }

      const successTie = Math.abs(successPercentage - bestSuccess) <= EPSILON;
      if (successTie && rawScore > bestRaw + EPSILON) {
        bestRaw = rawScore;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private collectPublicTestFailures(results: CommandResult[]): string[] {
    const titles = new Set<string>();
    for (const result of results) {
      if (result.exitCode === 0) {
        continue;
      }
      const label = (result.label ?? '').toLowerCase();
      const command = result.command.toLowerCase();
      if (!label.includes('test:public') && !command.includes('test:public')) {
        continue;
      }
      const combined = [result.stdout ?? '', result.stderr ?? ''].join('\n');
      for (const title of this.extractTestTitlesFromOutput(combined)) {
        if (title) {
          titles.add(title);
        }
      }
    }
    return Array.from(titles);
  }

  private extractTestTitlesFromOutput(output: string): string[] {
    const titles = new Set<string>();
    if (!output) {
      return [];
    }
    const lines = output.split(/\r?\n/);
    const pattern = /^\s*(?:FAIL|\u2716|\u276F)\s+.+?>\s*(.+)$/u;

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const match = line.match(pattern);
      if (!match) {
        continue;
      }
      const tail = match[1] ?? '';
      const segments = tail.split('>');
      const title = segments[segments.length - 1]?.trim();
      if (!title) {
        continue;
      }
      titles.add(title.replace(/\s+/g, ' '));
    }

    return Array.from(titles);
  }

  private async copyGradingResults(
    gradingDir: string,
    targetDir: string,
    workspaceArchive: string
  ): Promise<string | undefined> {
    const source = join(gradingDir, 'workspace', 'results');
    if (!existsSync(source)) {
      return undefined;
    }

    const destination = join(targetDir, 'results');
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true });
    console.log(`  → Copied grading results to ${destination}`);
    const workspaceResults = join(workspaceArchive, 'results');
    await rm(workspaceResults, { recursive: true, force: true });
    await cp(source, workspaceResults, { recursive: true });
    return destination;
  }

  private async promotePassArtifacts(pass: PassExecutionRecord, archivePath: string): Promise<void> {
    const finalWorkspaceDir = join(archivePath, 'workspace');
    await rm(finalWorkspaceDir, { recursive: true, force: true });
    if (pass.workspaceArchive && existsSync(pass.workspaceArchive)) {
      await cp(pass.workspaceArchive, finalWorkspaceDir, { recursive: true });
      console.log(`  → Archived workspace to ${finalWorkspaceDir}`);
    }

    const finalPrompt = join(archivePath, 'prompt.md');
    const passPrompt = join(archivePath, 'passes', `pass-${pass.passNumber}`, 'prompt.md');
    if (existsSync(passPrompt)) {
      await copyFile(passPrompt, finalPrompt);
    }

    const finalResultsDir = join(archivePath, 'results');
    await rm(finalResultsDir, { recursive: true, force: true });
    if (pass.resultsArchive && existsSync(pass.resultsArchive)) {
      await cp(pass.resultsArchive, finalResultsDir, { recursive: true });
      console.log(`  → Copied grading results to ${finalResultsDir}`);
    }
  }

  private getRepoVersion(): string {
    const options = { cwd: this.repoRoot, stdio: 'pipe', encoding: 'utf8' as BufferEncoding };
    try {
      const described = execSync('git describe --tags --dirty', options).trim();
      if (described) {
        return described;
      }
    } catch {
      // ignore and fall through
    }
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', options).trim();
      const shortHash = execSync('git rev-parse --short HEAD', options).trim();
      const branchLabel = branch && branch !== 'HEAD' ? branch : 'main';
      return `${branchLabel || 'main'}@${shortHash}`;
    } catch {
      // ignore
    }
    return 'unknown';
  }
}

interface Args {
  eval?: string;
  config?: string;
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
        result.config = args[++i];
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
    const configIds = args.config === 'ALL' || !args.config
      ? (args.quick ? ['llxprt-synthetic-main'] : configManager.getDefaultConfigurations())
      : args.config.split(',');

    console.log(` RUNNING EVALUATIONS`);
    console.log(`   Evaluations: ${evalNames.join(', ')}`);
    console.log(`   Configurations: ${configIds.join(', ')}`);
    console.log(`   Total runs: ${evalNames.length * configIds.length}`);
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
