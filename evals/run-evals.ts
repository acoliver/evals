#!/usr/bin/env ts-node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { copyFile, readdir, readFile, writeFile, rm, cp, mkdtemp } from 'fs/promises';
import { resolve, join, basename } from 'path';
import { spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { VybesScoringEngine, VybesResult, VybesTaskConfig } from './vybes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Configuration {
  cli: string;
  name: string;
  description?: string;
  args: string[];
  timeout: number;
}

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
    const args = [...config.args];
    
    return await this.runCommand(config.cli, args, { 
      cwd, 
      timeout: config.timeout,
      input: promptContent
    });
  }

  async runCommandByName(commandName: string, cwd: string): Promise<CommandResult> {
    const commandDef = this.commandRegistry[commandName];
    if (!commandDef) {
      throw new Error(`Command not found: ${commandName}. Available: ${Object.keys(this.commandRegistry).join(', ')}`);
    }
    
    return await this.runCommand(commandDef.command, commandDef.args, {
      cwd,
      timeout: commandDef.timeout
    });
  }

  private async runCommand(command: string, args: string[], options: { cwd: string; timeout: number; input?: string }): Promise<CommandResult> {
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
      command: `${command} ${args.join(' ')}`,
      cwd: options.cwd,
      exitCode,
      stdout,
      stderr,
      duration
    };
  }
}

interface CommandResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
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
  archivePath: string;
  vybesScore?: VybesResult;
  repoVersion?: string;
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
    
    const results: {
      evalName: string;
      configId: string;
      startedAt: string;
      finishedAt: string;
      status: string;
      totalDuration: number;
      commands: Array<{
        name: string;
        command: string;
        cwd: string;
        exitCode: number;
        stdout: string;
        stderr: string;
        duration: number;
        success: boolean;
      }>;
      workspaceArchive: string;
      repoVersion?: string;
      vybes?: VybesResult;
    } = {
      evalName,
      configId,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: result.success ? 'pass' : 'fail',
      totalDuration: result.totalDuration,
      commands: [result.cliResult, ...result.buildResults, ...result.gradeResults].map(cmd => ({
        name: cmd.command.split(' ')[0],
        command: cmd.command,
        cwd: cmd.cwd,
        exitCode: cmd.exitCode,
        stdout: cmd.stdout,
        stderr: cmd.stderr,
        duration: cmd.duration,
        success: cmd.exitCode === 0
      })),
      workspaceArchive: result.archivePath,
      repoVersion: result.repoVersion
    };

    if (result.vybesScore) {
      results.vybes = result.vybesScore;
    }

    await writeFile(resultsFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`  → Results saved to ${resultsFile}`);
    
    return resultsPath;
  }
}

class UnifiedRunner {
  private configManager: ConfigurationManager;
  private evalLoader: EvaluationLoader;
  private workspaceManager: WorkspaceManager;
  private resultsManager: ResultsManager;
  private vybesEngine: VybesScoringEngine;
  private repoRoot: string;

  constructor() {
    this.configManager = new ConfigurationManager();
    this.evalLoader = new EvaluationLoader();
    this.workspaceManager = new WorkspaceManager();
    this.resultsManager = new ResultsManager();
    this.vybesEngine = new VybesScoringEngine();
    this.repoRoot = resolve(__dirname, '..');
  }

