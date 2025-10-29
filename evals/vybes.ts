import { existsSync, readdirSync, readFileSync } from 'fs';
import { extname, join } from 'path';

export interface VybesTaskConfig {
  multiplier: number;
  timeLimitMinutes: number;
  description?: string;
  category?: string;
}

export interface CommandSummary {
  command: string;
  exitCode: number;
  duration: number;
}

export interface VybesBreakdownModule {
  passed: number;
  total: number;
  passedTasks: string[];
  failedTasks: string[];
}

export interface VybesBreakdown {
  subtasksPassed: number;
  subtasksTotal: number;
  modulesCompleted: string[];
  modulesIncomplete: string[];
  modules: Record<string, VybesBreakdownModule>;
}

export type VybesStatus = 'ok' | 'cli_failed' | 'no_op' | 'error';

export interface VybesResult {
  taskName: string;
  configId: string;
  complexityMultiplier: number;
  timeLimitMinutes: number;
  baseScore: number;
  successPercentage: number;
  baselineSuccessPercentage: number;
  adjustedSuccessPercentage: number;
  timePenaltyMultiplier: number;
  finalScore: number;
  rawScore: number;
  actualTimeMinutes: number;
  description?: string;
  category?: string;
  breakdown?: VybesBreakdown;
  error?: string;
  repoVersion?: string;
  status?: VybesStatus;
  passesAttempted?: number;
  selectedPass?: number;
  totalCliDurationMs?: number;
}

export interface VybesScoringContext {
  evalName: string;
  configId: string;
  providedConfig?: VybesTaskConfig;
  archivePath: string;
  cliResult: CommandSummary;
  buildResults: CommandSummary[];
  gradeResults: CommandSummary[];
  overallSuccess: boolean;
  totalCliDuration?: number;
  passCount?: number;
  selectedPassIndex?: number;
}

type RawTaskResult = {
  taskId?: string;
  passed?: boolean;
};

const DEFAULT_CONFIGS: Record<string, VybesTaskConfig> = {
  'base64-fix': {
    multiplier: 1,
    timeLimitMinutes: 2,
    description: 'Base64 encoder/decoder utilities',
    category: 'utilities'
  },
  'regex-challenge': {
    multiplier: 3,
    timeLimitMinutes: 6,
    description: 'Regex validation and transformation toolkit',
    category: 'utilities'
  },
  'report-builder': {
    multiplier: 4,
    timeLimitMinutes: 8,
    description: 'Spreadsheet → HTML report rendering',
    category: 'integrations'
  },
  'form-capture': {
    multiplier: 5,
    timeLimitMinutes: 10,
    description: 'Full-stack contact form application',
    category: 'full-stack'
  },
  'pagination': {
    multiplier: 5,
    timeLimitMinutes: 10,
    description: 'Server + client pagination repair',
    category: 'full-stack'
  },
  'react-evaluation': {
    multiplier: 5,
    timeLimitMinutes: 10,
    description: 'Reactive programming primitives',
    category: 'foundations'
  }
};

const MIN_PENALTY = 0.2;
const BASELINE_SUCCESS: Record<string, number> = {
  'base64-fix': 16 / 18
};

export class VybesScoringEngine {
  private describeFailure(buildResults: CommandSummary[], gradeResults: CommandSummary[]): string | undefined {
    const failingCommand = [...buildResults, ...gradeResults].find((result) => result.exitCode !== 0);
    if (!failingCommand) {
      return undefined;
    }
    const command = failingCommand.command || 'unknown step';
    return `${command} failed (exit ${failingCommand.exitCode})`;
  }

