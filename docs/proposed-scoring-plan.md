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

### Phase 1: Configuration (Week 1)
1. **Create config file**: `evals/config/vybes-config.json`
2. **Update interfaces**: Extend `EvalResult` with vybes scoring
3. **Add scoring engine**: Implement `VybesScoringEngine` class

### Phase 2: Integration (Week 2)  
1. **Modify runner**: Calculate and include vybes scores in results
2. **Update test runners**: Ensure JSON output from regex tests
3. **Add validation**: Verify scoring works across all task types

### Phase 3: Analytics (Week 3)
1. **Score dashboard**: Display vybes scores alongside pass/fail
2. **Historical comparison**: Track vybes performance over time  
3. **Model ranking**: Create model leaderboards by vybes earned

### Phase 4: Fine-tuning (Week 4)
1. **Complexity review**: Ensure task complexity ratings are accurate
2. **Time verification**: Validate time limits are reasonable
3. **Edge case handling**: Optimize for unusual execution patterns

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

## Conclusion

The Vybes scoring system provides meaningful differentiation between model capabilities while maintaining simplicity and preventing gaming of the evaluation framework. It aligns incentives with real-world development priorities: complete, correct solutions delivered in reasonable time.