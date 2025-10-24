# Vybes Scoring System - Proposed Implementation Plan

## Overview

This document outlines a new scoring system called "Vybes" for the LLxprt Evaluation framework. The system rewards completeness over speed while applying complexity-adjusted time penalties for excessive slowness.

## Core Scoring Formula

```
Base Score = 100 vybes × Complexity Multiplier
Raw Score = Base Score × Success Percentage  
Final Score = Raw Score × Complexity-Adjusted Time Penalty
```

## Complexity-Based Configuration

Each evaluation task is assigned:
1. **Complexity Multiplier** (1-5 scale)
2. **Time Limit** - "fast" threshold before penalties apply

| Complexity | Multiplier | Time Limit | Base Score | Typical Tasks |
|------------|------------|------------|------------|---------------|
| 1 | 1.0x | 2 minutes | 100 vybes | Simple utilities (base64) |
| 2 | 2.0x | 4 minutes | 200 vybes | Basic tools |
| 3 | 3.0x | 6 minutes | 300 vybes | Moderate complexity (regex) |
| 4 | 4.0x | 8 minutes | 400 vybes | Complex integrations (report builder) |
| 5 | 5.0x | 10 minutes | 500 vybes | Full-stack applications (form capture, pagination, react) |

## Time Penalty Logic

```
Time Penalty = max(0.2, min(1.0, timeLimitMinutes / executionTimeMinutes))
```

- **Under time limit**: 1.0x (no penalty)
- **Over time limit**: Penalty scales inversely with execution time
- **Maximum penalty**: 0.2x (80% reduction)

**Key principle**: Speed is never rewarded, only penalized when excessive.  
`executionTimeMinutes` is measured directly from the agent’s CLI session  
(`cliResult.duration / 60_000`). Install/build/grade steps are ignored so only
model problem-solving time drives the penalty.

## Task Configuration

```json
{
  "complexityConfig": {
    "base64-fix": {
      "multiplier": 1,
      "timeLimitMinutes": 2,
      "description": "Simple Base64 CLI utility"
    },
    "regex-challenge": {
      "multiplier": 3, 
      "timeLimitMinutes": 6,
      "description": "Multiple regex utilities with edge cases"
    },
    "report-builder": {
      "multiplier": 4,
      "timeLimitMinutes": 8,
      "description": "CLI report generation with multiple formats"
    },
    "form-capture": {
      "multiplier": 5,
      "timeLimitMinutes": 10,
      "description": "Full-stack Express + SQLite form application"
    },
    "pagination": {
      "multiplier": 5,
      "timeLimitMinutes": 10,
      "description": "Full-stack API + frontend + database integration"
    },
    "react-evaluation": {
      "multiplier": 5,
      "timeLimitMinutes": 10,
      "description": "Complex component architecture with state management"
    }
  }
}
```

## Success Percentage Calculation

### Simple Pass/Fail Tasks
For most tasks (base64, report-builder, form-capture, pagination, react):
```
Success = 100% if all grade steps pass, else 0%
```

### Multi-Component Tasks (Regex Challenge)
Regex tests output JSON results files, enabling granular scoring:
```typescript
interface SubtaskResult {
  taskId: string;
  passed: boolean;
}

// Calculate from results files:
const totalSubtasks = 19; // 5 validators + 5 transformations + 4 puzzles + 1 package + 4 build/grade checks
const passedSubtasks = results.filter(r => r.passed).length;
const successPercentage = passedSubtasks / totalSubtasks;
```

Every evaluation writes its Vybes summary into the archived run artifact  
`outputs/<eval>-<timestamp>/<config>/workspace/results.json`. The scorer appends
a `vybes` block there so each score stays tied to a specific model/session and
never pollutes the repository.

## Score Examples

### Example 1: Perfect Base64 (Complexity 1)
- **Base**: 100 × 1 = 100 vybes
- **Success**: 100% (all tests pass)
- **Time**: 1 minute (1.0 penalty)
- **Final**: 100 × 1.0 × 1.0 = **100 vybes**

### Example 2: Near-Complete Regex (Complexity 3)
- **Base**: 100 × 3 = 300 vybes
- **Success**: 17/19 = 89%
- **Time**: 8 minutes (0.75 penalty)
- **Final**: 300 × 0.89 × 0.75 = **200 vybes**