  calculate(context: VybesScoringContext): VybesResult {
    const config = this.resolveConfig(context.evalName, context.providedConfig);
    const baseScore = 100 * config.multiplier;

    const qualityFailed = this.hasQualityFailure([...context.buildResults, ...context.gradeResults]);

    const breakdown =
      this.collectBreakdown(join(context.archivePath, 'results')) ??
      this.emptyBreakdown();

    let successPercentage =
      breakdown.subtasksTotal > 0
        ? breakdown.subtasksPassed / breakdown.subtasksTotal
        : context.overallSuccess
        ? 1
        : 0;

    const cliDurationMs = context.totalCliDuration ?? context.cliResult.duration;
    const actualTimeMinutes = this.computeActualMinutes(cliDurationMs);
    const timePenaltyMultiplier = this.computeTimePenalty(actualTimeMinutes, config.timeLimitMinutes);
    const { baselineSuccess, adjustedSuccess } = this.adjustForBaseline(context.evalName, successPercentage);

    let error: string | undefined;
    let status: VybesStatus = 'ok';

    if (qualityFailed) {
      successPercentage = 0;
      error = 'lint/typecheck failed';
    }

    let adjustedForError = adjustedSuccess;
    if (qualityFailed) {
      adjustedForError = 0;
      error = 'lint/typecheck failed';
      status = 'error';
    } else if (!context.overallSuccess) {
      adjustedForError = 0;
      status = 'error';
      error =
        this.describeFailure(context.buildResults, context.gradeResults) ?? 'one or more grading steps failed';
    } else if (adjustedForError === 0 && baselineSuccess > 0) {
      status = 'no_op';
    }

    const rawScore = Number((baseScore * adjustedForError).toFixed(2));
    const finalScore = Number(
      (rawScore * timePenaltyMultiplier).toFixed(2)
    );

    return {
      taskName: context.evalName,
      configId: context.configId,
      complexityMultiplier: config.multiplier,
      timeLimitMinutes: config.timeLimitMinutes,
      baseScore,
      successPercentage: Number(successPercentage.toFixed(4)),
      baselineSuccessPercentage: Number(baselineSuccess.toFixed(4)),
      adjustedSuccessPercentage: Number(adjustedForError.toFixed(4)),
      timePenaltyMultiplier: Number(timePenaltyMultiplier.toFixed(4)),
      rawScore,
      finalScore,
      actualTimeMinutes: Number(actualTimeMinutes.toFixed(3)),
      description: config.description,
      category: config.category,
      breakdown,
      error,
      status,
      passesAttempted: context.passCount ?? undefined,
      selectedPass: context.selectedPassIndex ?? undefined,
      totalCliDurationMs: cliDurationMs
    };
  }

  createZeroScore(
    context: VybesScoringContext,
    options: { status?: VybesStatus; error?: string } = {}
  ): VybesResult {
    const config = this.resolveConfig(context.evalName, context.providedConfig);
    const baseScore = 100 * config.multiplier;
    const cliDurationMs = context.totalCliDuration ?? context.cliResult.duration;
    const actualTimeMinutes = this.computeActualMinutes(cliDurationMs);
    const timePenaltyMultiplier = this.computeTimePenalty(actualTimeMinutes, config.timeLimitMinutes);
    const baseline = this.resolveBaseline(context.evalName);

    return {
      taskName: context.evalName,
      configId: context.configId,
      complexityMultiplier: config.multiplier,
      timeLimitMinutes: config.timeLimitMinutes,
      baseScore,
      successPercentage: 0,
      baselineSuccessPercentage: Number(baseline.toFixed(4)),
      adjustedSuccessPercentage: 0,
      timePenaltyMultiplier: Number(timePenaltyMultiplier.toFixed(4)),
      rawScore: 0,
      finalScore: 0,
      actualTimeMinutes: Number(actualTimeMinutes.toFixed(3)),
      description: config.description,
      category: config.category,
      breakdown: this.emptyBreakdown(),
      error: options.error,
      status: options.status ?? 'error',
      passesAttempted: context.passCount ?? undefined,
      selectedPass: context.selectedPassIndex ?? undefined,
      totalCliDurationMs: cliDurationMs
    };
  }

  private resolveConfig(evalName: string, provided?: VybesTaskConfig): VybesTaskConfig {
    if (provided) {
      return provided;
    }

    const normalized = evalName.toLowerCase();
    for (const key of Object.keys(DEFAULT_CONFIGS)) {
      if (normalized.includes(key)) {
        return DEFAULT_CONFIGS[key];
      }
    }

    return {
      multiplier: 3,
      timeLimitMinutes: 6,
      description: 'General evaluation task',
      category: 'general'
    };
  }