  async runEvaluation(evalName: string, configId: string): Promise<EvalResult> {
    console.log(`\n STARTED: ${evalName} + ${configId}`);
    
    const start = Date.now();
    const evalConfig = this.evalLoader.getEvaluation(evalName);
    const repoVersion = this.getRepoVersion();

    // Create archive directory for this run
    const archivePath = this.resultsManager.createRunDirectory(evalName, configId);

    // Create temporary workspace in same directory (like old scripts)
    const workspace = await this.workspaceManager.createWorkspace(evalConfig.workspace);
    console.log(`   Workspace: ${workspace}`);

    try {
      // Write prompt
      await this.writePrompt(workspace, evalConfig.prompt);
      console.log(`   Prompt written`);

      // Run CLI configuration
      console.log(`   Running ${configId}`);
      const cliResult = await this.configManager.runConfiguration(
        configId, 
        'Execute the instructions in ./prompt.md',
        workspace
      );
      console.log(`  [OK] CLI completed (${cliResult.duration}ms, exit: ${cliResult.exitCode})`);

      // Run build steps
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

      // Sync completed workspace to grading directory
      console.log(`   Syncing workspace for grading`);
      await this.workspaceManager.syncWorkspaceForGrading(workspace, evalConfig.grading);

      // Run grade steps
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

      const totalDuration = Date.now() - start;
      const success = cliResult.exitCode === 0 && 
                     buildResults.every(r => r.exitCode === 0) && 
                     gradeResults.every(r => r.exitCode === 0);

      // Archive workspace and save results
      const finalArchivePath = await this.workspaceManager.archiveWorkspace(workspace, archivePath);

      const gradingResultsSource = join(evalConfig.grading, 'workspace', 'results');
      if (existsSync(gradingResultsSource)) {
        const gradingResultsDestination = join(finalArchivePath, 'results');
        await cp(gradingResultsSource, gradingResultsDestination, { recursive: true });
        console.log(`  → Copied grading results to ${gradingResultsDestination}`);
      }

      let vybesScore: VybesResult | undefined;
      try {
        vybesScore = this.vybesEngine.calculate({
          evalName,
          configId,
          providedConfig: evalConfig.vybes,
          archivePath: finalArchivePath,
          cliResult,
          buildResults,
          gradeResults,
          overallSuccess: success
        });
        if (vybesScore) {
          vybesScore.repoVersion = repoVersion;
          const scorePercent = (vybesScore.successPercentage * 100).toFixed(1);
          console.log(`  → Vybes score: ${vybesScore.finalScore.toFixed(2)} (${scorePercent}% success, penalty ${vybesScore.timePenaltyMultiplier.toFixed(2)})`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`  [WARN] Failed to calculate vybes score: ${message}`);
      }

      await this.resultsManager.saveResults(evalName, configId, {
        evalName,
        configId,
        workspace,
        grading: evalConfig.grading,
        cliResult,
        buildResults,
        gradeResults,
        success,
        totalDuration,
        archivePath: finalArchivePath,
        vybesScore,
        repoVersion
      });

      return {
        evalName,
        configId,
        workspace,
        grading: evalConfig.grading,
        cliResult,
        buildResults,
        gradeResults,
        success,
        totalDuration,
        archivePath: finalArchivePath,
        vybesScore,
        repoVersion
      };

    } finally {
      // Cleanup workspace
      this.workspaceManager.cleanup(workspace);
      console.log(`   Cleaned up workspace`);
    }
  }

  private async writePrompt(workspace: string, promptFile: string): Promise<void> {
    const promptsRoot = resolve(__dirname, '..', 'prompts');
    const problemPrompt = await readFile(join(promptsRoot, 'problems', promptFile), 'utf8');
    const problemDescription = await readFile(join(workspace, 'problem.md'), 'utf8');
    const sharedInstructions = await readFile(join(promptsRoot, 'shared/evaluation-instructions.md'), 'utf8');

    const prompt = [problemPrompt, problemDescription, sharedInstructions].join('\n\n');
    await writeFile(join(workspace, 'prompt.md'), prompt, 'utf8');
  }

  async runMultipleEvaluations(evalNames: string[], configIds: string[]): Promise<EvalResult[]> {
    const results: EvalResult[] = [];
    
    for (const evalName of evalNames) {
      for (const configId of configIds) {
        try {
          const result = await this.runEvaluation(evalName, configId);
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
    }
  }

  return result;
}

async function main() {
  try {
    const args = parseArgs();
    const runner = new UnifiedRunner();
    const configManager = new ConfigurationManager();
    const evalLoader = new EvaluationLoader();

    // Determine which evaluations to run
    const evalNames = args.eval === 'ALL' || !args.eval 
      ? evalLoader.getAllEvaluations()
      : args.eval.split(',');

    // Determine which configurations to run
    const configIds = args.config === 'ALL' || !args.config
      ? (args.quick ? ['llxprt-synthetic-glm4.6-temp1'] : configManager.getDefaultConfigurations())
      : args.config.split(',');

    console.log(` RUNNING EVALUATIONS`);
    console.log(`   Evaluations: ${evalNames.join(', ')}`);
    console.log(`   Configurations: ${configIds.join(', ')}`);
    console.log(`   Total runs: ${evalNames.length * configIds.length}`);

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
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n FATAL ERROR:`);
    console.error(`   ${error}`);
    process.exit(1);
  }
}

main();
