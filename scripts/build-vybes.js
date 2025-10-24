import { promises as fs } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const outputsRoot = join(repoRoot, 'outputs');
const publicRoot = join(repoRoot, 'public');
const stylesheetSource = join(repoRoot, 'vybestack.css');
const stylesheetTarget = join(publicRoot, 'vybestack.css');

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
  if (await pathExists(stylesheetSource)) {
    await fs.copyFile(stylesheetSource, stylesheetTarget);
  }
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

      runs.push({
        evalName: data.evalName,
        configId: data.configId,
        runId,
        date,
        finishedAt,
        vybes: data.vybes,
        workspaceArchive: relativeWorkspace.replace(/\\/g, '/')
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
      byDate.set(dateKey, new Map());
    }
    const dayProfiles = byDate.get(dateKey);

    if (!dayProfiles.has(run.configId)) {
      dayProfiles.set(run.configId, {
        runs: [],
        totalVybes: 0,
        totalSuccess: 0,
        totalPenalty: 0
      });
    }
    const profileStats = dayProfiles.get(run.configId);
    profileStats.runs.push(run);
    profileStats.totalVybes += run.vybes.finalScore ?? 0;
    profileStats.totalSuccess += run.vybes.successPercentage ?? 0;
    profileStats.totalPenalty += run.vybes.timePenaltyMultiplier ?? 0;
  }

  const summaries = [];
  for (const [date, profileMap] of byDate.entries()) {
    const profiles = {};
    for (const [configId, stats] of profileMap.entries()) {
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
          : null
      };
    }
    summaries.push({ date, profiles });
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
