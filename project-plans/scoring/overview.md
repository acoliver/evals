# Vybes Scoring System Implementation Plan

## Overview

This document outlines the implementation of the "Vybes" scoring system for the LLxprt Evaluation framework. The system rewards completeness over speed while applying complexity-adjusted time penalties for excessive slowness.

## Scoring System Details

### Core Formula
```
Base Score = 100 vybes × Complexity Multiplier
Raw Score = Base Score × Success Percentage  
Final Score = Raw Score × Complexity-Adjusted Time Penalty
```

### Complexity Configuration
| Complexity | Multiplier | Time Limit | Base Score | Typical Tasks |
|------------|------------|------------|------------|---------------|
| 1 | 1.0x | 2 minutes | 100 vybes | Simple utilities (base64) |
| 2 | 2.0x | 4 minutes | 200 vybes | Basic tools |
| 3 | 3.0x | 6 minutes | 300 vybes | Moderate complexity (regex) |
| 4 | 4.0x | 8 minutes | 400 vybes | Complex integrations (report builder) |
| 5 | 5.0x | 10 minutes | 500 vybes | Full-stack applications (form capture, pagination, react) |

### Time Penalty Logic
```
Time Penalty = max(0.2, min(1.0, timeLimitMinutes / executionTimeMinutes))
```
- **Under time limit**: 1.0x (no penalty)
- **Over time limit**: Penalty scales inversely with execution time
- **Maximum penalty**: 0.2x (80% reduction)
- **Key principle**: Speed is never rewarded, only penalized when excessive
- `executionTimeMinutes` comes exclusively from the agent CLI session  
  (`cliResult.duration / 60_000`); build and grading time are ignored.

## Implementation Architecture

### Data Flow Design
```
1. UnifiedRunner.runEvaluation()
   ↓
2. Execute CLI config (model runs)
   ↓  
3. Execute build steps (npm install, test:public, etc.)
   ↓
4. Execute grade steps (test:hidden, etc.)
   ↓
5. CALL VybesScoringEngine.calculateScore()
   ├─ Read vybes config for task
   ├─ Calculate success percentage
   │  ├─ For regex: read JSON results from the archived workspace  
   │  └─ For others: simple pass/fail / grade step completion
   ├─ Derive agent runtime from `cliResult.duration`
   ├─ Calculate time penalty based on complexity
   └─ Generate VybesResult with breakdown
   ↓
6. Append vybes block to archived `workspace/results.json`
   ↓
7. ResultsManager.saveResults() persists the combined JSON
```

### Configuration Strategy
**Key Decision**: Store Vybes metadata within existing `eval-config.json` to eliminate duplication:

```json
{
  "evaluations": {
    "regex-challenge": {
      "workspace": "${EVAL_ROOT}/problems/regex-challenge/workspace",
      "grading": "${EVAL_ROOT}/grading/regex-challenge",
      "buildSteps": ["workspace-install", "lint", "test:public", "typecheck", "build"],
      "gradeSteps": ["workspace-install", "typecheck", "test:hidden"],
      
      "vybes": {
        "multiplier": 3,
        "timeLimitMinutes": 6,
        "description": "Multiple regex utilities with edge cases",
        "category": "utilities"
      }
    }
  }
}
```

### Integration Points

#### 1. Core Classes to Modify
- **`ConfigurationManager`**: Add vybes config loading
- **`EvaluationLoader`**: Add `getVybesConfigOrDefault()` method
- **`UnifiedRunner`**: Integrate scoring engine in `runEvaluation()` method
- **`ResultsManager`**: Extend JSON output structure

#### 2. New Components
- **`VybesScoringEngine`**: Core scoring logic
- **`VybesResult` interface**: Structured scoring output
- **Enhanced result JSON**: Per-run `vybes` block stored alongside existing results (HTML formatting later)

#### 3. Result Structure
```typescript
interface VybesResult {
  taskName: string;
  complexityMultiplier: number;
  timeLimitMinutes: number;
  baseScore: number;
  successPercentage: number;
  timePenaltyMultiplier: number;
  finalScore: number;
  actualTimeMinutes: number;
  description?: string;
  category?: string;
  breakdown?: {
    subtasksPassed: number;
    subtasksTotal: number;
    modulesCompleted: string[];
    modulesIncomplete: string[];
    taskBreakdown: Record<string, {
      passed: number;
      total: number;
      tasks: string[];
    }>;
  };
}

interface EvalResult {
  // ... existing fields ...
  vybesScore?: VybesResult;  // NEW
}
```

## Implementation Phases

### Phase 1: Pre-requisites & Instrumentation (Week 1)
**Priority**: High • **Estimated Effort**: 15-20 hours

#### Tasks
1. **Hidden-test breakdowns**
   - Update hidden suites for base64, report-builder, form-capture, pagination, react-evaluation to emit per-subtask JSON (mirroring regex)
   - Ensure output lands under `workspace/results/<task>.json`

