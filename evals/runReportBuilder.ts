import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, cp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

type CommandResult = {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  error?: string;
};

type EvalRunResult = {
  profile: string;
  startedAt: string;
  finishedAt: string;
  runId: string;
  commands: CommandResult[];
  status: 'pass' | 'fail';
  workspaceArchive: string;
  notes?: string;
};

type ProfileConfig =
  | {
      name: string;
      kind: 'llxprt';
    }
  | {
      name: string;
      kind: 'codex';
    };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const workspaceSource = path.join(rootDir, 'problems', 'report-builder', 'workspace');
const gradingDir = path.join(rootDir, 'grading', 'report-builder');
const resultsDir = path.join(__dirname, 'results');

const PROFILES: ProfileConfig[] = [
  { name: 'cerebrasqwen3', kind: 'llxprt' },
  { name: 'synthetic', kind: 'llxprt' },
  { name: 'codex', kind: 'codex' }
];
const REQUIRED_GRADE_COMMANDS = new Set([
  'workspace:typecheck',
  'workspace:lint',
  'workspace:test:public',
  'workspace:build',
  'grading:lint',
  'grading:typecheck',
  'grading:test:hidden'
]);

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function ensureDependencies(dir: string): Promise<void> {
  const nodeModules = path.join(dir, 'node_modules');
  try {
    await fs.promises.access(nodeModules, fs.constants.F_OK);
  } catch {
    const result = await runCommand('npm install', 'npm', ['install'], { cwd: dir });
    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to install dependencies in ${dir}. Exit code ${result.exitCode}. stderr: ${result.stderr}`
      );
    }
  }
}

function runCommand(
  name: string,
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv }
): Promise<CommandResult> {
  const start = performance.now();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  let errorMessage: string | undefined;

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  return new Promise<CommandResult>((resolve) => {
    child.on('error', (error) => {
      errorMessage = error.message;
    });

    child.on('close', (exitCode, signal) => {
      const durationMs = performance.now() - start;
      resolve({
        name,
        command,
        args,
        cwd: options.cwd,
        exitCode,
        signal,
        durationMs,
        stdout,
        stderr,
        error: errorMessage
      });
    });
  });
}

async function copyWorkspace(src: string): Promise<string> {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'llxprt-report-'));
  const target = path.join(tmpRoot, `workspace-${randomUUID()}`);
  await mkdir(target, { recursive: true });
  await cp(src, target, {
    recursive: true
  });
  return target;
}

async function syncWorkspaceForGrading(source: string): Promise<void> {
  const targetPath = path.join(gradingDir, 'workspace');
  await rm(targetPath, { recursive: true, force: true });
  await cp(source, targetPath, {
    recursive: true,
    filter: (src) => {
      const segments = src.split(path.sep);
      if (segments.includes('node_modules')) {
        return false;
      }
      if (segments.includes('coverage')) {
        return false;
      }
      return true;
    }
  });
}

async function archiveWorkspace(
  source: string,
  destination: string
): Promise<void> {
  await cp(source, destination, {
    recursive: true,
    filter: (src) => {
      const segments = src.split(path.sep);
      if (segments.includes('node_modules')) {
        return false;
      }
      if (segments.includes('coverage')) {
        return false;
      }
      return true;
    }
  });
}

async function main(): Promise<void> {
  await ensureDir(resultsDir);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runResultsDir = path.join(resultsDir, `report-builder-${runId}`);
  await ensureDir(runResultsDir);

  const problemDescription = await readFile(
    path.join(workspaceSource, 'problem.md'),
    'utf8'
  );

  const problemPrompt = await readFile(path.join(__dirname, '../prompts/problems/report-builder.md'), 'utf8');
  const sharedInstructions = await readFile(path.join(__dirname, '../prompts/shared/evaluation-instructions.md'), 'utf8');
  
  await ensureDependencies(gradingDir);

  const results: EvalRunResult[] = [];

  for (const profile of PROFILES) {
    console.log(`\\n=== Evaluating profile: ${profile.name} (${profile.kind}) ===`);
    const startedAt = new Date().toISOString();
    const workspaceCopy = await copyWorkspace(workspaceSource);
    const commandResults: CommandResult[] = [];

    // Write combined prompt to workspace
    const prompt = [problemPrompt, problemDescription, sharedInstructions].join('\\n\\n');
    await writeFile(path.join(workspaceCopy, 'prompt.md'), prompt, 'utf8');
    const modelInstruction = 'Execute the instructions in ./prompt.md';

    // Install workspace dependencies
    const installResult = await runCommand(
      'workspace:npm-install',
      'npm',
      ['install'],
      { cwd: workspaceCopy }
    );
    commandResults.push(installResult);
    if (installResult.exitCode !== 0) {
      console.error(
        `npm install failed for profile ${profile.name}. Skipping grading.`
      );
      results.push({
        profile: profile.name,
        startedAt,
        finishedAt: new Date().toISOString(),
        runId,
        commands: commandResults,
        status: 'fail',
        workspaceArchive: path.join(
          `results/report-builder-${runId}`,
          profile.name,
          'workspace'
        )
      });
      continue;
    }

    // Run llxprt agent
    let agentResult: CommandResult;
    if (profile.kind === 'llxprt') {
      agentResult = await runCommand(
        'llxprt',
        'llxprt',
        ['--profile-load', profile.name, '--yolo', '--prompt', modelInstruction],
        { cwd: workspaceCopy }
      );
    } else {
      agentResult = await runCommand('codex', 'codex', ['exec', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', modelInstruction], {
        cwd: workspaceCopy
      });
    }
    commandResults.push(agentResult);

    const workspaceCommands = [
      {
        name: 'workspace:lint',
        command: 'npm',
        args: ['run', 'lint'],
        cwd: workspaceCopy
      },
      {
        name: 'workspace:test:public',
        command: 'npm',
        args: ['run', 'test:public'],
        cwd: workspaceCopy
      },
      {
        name: 'workspace:typecheck',
        command: 'npm',
        args: ['run', 'typecheck'],
        cwd: workspaceCopy
      },
      {
        name: 'workspace:build',
        command: 'npm',
        args: ['run', 'build'],
        cwd: workspaceCopy
      }
    ];

    for (const cmd of workspaceCommands) {
      const result = await runCommand(cmd.name, cmd.command, cmd.args, {
        cwd: cmd.cwd
      });
      commandResults.push(result);
      if (result.exitCode !== 0) {
        console.warn(
          `Command "${cmd.name}" failed for profile ${profile.name} with exit code ${result.exitCode}.`
        );
      }
    }

    // Prepare grading workspace after workspace commands succeed
    await syncWorkspaceForGrading(workspaceCopy);

    const gradingCommands = [
      {
        name: 'grading:lint',
        command: 'npm',
        args: ['run', 'lint'],
        cwd: gradingDir
      },
      {
        name: 'grading:typecheck',
        command: 'npm',
        args: ['run', 'typecheck'],
        cwd: gradingDir
      },
      {
        name: 'grading:test:hidden',
        command: 'npm',
        args: ['run', 'test:hidden'],
        cwd: gradingDir
      }
    ];

    for (const cmd of gradingCommands) {
      const result = await runCommand(cmd.name, cmd.command, cmd.args, {
        cwd: cmd.cwd
      });
      commandResults.push(result);
      if (result.exitCode !== 0) {
        console.warn(
          `Command "${cmd.name}" failed for profile ${profile.name} with exit code ${result.exitCode}.`
        );
      }
    }

    // Archive workspace (without node_modules)
    const profileDir = path.join(runResultsDir, profile.name);
    await ensureDir(profileDir);
    const archivePath = path.join(profileDir, 'workspace');
    await archiveWorkspace(workspaceCopy, archivePath);

    // Persist command logs
    const commandsLogPath = path.join(profileDir, 'commands.json');
    await writeFile(
      commandsLogPath,
      JSON.stringify(commandResults, null, 2),
      'utf8'
    );

    const gradeSuccess = commandResults
      .filter((command) => REQUIRED_GRADE_COMMANDS.has(command.name))
      .every((command) => command.exitCode === 0);

    const finishedAt = new Date().toISOString();
    const runResult: EvalRunResult = {
      profile: profile.name,
      startedAt,
      finishedAt,
      runId,
      commands: commandResults,
      status: gradeSuccess ? 'pass' : 'fail',
      workspaceArchive: path.relative(rootDir, archivePath)
    };

    results.push(runResult);

    console.log(
      `Profile ${profile.name} status: ${runResult.status.toUpperCase()} (workspace archived at ${runResult.workspaceArchive})`
    );
  }

  // Clean up grading workspace link
  await rm(path.join(gradingDir, 'workspace'), { recursive: true, force: true });

  // Write summary
  const summaryPath = path.join(runResultsDir, 'summary.json');
  await writeFile(summaryPath, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\\nEvaluation complete. Summary written to ${path.relative(rootDir, summaryPath)}`);
}

main().catch((error) => {
  console.error('Evaluation run failed:', error);
  process.exitCode = 1;
});