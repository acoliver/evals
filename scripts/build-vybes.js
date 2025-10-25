import { promises as fs, createWriteStream } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const outputsRoot = join(repoRoot, 'outputs');
const publicRoot = join(repoRoot, 'public');
const stylesheetSource = join(repoRoot, 'vybestack.css');
const stylesheetTarget = join(publicRoot, 'vybestack.css');
const runsPublicRoot = join(publicRoot, 'runs');

const runsPath = join(publicRoot, 'vybes-runs.json');
const dailyPath = join(publicRoot, 'vybes-daily.json');

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensurePublicDir() {
  await fs.mkdir(publicRoot, { recursive: true });
  await fs.mkdir(runsPublicRoot, { recursive: true });
  if (await pathExists(stylesheetSource)) {
    await fs.copyFile(stylesheetSource, stylesheetTarget);
  }
}

function relativeToPublic(targetPath) {
  return relative(publicRoot, targetPath).replace(/\\/g, '/');
}

async function ensureWorkspaceZip(runId, configId, workspacePath) {
  const workspaceExists = await pathExists(workspacePath);
  if (!workspaceExists) {
    return null;
  }

  const targetDir = join(runsPublicRoot, runId, configId);
  const targetZip = join(targetDir, 'workspace.zip');
  await fs.mkdir(targetDir, { recursive: true });

  const [workspaceStat, zipExists] = await Promise.all([
    fs.stat(workspacePath),
    pathExists(targetZip)
  ]);

  if (zipExists) {
    const zipStat = await fs.stat(targetZip);
    if (zipStat.mtimeMs >= workspaceStat.mtimeMs && zipStat.size > 0) {
      return {
        path: relativeToPublic(targetZip),
        size: zipStat.size
      };
    }
  }

  await new Promise((resolve, reject) => {
    const output = createWriteStream(targetZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(workspacePath, false);
    archive.finalize();
  });

  const { size } = await fs.stat(targetZip);
  return {
    path: relativeToPublic(targetZip),
    size
  };
}

async function collectRuns() {
  const runs = [];

  if (!(await pathExists(outputsRoot))) {
    return runs;
  }

  const evalDirs = await fs.readdir(outputsRoot, { withFileTypes: true });
  for (const evalDir of evalDirs) {
    if (!evalDir.isDirectory()) continue;
    const evalPath = join(outputsRoot, evalDir.name);

    const configDirs = await fs.readdir(evalPath, { withFileTypes: true });
    for (const configDir of configDirs) {
      if (!configDir.isDirectory()) continue;
      const workspacePath = join(evalPath, configDir.name, 'workspace');
      const resultsPath = join(workspacePath, 'results.json');
      if (!(await pathExists(resultsPath))) continue;

      let data;
      try {
        const raw = await fs.readFile(resultsPath, 'utf8');
        data = JSON.parse(raw);
      } catch (error) {
        console.warn(`Skipping malformed results: ${resultsPath}`, error);
        continue;
      }

      if (!data?.vybes) continue;

      const finishedAt = data.finishedAt ?? data.startedAt ?? null;
      const date = finishedAt ? finishedAt.slice(0, 10) : null;

      const runId = evalDir.name;
      const relativeWorkspace = relative(repoRoot, data.workspaceArchive ?? workspacePath);
      const repoVersion = data.vybes?.repoVersion ?? data.repoVersion ?? 'unknown';
      const workspaceZip = await ensureWorkspaceZip(runId, configDir.name, workspacePath);

      runs.push({
        evalName: data.evalName,
        configId: data.configId,
        runId,
        date,
        finishedAt,
        repoVersion,
        vybes: data.vybes,
        workspaceArchive: relativeWorkspace.replace(/\\/g, '/'),
        workspaceZip
      });
    }
  }

  runs.sort((a, b) => {
    const aTime = a.finishedAt ? Date.parse(a.finishedAt) : Infinity;
    const bTime = b.finishedAt ? Date.parse(b.finishedAt) : Infinity;
    return aTime - bTime;
  });

  return runs;
}

function toDaily(runs) {
  const byDate = new Map();

  for (const run of runs) {
    const dateKey = run.date ?? 'unknown';
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        profiles: new Map(),
        runs: []
      });
    }
    const dayBucket = byDate.get(dateKey);
    dayBucket.runs.push(run);

    if (!dayBucket.profiles.has(run.configId)) {
      dayBucket.profiles.set(run.configId, {
        runs: [],
        totalVybes: 0,
        totalSuccess: 0,
        totalPenalty: 0,
        versions: new Set()
      });
    }
    const profileStats = dayBucket.profiles.get(run.configId);
    profileStats.runs.push(run);
    profileStats.totalVybes += run.vybes.finalScore ?? 0;
    profileStats.totalSuccess += run.vybes.successPercentage ?? 0;
    profileStats.totalPenalty += run.vybes.timePenaltyMultiplier ?? 0;
    if (run.repoVersion) {
      profileStats.versions.add(run.repoVersion);
    }
  }

  const summaries = [];
  for (const [date, bucket] of byDate.entries()) {
    const profiles = {};
    for (const [configId, stats] of bucket.profiles.entries()) {
      const sortedRuns = [...stats.runs].sort((a, b) => (b.vybes.finalScore ?? 0) - (a.vybes.finalScore ?? 0));
      const bestRun = sortedRuns[0];
      const worstRun = sortedRuns[sortedRuns.length - 1];
      const count = stats.runs.length;
      profiles[configId] = {
        runs: count,
        totalVybes: Number(stats.totalVybes.toFixed(2)),
        avgVybes: Number((stats.totalVybes / count).toFixed(2)),
        avgSuccess: Number((stats.totalSuccess / count).toFixed(4)),
        avgPenalty: Number((stats.totalPenalty / count).toFixed(4)),
        bestRun: bestRun
          ? {
              eval: bestRun.evalName,
              score: bestRun.vybes.finalScore ?? 0,
              runId: bestRun.runId
            }
          : null,
        worstRun: worstRun
          ? {
              eval: worstRun.evalName,
              score: worstRun.vybes.finalScore ?? 0,
              runId: worstRun.runId
            }
          : null,
        repoVersions: Array.from(stats.versions)
      };
    }

    const totalRuns = bucket.runs.length;
    const totalMinutes = bucket.runs.reduce((sum, run) => sum + (run.vybes.actualTimeMinutes ?? 0), 0);
    const totalVybes = bucket.runs.reduce((sum, run) => sum + (run.vybes.finalScore ?? 0), 0);
    const profileList = Array.from(bucket.profiles.keys());
    const versionList = Array.from(
      new Set(bucket.runs.map((run) => run.repoVersion).filter(Boolean))
    );

    summaries.push({
      date,
      summary: {
        totalRuns,
        totalMinutes: Number(totalMinutes.toFixed(2)),
        avgVybes: totalRuns ? Number((totalVybes / totalRuns).toFixed(2)) : 0,
        profiles: profileList,
        repoVersions: versionList
      },
      profiles
    });
  }

  summaries.sort((a, b) => (a.date > b.date ? 1 : -1));
  return summaries;
}

async function writeJSON(target, data) {
  await fs.writeFile(target, JSON.stringify(data, null, 2), 'utf8');
}

async function main() {
  await ensurePublicDir();
  const runs = await collectRuns();
  await writeJSON(runsPath, runs);
  const daily = toDaily(runs);
  await writeJSON(dailyPath, daily);

  console.log(`Generated ${runs.length} runs → ${runsPath}`);
  console.log(`Generated ${daily.length} daily summaries → ${dailyPath}`);
}

main().catch((error) => {
  console.error('Failed to build vybes aggregates:', error);
  process.exit(1);
});
