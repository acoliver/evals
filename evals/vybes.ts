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

export interface VybesResult {
  taskName: string;
  configId: string;
  complexityMultiplier: number;
  timeLimitMinutes: number;
  baseScore: number;
  successPercentage: number;
  timePenaltyMultiplier: number;
  finalScore: number;
  actualTimeMinutes: number;
  description?: string;
  category?: string;
  breakdown?: VybesBreakdown;
  error?: string;
  repoVersion?: string;
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

export class VybesScoringEngine {
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

    const actualTimeMinutes = this.computeActualMinutes(context.cliResult.duration);
    const timePenaltyMultiplier = this.computeTimePenalty(actualTimeMinutes, config.timeLimitMinutes);

    let error: string | undefined;

    if (qualityFailed) {
      successPercentage = 0;
      error = 'lint/typecheck failed';
    }

    const finalScore = Number(
      (baseScore * successPercentage * timePenaltyMultiplier).toFixed(2)
    );

    return {
      taskName: context.evalName,
      configId: context.configId,
      complexityMultiplier: config.multiplier,
      timeLimitMinutes: config.timeLimitMinutes,
      baseScore,
      successPercentage: Number(successPercentage.toFixed(4)),
      timePenaltyMultiplier: Number(timePenaltyMultiplier.toFixed(4)),
      finalScore,
      actualTimeMinutes: Number(actualTimeMinutes.toFixed(3)),
      description: config.description,
      category: config.category,
      breakdown,
      error
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
}
