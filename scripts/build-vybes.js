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
const cyclesPath = join(publicRoot, 'vybes-run-cycles.json');

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

function summarizeMultipass(rawMultipass, vybes) {
  if (!rawMultipass || rawMultipass.enabled === false) {
    return null;
  }

  const passes = Array.isArray(rawMultipass.passes) ? rawMultipass.passes : [];
  const clampIndex = (index) => {
    if (!passes.length) {
      return 0;
    }
    if (!Number.isInteger(index)) {
      return passes.length - 1;
    }
    return Math.min(Math.max(index, 0), passes.length - 1);
  };

  const selectedIndex = clampIndex(rawMultipass.selectedPass ?? passes.length - 1);
  const selected = passes[selectedIndex] ?? null;
  const bestSuccess = passes.reduce((max, pass) => {
    if (!pass) {
      return max;
    }
    const pct =
      (pass.vybes && typeof pass.vybes.successPercentage === 'number'
        ? pass.vybes.successPercentage
        : pass.success
        ? 1
        : 0);
    return Math.max(max, pct);
  }, 0);

  const finalSuccess = selected
    ? selected.vybes?.successPercentage ?? (selected.success ? 1 : 0)
    : 0;

  const passSummaries = passes.map((pass) => ({
    passNumber: pass?.passNumber ?? 0,
    success: !!pass?.success,
    partialSuccess: !!pass?.partialSuccess,
    successPercentage:
      pass?.vybes?.successPercentage ?? (pass?.success ? 1 : 0),
    finalScore: pass?.vybes?.finalScore ?? null,
    rawScore: pass?.vybes?.rawScore ?? null,
    timePenaltyMultiplier: pass?.vybes?.timePenaltyMultiplier ?? null,
    appliedFeedback: Array.isArray(pass?.appliedFeedback)
      ? pass.appliedFeedback
      : [],
    publicTestFailures: Array.isArray(pass?.publicTestFailures)
      ? pass.publicTestFailures
      : [],
    hiddenTestFailures: Array.isArray(pass?.hiddenTestFailures)
      ? pass.hiddenTestFailures
      : [],
    durationMs: pass?.totalDuration ?? null
  }));

  return {
    enabled: true,
    maxPasses: rawMultipass.maxPasses ?? passes.length,
    passCount: passes.length,
    selectedPass: selectedIndex,
    totalCliDurationMs:
      rawMultipass.totalCliDuration ?? vybes?.totalCliDurationMs ?? null,
    feedback: Array.isArray(rawMultipass.feedback) ? rawMultipass.feedback : [],
    passes: passSummaries,
    partialBest: passes.length > 0 && selectedIndex < passes.length - 1,
    bestSuccessPercentage: bestSuccess,
    finalSuccessPercentage: finalSuccess,
    timePenalized: (vybes?.timePenaltyMultiplier ?? 1) < 1
  };
}

async function loadExistingRuns() {
  if (!(await pathExists(runsPath))) {
    return [];
  }
  try {
    const raw = await fs.readFile(runsPath, 'utf8');
    if (!raw.trim()) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function collectRunsFromOutputs() {
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
      const configBasePath = join(evalPath, configDir.name);
      const workspacePath = join(configBasePath, 'workspace');
      const resultsPath = (await pathExists(join(workspacePath, 'results.json')))
        ? join(workspacePath, 'results.json')
        : join(configBasePath, 'results.json');
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
      const workspaceZip = await ensureWorkspaceZip(runId, configDir.name, (await pathExists(workspacePath)) ? workspacePath : configBasePath);

      const cliCommand = Array.isArray(data.commands) && data.commands.length ? data.commands[0]?.command ?? null : null;
      const multipassSummary = summarizeMultipass(data.multipass, data.vybes);

      runs.push({
        evalName: data.evalName,
        configId: data.configId,
        runId,
        date,
        finishedAt,
        repoVersion,
        vybes: data.vybes,
        multipass: multipassSummary,
        passCount: multipassSummary?.passCount ?? 1,
        passes: multipassSummary?.passCount ?? 1,
        selectedPass: multipassSummary?.selectedPass ?? null,
        partialBest: multipassSummary?.partialBest ?? false,
        timePenalized:
          multipassSummary?.timePenalized ?? (data.vybes?.timePenaltyMultiplier ?? 1) < 1,
        bestSuccessPercentage:
          multipassSummary?.bestSuccessPercentage ?? data.vybes?.successPercentage ?? null,
        finalSuccessPercentage:
          multipassSummary?.finalSuccessPercentage ?? data.vybes?.successPercentage ?? null,
        workspaceArchive: relativeWorkspace.replace(/\\/g, '/'),
        workspaceZip,
        runSessionId: data.runSessionId ?? null,
        runSessionStartedAt: data.runSessionStartedAt ?? null,
        cliCommand
      });
    }
  }

  return runs;
}