2. **Configuration & types**
   - Add vybes metadata to `eval-config.json`
   - Update `EvaluationConfig`/`EvalResult` types to carry vybes options
   - Expose `cliResult.duration` as the official agent runtime hook

3. **Schema documentation**
   - Document required breakdown structure for each task (subtask IDs, pass/fail)

#### Deliverables
- Updated hidden tests emitting JSON summaries
- Enhanced configuration + TypeScript interfaces
- Documented per-task breakdown schemas and CLI timing guidance

### Phase 2: Runner Integration (Week 2)
**Priority**: High • **Estimated Effort**: 20-25 hours

#### Tasks
1. **Implement scoring engine**
   - Build `VybesScoringEngine` around CLI runtime and per-task breakdowns
   - Parse subtasks from archived JSON output
   - Fail fast when required vybes configuration or breakdown files are missing/malformed

2. **Wire into execution flow**
   - Invoke the scorer inside `UnifiedRunner.runEvaluation`
   - Append a `vybes` block to each run’s `workspace/results.json`
   - Maintain backwards-compatible JSON structure for downstream tools

3. **Guardrails**
   - Enforce lint/typecheck pass before scoring
   - Emit structured errors when scoring cannot proceed (no silent defaults)

#### Deliverables
- Scoring engine integrated with the evaluation pipeline
- Per-run results augmented with vybes data

### Phase 3: Validation & Tuning (Week 3)
**Priority**: Medium • **Estimated Effort**: 10-15 hours

#### Tasks
1. **Cross-task validation**
   - Run the full suite to confirm scores across every evaluation type
   - Spot-check complexity multipliers and time limits

2. **Edge-case coverage**
   - Test fast failures for missing config/breakdowns, timeouts, partial results
   - Confirm scoring still produces output when grade steps fail (lint/typecheck enforced)

3. **Documentation & examples**
   - Update framework docs with sample vybes output and per-task breakdown schemas
   - Provide example JSON snippets for consumers (HTML/reporting deferred)

#### Deliverables
- Verified scoring outputs for all tasks
- Updated documentation describing the new per-run `vybes` block

## Technical Considerations

### Backward Compatibility
- All existing functionality remains unchanged
- Vybes scoring is additive, not replacing
- Can be rolled back without data loss
- Existing evaluation workflows unaffected

### Error Handling Strategy
- Missing vybes config → Default to medium complexity (multiplier: 3, timeLimit: 6min)
- Missing regex result files → Graceful degradation to pass/fail
- Scoring calculation failures → Log warning, continue without score
- Configuration validation errors → Clear error messages with fixes

### Performance Impact
- **Minimal**: Additional file reads for regex results (~1-2ms)
- **Lightweight**: Simple arithmetic calculations
- **No impact**: On model execution or workflow timing
- **Async-friendly**: All scoring operations are async-safe

## Success Metrics

### Functional Goals
- [ ] All existing evaluations produce valid vybes scores
- [ ] Regex scoring shows detailed module breakdowns
- [ ] Simple tasks correctly apply complexity multipliers
- [ ] Time penalties scale appropriately across complexity levels

### Quality Goals  
- [ ] HTML-ready output structure enables dashboard creation
- [ ] Zero disruption to existing evaluation workflows
- [ ] Comprehensive error handling prevents evaluation failures
- [ ] Configuration is maintainable and extensible

### Performance Goals
- [ ] Scoring calculation adds < 100ms total overhead per evaluation
- [ ] Memory usage increase < 5%
- [ ] No impact on model execution time
- [ ] Backward compatibility with existing result consumers

## Future Enhancements

### Short-term (Post-implementation)
- **Dashboard / HTML reporting**: Build visualizations once scoring data is stable
- **Model Ranking**: Leaderboard system by vybes earned
- **Trend Analysis**: Performance tracking over time

### Long-term
- **Adaptive Scoring**: Dynamic complexity adjustment based on performance
- **Team Scoring**: Aggregate vybes across team members
- **Custom Metrics**: Hybrid scoring combining vybes with other measures

## Migration Plan

### Rollout Strategy
1. **Phase 1**: Implement core infrastructure in development branch
2. **Phase 2**: Test integration with existing evaluation runs
3. **Phase 3**: Deploy to production with feature flag
4. **Phase 4**: Enable for all evaluations, monitor for issues
5. **Phase 5**: Remove feature flag, make vybes scoring standard

### Rollback Plan
- All changes are additive and can be safely removed
- Existing evaluation workflows remain untouched
- Feature flag allows instant disabling if issues arise
- Data format changes are backward compatible

## Conclusion

The Vybes scoring system provides meaningful differentiation between model capabilities while aligning incentives with real-world development priorities. The implementation plan ensures minimal disruption to existing workflows while providing a solid foundation for advanced analytics and visualization.

The three-phase approach prioritizes core scoring, safe integration, and validation now, while leaving dashboards and richer analytics as future enhancements.