### Example 3: Complete Form Capture (Complexity 5)
- **Base**: 100 × 5 = 500 vybes
- **Success**: 100% (fully working application)
- **Time**: 12 minutes (0.83 penalty)
- **Final**: 500 × 1.0 × 0.83 = **415 vybes**

### Example 4: Fast but Incomplete (Complexity 5)
- **Base**: 100 × 5 = 500 vybes
- **Success**: 20% (basic skeleton only)
- **Time**: 4 minutes (1.0 penalty)
- **Final**: 500 × 0.20 × 1.0 = **100 vybes**

## Key advantages

### [OK] **Completeness Over Speed**
- Fast & incomplete work always scores lower than complete work
- No "speed bonuses" that could gaming the system

### [OK] **Complexity-Appropriate Expectations**
- Simple tasks expected quickly (2 minutes)
- Complex tasks given reasonable time (10 minutes)
- Aligns with realistic development timelines

### [OK] **Simple Maintenance**
- Add new tasks with just complexity rating and time limit
- No complex per-task point assignments
- Extensible without scoring recalculations

### [OK] **Fair Competition**
- Models can't "game" by focusing on easy tasks
- Harder problems properly rewarded
- Time penalties prevent endless execution

## Implementation Steps

### Phase 1: Pre-requisites & Instrumentation (Week 1)
1. **Emit hidden-test breakdowns**: Update every grading suite (base64, report-builder, form-capture, pagination, react-evaluation) to write per-subtask JSON alongside regex.
2. **Extend config**: Add vybes metadata to `eval-config.json`.
3. **Expose timing**: Ensure `cliResult.duration` is surfaced in `EvalResult`.
4. **Define interfaces**: Extend `EvalResult`/`EvaluationConfig` to carry vybes options and document expected breakdown schemas.

### Phase 2: Scoring Integration (Week 2)  
1. **Scoring engine**: Implement `VybesScoringEngine` using CLI duration
2. **Runner hookup**: Invoke the engine inside `UnifiedRunner.runEvaluation`
3. **Results output**: Append a `vybes` block to each run’s archived `results.json`
4. **Parse breakdowns**: Read per-run JSON summaries (regex + new task outputs) for partial credit. If any expected file is missing or malformed, fail scoring with a clear error.

### Phase 3: Validation & Tuning (Week 3)
1. **Cross-task testing**: Validate scoring on every evaluation type
2. **Complexity sanity check**: Review multipliers and time limits
3. **Edge cases**: Verify fast failures for missing config/breakdowns, handle timeouts cleanly
4. **Docs & examples**: Update overview material with the new scoring output format and per-task schemas

## Result Structure

```typescript
interface VybesResult {
  complexityMultiplier: number;
  timeLimitMinutes: number;
  baseScore: number;
  successPercentage: number; 
  timePenaltyMultipler: number;
  finalScore: number;
  actualTimeMinutes: number;
  breakdown?: {
    subtasksPassed: number;
    subtasksTotal: number;
    tasksCompleted: string[];
    tasksFailed: string[];
  };
}
```

## Natural Score Tiers

Expected score ranges naturally emerge:
- **Bronze**: 0-200 vybes (Basic utilities or incomplete work)
- **Silver**: 201-400 vybes (Moderate complexity, good completion)
- **Gold**: 401-600 vybes (Complex tasks, high completion)
- **Platinum**: 600+ vybes (Full mastery across all complexity levels)

## Migration Impact

This change is **backward compatible**:
- Existing pass/fail results remain unchanged
- Vybes scoring additional information only
- No disruption to current evaluation workflows
- Easy to rollback if needed

## Future Extensibility

The system easily accommodates:
- **New evaluation types**: Assign appropriate complexity and time limits
- **Hybrid scoring**: Combine vybes with other metrics
- **Adaptive thresholds**: Adjust time limits based on real performance data
- **Team scoring**: Aggregate vybes across team members or sessions
- **Dashboard / HTML reporting**: Future visualization layer over per-run JSON

## Conclusion

The Vybes scoring system provides meaningful differentiation between model capabilities while maintaining simplicity and preventing gaming of the evaluation framework. It aligns incentives with real-world development priorities: complete, correct solutions delivered in reasonable time.
