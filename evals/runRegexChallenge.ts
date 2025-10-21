import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, cp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

interface CommandResult {
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
}

interface EvalRunResult {
  profile: string;
  startedAt: string;
  finishedAt: string;
  runId: string;
  commands: CommandResult[];
  status: 'pass' | 'fail';
  workspaceArchive: string;
  taskSummaries?: Record<string, unknown>;
}

type ProfileConfig =
  | { name: string; kind: 'llxprt' }
  | { name: string; kind: 'codex' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const workspaceSource = path.join(rootDir, 'problems', 'regex-challenge', 'workspace');
const gradingDir = path.join(rootDir, 'grading', 'regex-challenge');
const resultsDir = path.join(__dirname, 'results');

const PROFILES: ProfileConfig[] = [
  { name: 'cerebrasqwen3', kind: 'llxprt' },
  { name: 'synthetic', kind: 'llxprt' },
  { name: 'codex', kind: 'codex' }
];

const REQUIRED_GRADE_COMMANDS = new Set([
  'workspace:lint',
  'workspace:test:public',
  'workspace:typecheck',
  'workspace:build',
  'grading:workspace-install',
  'grading:typecheck',
  'grading:test:hidden'
]);

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function installDependencies(dir: string): Promise<void> {
  const result = await runCommand('npm install', 'npm', ['install'], {
    cwd: dir,
    env: { ...process.env, CXXFLAGS: '--std=c++20' }
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to install dependencies in ${dir}. Exit code ${result.exitCode}. stderr: ${result.stderr}`
    );
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

async function copyWorkspace(source: string): Promise<string> {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'llxprt-regex-'));
  const target = path.join(tmpRoot, `workspace-${randomUUID()}`);
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
  return target;
}

async function syncWorkspaceForGrading(source: string): Promise<string> {
  const targetPath = path.join(gradingDir, 'workspace');
  await rm(targetPath, { recursive: true, force: true });
  await cp(source, targetPath, {
    recursive: true,
    filter: (srcPath) => {
      const segments = srcPath.split(path.sep);
      if (segments.includes('node_modules') || segments.includes('coverage')) {
        return false;
      }
      return true;
    }
  });
  return targetPath;
}

async function archiveWorkspace(source: string, destination: string): Promise<void> {
  await cp(source, destination, {
    recursive: true,
    filter: (srcPath) => {
      const segments = srcPath.split(path.sep);
      if (segments.includes('node_modules') || segments.includes('coverage')) {
        return false;
      }
      return true;
    }
  });
}

function collectTaskSummaries(resultsDirPath: string): Record<string, unknown> {
  const summaries: Record<string, unknown> = {};
  if (!fs.existsSync(resultsDirPath)) {
    return summaries;
  }
  const entries = fs.readdirSync(resultsDirPath);
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const filePath = path.join(resultsDirPath, entry);
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      summaries[entry.replace(/\.json$/, '')] = parsed;
    } catch (error) {
      summaries[entry.replace(/\.json$/, '')] = { error: String(error) };
    }
  }
  return summaries;
}

async function main(): Promise<void> {
  await ensureDir(resultsDir);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runResultsDir = path.join(resultsDir, `regex-challenge-${runId}`);
  await ensureDir(runResultsDir);

  const problemDescription = await readFile(path.join(workspaceSource, 'problem.md'), 'utf8');

  const prompt = [
    'You are enhancing a TypeScript regex utility toolkit.',
    'Implement the functions in validators.ts, transformations.ts, and puzzles.ts using regular expressions and helper logic per the brief below. Keep configs untouched, rely only on provided dependencies, and run lint/test/typecheck/build before finishing. Report any failures honestly.',
    'Problem context:',
    problemDescription
  ].join('\n\n');

  await installDependencies(gradingDir);

  const profileFilter = process.env.EVAL_PROFILE;
  const selectedProfiles = profileFilter
    ? PROFILES.filter((profile) => profile.name === profileFilter)
    : PROFILES;

  const results: EvalRunResult[] = [];

  for (const profile of selectedProfiles) {
    console.log(`\n=== Evaluating profile: ${profile.name} (${profile.kind}) ===`);
    const startedAt = new Date().toISOString();
    const workspaceCopy = await copyWorkspace(workspaceSource);
    const commandResults: CommandResult[] = [];

    const installResult = await runCommand('workspace:npm-install', 'npm', ['install'], {
      cwd: workspaceCopy,
      env: { ...process.env, CXXFLAGS: '--std=c++20' }
    });
    commandResults.push(installResult);
    if (installResult.exitCode !== 0) {
      console.error(`npm install failed for profile ${profile.name}. Skipping.`);
      results.push({
        profile: profile.name,
        startedAt,
        finishedAt: new Date().toISOString(),
        runId,
        commands: commandResults,
        status: 'fail',
        workspaceArchive: path.join(`results/regex-challenge-${runId}`, profile.name, 'workspace')
      });
      continue;
    }

    const agentCommand: CommandResult = profile.kind === 'llxprt'
      ? await runCommand('llxprt', 'llxprt', ['--profile-load', profile.name, '--yolo', '--prompt', prompt], {
          cwd: workspaceCopy
        })
      : await runCommand('codex', 'codex', ['exec', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', prompt], {
          cwd: workspaceCopy
        });
    commandResults.push(agentCommand);

    const workspaceCommands = [
      { name: 'workspace:lint', command: 'npm', args: ['run', 'lint'], cwd: workspaceCopy },
      { name: 'workspace:test:public', command: 'npm', args: ['run', 'test:public'], cwd: workspaceCopy },
      { name: 'workspace:typecheck', command: 'npm', args: ['run', 'typecheck'], cwd: workspaceCopy },
      { name: 'workspace:build', command: 'npm', args: ['run', 'build'], cwd: workspaceCopy }
    ];

    for (const cmd of workspaceCommands) {
      const result = await runCommand(cmd.name, cmd.command, cmd.args, { cwd: cmd.cwd });
      commandResults.push(result);
      if (result.exitCode !== 0) {
        console.warn(`Command "${cmd.name}" failed for profile ${profile.name}.`);
      }
    }

    const gradingWorkspace = await syncWorkspaceForGrading(workspaceCopy);

    const gradingResultsDir = path.join(gradingDir, 'results');
    await rm(gradingResultsDir, { recursive: true, force: true });
    await mkdir(gradingResultsDir, { recursive: true });

    const workspaceInstall = await runCommand(
      'grading:workspace-install',
      'npm',
      ['install'],
      { cwd: gradingWorkspace, env: { ...process.env, CXXFLAGS: '--std=c++20' } }
    );
    commandResults.push(workspaceInstall);
    if (workspaceInstall.exitCode !== 0) {
      console.warn(`Workspace npm install failed for profile ${profile.name}.`);
    }

    const gradingCommands = [
      { name: 'grading:typecheck', command: 'npm', args: ['run', 'typecheck'], cwd: gradingDir },
      { name: 'grading:test:hidden', command: 'npm', args: ['run', 'test:hidden'], cwd: gradingDir }
    ];

    for (const cmd of gradingCommands) {
      const result = await runCommand(cmd.name, cmd.command, cmd.args, { cwd: cmd.cwd });
      commandResults.push(result);
      if (result.exitCode !== 0) {
        console.warn(`Command "${cmd.name}" failed for profile ${profile.name}.`);
      }
    }

    const profileDir = path.join(runResultsDir, profile.name);
    await ensureDir(profileDir);
    const archivePath = path.join(profileDir, 'workspace');
    await archiveWorkspace(workspaceCopy, archivePath);

    const commandsLogPath = path.join(profileDir, 'commands.json');
    await writeFile(commandsLogPath, JSON.stringify(commandResults, null, 2), 'utf8');

    const taskSummaries = collectTaskSummaries(path.join(gradingDir, 'results'));
    const gradeSuccess = commandResults
      .filter((command) => REQUIRED_GRADE_COMMANDS.has(command.name))
      .every((command) => command.exitCode === 0);

    const finishedAt = new Date().toISOString();
    results.push({
      profile: profile.name,
      startedAt,
      finishedAt,
      runId,
      commands: commandResults,
      status: gradeSuccess ? 'pass' : 'fail',
      workspaceArchive: path.relative(rootDir, archivePath),
      taskSummaries
    });

    console.log(
      `Profile ${profile.name} status: ${gradeSuccess ? 'PASS' : 'FAIL'} (workspace archived at ${path.relative(rootDir, archivePath)})`
    );
  }

  await rm(path.join(gradingDir, 'workspace'), { recursive: true, force: true });

  const summaryPath = path.join(runResultsDir, 'summary.json');
  await writeFile(summaryPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nEvaluation complete. Summary written to ${path.relative(rootDir, summaryPath)}`);
}

main().catch((error) => {
  console.error('Evaluation run failed:', error);
  process.exitCode = 1;
});