function sortRuns(runs) {
  runs.sort((a, b) => {
    const aTime = a.finishedAt ? Date.parse(a.finishedAt) : Infinity;
    const bTime = b.finishedAt ? Date.parse(b.finishedAt) : Infinity;
    return aTime - bTime;
  });
  return runs;
}

function mergeRuns(existingRuns = [], newRuns = []) {
  const merged = new Map();
  const keyFor = (run) => `${run.runId ?? 'unknown'}::${run.configId ?? 'unknown'}`;

  for (const run of existingRuns) {
    if (run && run.runId && run.configId) {
      merged.set(keyFor(run), run);
    }
  }

  for (const run of newRuns) {
    if (!run || !run.runId || !run.configId) continue;
    merged.set(keyFor(run), run);
  }

  return sortRuns(Array.from(merged.values()));
}

function buildRunCycles(runs) {
  const sessions = new Map();

  const ensureSession = (run) => {
    const key = run.runSessionId || `legacy-${run.runId}-${run.configId}`;
    if (!sessions.has(key)) {
      sessions.set(key, {
        sessionId: key,
        repoVersions: new Set(),
        scenarios: [],
        perConfig: new Map(),
        totalVybes: 0,
        totalMinutes: 0,
        totalPasses: 0,
        partialBestRuns: 0,
        timePenalizedRuns: 0,
        startedAt: run.runSessionStartedAt || run.finishedAt || null,
        finishedAt: run.finishedAt || null,
        date: run.date ?? (run.finishedAt ? run.finishedAt.slice(0, 10) : null)
      });
    }
    return sessions.get(key);
  };

  for (const run of runs) {
    const session = ensureSession(run);
    session.scenarios.push(run);
    session.repoVersions.add(run.repoVersion);
    session.totalVybes += run.vybes?.finalScore ?? 0;
    session.totalMinutes += run.vybes?.actualTimeMinutes ?? 0;
    const runPassCount = run.passCount ?? 1;
    session.totalPasses += runPassCount;
    if (run.partialBest) {
      session.partialBestRuns += 1;
    }
    if (run.timePenalized) {
      session.timePenalizedRuns += 1;
    }
    if (!session.startedAt || (run.runSessionStartedAt && run.runSessionStartedAt < session.startedAt)) {
      session.startedAt = run.runSessionStartedAt ?? session.startedAt;
    }
    if (!session.finishedAt || (run.finishedAt && run.finishedAt > session.finishedAt)) {
      session.finishedAt = run.finishedAt;
    }
    if (!session.date && session.finishedAt) {
      session.date = session.finishedAt.slice(0, 10);
    }

    const stats =
      session.perConfig.get(run.configId) || {
        runs: 0,
        totalVybes: 0,
        totalSuccess: 0,
        totalPenalty: 0,
        penaltyCount: 0,
        totalRawVybes: 0,
        totalPasses: 0,
        partialBestRuns: 0,
        timePenalizedRuns: 0,
        bestRun: null,
        worstRun: null
      };
    const score = run.vybes?.finalScore ?? 0;
    const rawScore = run.vybes ? (run.vybes.baseScore ?? 0) * (run.vybes.successPercentage ?? 0) : 0;
    stats.runs += 1;
    stats.totalVybes += score;
    stats.totalSuccess += run.vybes?.successPercentage ?? 0;
    if (score > 0) {
      stats.totalPenalty += run.vybes?.timePenaltyMultiplier ?? 0;
      stats.penaltyCount += 1;
    }
    stats.totalRawVybes += rawScore;
    stats.totalPasses += runPassCount;
    if (run.partialBest) {
      stats.partialBestRuns += 1;
    }
    if (run.timePenalized) {
      stats.timePenalizedRuns += 1;
    }

    if (!stats.bestRun || score > stats.bestRun.score) {
      stats.bestRun = {
        eval: run.evalName,
        score
      };
    }
    if (!stats.worstRun || score < stats.worstRun.score) {
      stats.worstRun = {
        eval: run.evalName,
        score
      };
    }
    session.perConfig.set(run.configId, stats);

    if (run.vybes) {
      run.rawVybes = Number(rawScore.toFixed(2));
    } else {
      run.rawVybes = 0;
    }
  }

  const toFixed = (value, digits = 2) => Number(value.toFixed(digits));

  return Array.from(sessions.values())
    .map((session) => {
      const perConfigStats = {};
      session.perConfig.forEach((stats, configId) => {
        perConfigStats[configId] = {
          runs: stats.runs,
          totalVybes: toFixed(stats.totalVybes),
          avgVybes: toFixed(stats.totalVybes / stats.runs),
          avgSuccess: toFixed(stats.totalSuccess / stats.runs, 4),
          penaltySum: toFixed(stats.totalPenalty),
          penaltyCount: stats.penaltyCount,
          avgPenalty: stats.penaltyCount ? toFixed(stats.totalPenalty / stats.penaltyCount, 4) : 0,
          totalRawVybes: toFixed(stats.totalRawVybes),
          avgRawVybes: toFixed(stats.totalRawVybes / stats.runs),
          totalPasses: stats.totalPasses,
          avgPasses: stats.totalPasses ? toFixed(stats.totalPasses / stats.runs, 2) : 0,
          partialBestRuns: stats.partialBestRuns,
          timePenalizedRuns: stats.timePenalizedRuns,
          bestRun: stats.bestRun,
          worstRun: stats.worstRun
        };
      });

      return {
        sessionId: session.sessionId,
        date: session.date ?? 'unknown',
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        repoVersions: Array.from(session.repoVersions),
        totalVybes: toFixed(session.totalVybes),
        totalMinutes: toFixed(session.totalMinutes),
        totalPasses: session.totalPasses,
        avgPasses: session.scenarios.length ? toFixed(session.totalPasses / session.scenarios.length, 2) : 0,
        partialBestRuns: session.partialBestRuns,
        timePenalizedRuns: session.timePenalizedRuns,
        configs: Object.keys(perConfigStats),
        perConfigStats,
        scenarios: session.scenarios
      };
    })
    .sort((a, b) => {
      const aTime = a.finishedAt ? Date.parse(a.finishedAt) : -Infinity;
      const bTime = b.finishedAt ? Date.parse(b.finishedAt) : -Infinity;
      return bTime - aTime;
    });
}