  private computeActualMinutes(durationMs: number | undefined): number {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
      return 0;
    }
    return durationMs / 60000;
  }

  private computeTimePenalty(actualMinutes: number, limitMinutes: number): number {
    if (actualMinutes <= 0) {
      return MIN_PENALTY;
    }
    const ratio = limitMinutes / actualMinutes;
    return Math.min(1, Math.max(MIN_PENALTY, ratio));
  }

  private hasQualityFailure(results: CommandSummary[]): boolean {
    return results.some((cmd) => {
      if (cmd.exitCode === 0) {
        return false;
      }
      const command = cmd.command.toLowerCase();
      return command.includes('lint') || command.includes('typecheck');
    });
  }

  private collectBreakdown(resultsDir: string): VybesBreakdown | undefined {
    if (!existsSync(resultsDir)) {
      return undefined;
    }

    const entries = readdirSync(resultsDir, { withFileTypes: true });
    let subtasksPassed = 0;
    let subtasksTotal = 0;
    const modules: Record<string, VybesBreakdownModule> = {};

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      if (entry.name === 'results.json' || extname(entry.name) !== '.json') {
        continue;
      }

      const filePath = join(resultsDir, entry.name);
      try {
        const raw = readFileSync(filePath, 'utf8');
        const parsed: RawTaskResult[] = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          continue;
        }

        const moduleId = entry.name.replace(/\.json$/i, '');
        const passedTasks: string[] = [];
        const failedTasks: string[] = [];
        let modulePassed = 0;
        let moduleTotal = 0;

        for (const result of parsed) {
          if (!result || typeof result.taskId !== 'string') {
            continue;
          }
          moduleTotal += 1;
          subtasksTotal += 1;
          if (result.passed) {
            modulePassed += 1;
            subtasksPassed += 1;
            passedTasks.push(result.taskId);
          } else {
            failedTasks.push(result.taskId);
          }
        }

        modules[moduleId] = {
          passed: modulePassed,
          total: moduleTotal,
          passedTasks,
          failedTasks
        };
      } catch {
        // Ignore malformed results and continue
      }
    }

    if (subtasksTotal === 0) {
      return undefined;
    }

    const modulesCompleted: string[] = [];
    const modulesIncomplete: string[] = [];

    for (const [moduleId, stats] of Object.entries(modules)) {
      if (stats.total === 0) {
        continue;
      }
      if (stats.passed === stats.total) {
        modulesCompleted.push(moduleId);
      } else {
        modulesIncomplete.push(moduleId);
      }
    }

    return {
      subtasksPassed,
      subtasksTotal,
      modulesCompleted,
      modulesIncomplete,
      modules
    };
  }

  private emptyBreakdown(): VybesBreakdown {
    return {
      subtasksPassed: 0,
      subtasksTotal: 0,
      modulesCompleted: [],
      modulesIncomplete: [],
      modules: {}
    };
  }

  private adjustForBaseline(evalName: string, successPercentage: number): {
    baselineSuccess: number;
    adjustedSuccess: number;
  } {
    const baseline = this.resolveBaseline(evalName);
    const clampedSuccess = Math.max(0, Math.min(1, successPercentage));
    const clampedBaseline = Math.max(0, Math.min(0.99, baseline));

    if (clampedSuccess <= clampedBaseline) {
      return { baselineSuccess: clampedBaseline, adjustedSuccess: 0 };
    }

    const denominator = 1 - clampedBaseline;
    if (denominator <= 0) {
      return { baselineSuccess: clampedBaseline, adjustedSuccess: 0 };
    }

    const normalized = (clampedSuccess - clampedBaseline) / denominator;
    return {
      baselineSuccess: clampedBaseline,
      adjustedSuccess: Math.max(0, Math.min(1, normalized))
    };
  }

  private resolveBaseline(evalName: string): number {
    const normalized = evalName.toLowerCase();
    for (const [key, value] of Object.entries(BASELINE_SUCCESS)) {
      if (normalized.includes(key)) {
        return value;
      }
    }
    return 0;
  }
}