function toDaily(runs, runCycles) {
  const byDate = new Map();

  const ensureBucket = (dateKey) => {
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        scenarioRuns: [],
        runCycles: [],
        profiles: new Map(),
        summary: {
          totalRuns: 0,
          totalMinutes: 0,
          totalVybes: 0,
          totalPasses: 0,
          partialBestRuns: 0,
          timePenalizedRuns: 0,
          profiles: new Set(),
          repoVersions: new Set()
        }
      });
    }
    return byDate.get(dateKey);
  };

  const ensureProfile = (bucket, configId) => {
    if (!bucket.profiles.has(configId)) {
      bucket.profiles.set(configId, {
        scenarioCount: 0,
        cycleCount: 0,
        totalVybes: 0,
        totalRawVybes: 0,
        successSum: 0,
        penaltySum: 0,
        penaltyCount: 0,
        totalPasses: 0,
        partialBestRuns: 0,
        timePenalizedRuns: 0,
        bestScenario: null,
        worstScenario: null,
        repoVersions: new Set()
      });
    }
    return bucket.profiles.get(configId);
  };

  const toFixed = (value, digits = 2) => Number(value.toFixed(digits));

  for (const run of runs) {
    const dateKey = run.date ?? 'unknown';
    const bucket = ensureBucket(dateKey);
    bucket.scenarioRuns.push(run);

    const profileStats = ensureProfile(bucket, run.configId);
    profileStats.scenarioCount += 1;
    const score = run.vybes?.finalScore ?? 0;
    const candidate = {
      eval: run.evalName,
      score,
      runId: run.runId,
      sessionId: run.runSessionId ?? null
    };
    if (!profileStats.bestScenario || score > profileStats.bestScenario.score) {
      profileStats.bestScenario = candidate;
    }
    if (!profileStats.worstScenario || score < profileStats.worstScenario.score) {
      profileStats.worstScenario = candidate;
    }
    if (run.repoVersion) {
      profileStats.repoVersions.add(run.repoVersion);
    }
  }

  for (const cycle of runCycles) {
    const dateKey = cycle.date ?? 'unknown';
    const bucket = ensureBucket(dateKey);
    bucket.runCycles.push(cycle);

    bucket.summary.totalRuns += 1;
    bucket.summary.totalMinutes += cycle.totalMinutes ?? 0;
    bucket.summary.totalVybes += cycle.totalVybes ?? 0;
    bucket.summary.totalPasses += cycle.totalPasses ?? 0;
    bucket.summary.partialBestRuns += cycle.partialBestRuns ?? 0;
    bucket.summary.timePenalizedRuns += cycle.timePenalizedRuns ?? 0;
    (cycle.configs ?? []).forEach((configId) => bucket.summary.profiles.add(configId));
    (cycle.repoVersions ?? []).forEach((version) => bucket.summary.repoVersions.add(version));

    for (const configId of cycle.configs ?? []) {
      const profileStats = ensureProfile(bucket, configId);
      profileStats.cycleCount += 1;
      const configMetrics = cycle.perConfigStats?.[configId];
      if (configMetrics) {
        profileStats.totalVybes += configMetrics.totalVybes ?? 0;
        profileStats.totalRawVybes += configMetrics.totalRawVybes ?? 0;
        profileStats.successSum += configMetrics.avgSuccess ?? 0;
        profileStats.penaltySum += configMetrics.penaltySum ?? 0;
        profileStats.penaltyCount += configMetrics.penaltyCount ?? 0;
        profileStats.totalPasses += configMetrics.totalPasses ?? 0;
        profileStats.partialBestRuns += configMetrics.partialBestRuns ?? 0;
        profileStats.timePenalizedRuns += configMetrics.timePenalizedRuns ?? 0;
      }
      (cycle.repoVersions ?? []).forEach((version) => profileStats.repoVersions.add(version));
    }
  }

  const summaries = [];
  for (const [date, bucket] of byDate.entries()) {
    const profiles = {};
    bucket.profiles.forEach((stats, configId) => {
      const runsCount = stats.cycleCount;
      profiles[configId] = {
        runs: runsCount,
        evals: stats.scenarioCount,
        totalVybes: toFixed(stats.totalVybes),
        avgVybes: runsCount ? toFixed(stats.totalVybes / runsCount) : 0,
        totalRawVybes: toFixed(stats.totalRawVybes),
        avgRawVybes: runsCount ? toFixed(stats.totalRawVybes / runsCount) : 0,
        avgSuccess: runsCount ? toFixed(stats.successSum / runsCount, 4) : 0,
        avgPenalty: stats.penaltyCount ? toFixed(stats.penaltySum / stats.penaltyCount, 4) : 0,
        totalPasses: stats.totalPasses,
        avgPasses: runsCount ? toFixed(stats.totalPasses / runsCount, 2) : 0,
        partialBestRuns: stats.partialBestRuns,
        timePenalizedRuns: stats.timePenalizedRuns,
        bestRun: stats.bestScenario,
        worstRun: stats.worstScenario,
        repoVersions: Array.from(stats.repoVersions)
      };
    });

    summaries.push({
      date,
      runCycles: bucket.runCycles.sort((a, b) => {
        const aTime = a.finishedAt ? Date.parse(a.finishedAt) : -Infinity;
        const bTime = b.finishedAt ? Date.parse(b.finishedAt) : -Infinity;
        return bTime - aTime;
      }),
      summary: {
        totalRuns: bucket.summary.totalRuns,
        totalMinutes: toFixed(bucket.summary.totalMinutes),
        totalVybes: toFixed(bucket.summary.totalVybes),
        totalPasses: bucket.summary.totalPasses,
        avgPasses: bucket.summary.totalRuns
          ? toFixed(bucket.summary.totalPasses / bucket.summary.totalRuns, 2)
          : 0,
        partialBestRuns: bucket.summary.partialBestRuns,
        timePenalizedRuns: bucket.summary.timePenalizedRuns,
        avgVybes: bucket.summary.totalRuns ? toFixed(bucket.summary.totalVybes / bucket.summary.totalRuns) : 0,
        profiles: Array.from(bucket.summary.profiles),
        repoVersions: Array.from(bucket.summary.repoVersions)
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
  const [existingRuns, newRuns] = await Promise.all([
    loadExistingRuns(),
    collectRunsFromOutputs()
  ]);

  const mergedRuns = mergeRuns(existingRuns, newRuns);
  const runCycles = buildRunCycles(mergedRuns);
  await writeJSON(runsPath, mergedRuns);
  await writeJSON(cyclesPath, runCycles);
  const daily = toDaily(mergedRuns, runCycles);
  await writeJSON(dailyPath, daily);

  console.log(`Generated ${mergedRuns.length} runs → ${runsPath}`);
  console.log(`Generated ${daily.length} daily summaries → ${dailyPath}`);
}

main().catch((error) => {
  console.error('Failed to build vybes aggregates:', error);
  process.exit(1);
});
