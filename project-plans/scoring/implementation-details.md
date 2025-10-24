# Vybes Implementation Details - Codebase Analysis Results

## Path Specifications

### CLI Runtime Extraction
```typescript
// Current CommandResult structure in runRegexChallenge.ts:
interface CommandResult {
  name: string;           // "llxprt" or "codex"
  command: string;        // 
  args: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;     // <-- CLI runtime in milliseconds
  stdout: string;
  stderr: string;
  error?: string;
}

// Extract CLI command runtime:
const agentCommand = commandResults.find(cmd => 
  cmd.name === 'llxprt' || cmd.name === 'codex'
) || commandResults.find(cmd => 
  cmd.command === 'llxprt' || cmd.command === 'codex'
);
const executionTimeMs = agentCommand?.durationMs;
```

### Regex Result Files
```
grading/regex-challenge/results/
├── validators.json     // Email, phone, name, credit card validation
├── transformations.json // Capitalize, URLs, HTTPS, docs, year
└── puzzles.json        // Prefixed words, embedded token, password, IPv6
```

### Archive Storage Path
```
evals/results/regex-challenge-2025-10-22T22-43-45-499Z/
├── cerebrasqwen3/
│   ├── workspace/           // Archived workspace
│   └── commands.json        // All command results
├── synthetic/
│   ├── workspace/          
│   └── commands.json
└── summary.json            // All profile results
```

## JSON Format Confirmation

### Regex Test Files (from actual code)
```typescript
// Format: Array of task completion status
[
  {"taskId": "email-validation", "passed": true},
  {"taskId": "us-phone-validation", "passed": false},
  {"taskId": "argentina-phone-validation", "passed": true},
  {"taskId": "name-validation", "passed": true},
  {"taskId": "credit-card-validation", "passed": true}
]

// File creation in validators.spec.ts:
afterAll(() => {
  const results = TASKS.map((taskId) => ({ taskId, passed: status.get(taskId) === true }));
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
});
```

### Current Evaluation Results Structure
```typescript
interface EvalRunResult {
  profile: string;           // "cerebrasqwen3", "synthetic", "codex"
  startedAt: string;         // ISO timestamp
  finishedAt: string;        // ISO timestamp
  runId: string;            // "regex-challenge-2025-10-22T22-43-45-499Z"
  commands: CommandResult[]; // All execution results
  status: 'pass' | 'fail';   // Based on REQUIRED_GRADE_COMMANDS
  workspaceArchive: string;  // Relative path to workspace
  taskSummaries?: Record<string, unknown>; // regex results
}
```

## Fast-Fail Implementation

### CLI Duration Validation
```typescript
private validateCLICommand(command: CommandResult): void {
  if (!command.durationMs || command.durationMs < 1000) {
    throw new Error(`Invalid CLI duration: ${command.durationMs}ms. CLI must run for >1 second.`);
  }
  
  if (!command.exitCode || command.signal !== null) {
    throw new Error(`CLI command failed: exitCode=${command.exitCode}, signal=${command.signal}`);
  }
}
```

### Configuration Defaulting
```typescript
private getVybesConfigOrDefault(evalName: string): VybesTaskConfig {
  // Try to read from eval-config.json first
  const evalConfig = this.evaluationLoader.getEvaluation(evalName);
  if (evalConfig.vybes) {
    return evalConfig.vybes;
  }
  
  // Fallback based on task patterns
  if (evalName.includes('base64')) return { multiplier: 1, timeLimitMinutes: 2 };
  if (evalName.includes('regex')) return { multiplier: 3, timeLimitMinutes: 6 };
  if (evalName.includes('form') || evalName.includes('react')) return { multiplier: 5, timeLimitMinutes: 10 };
  if (evalName.includes('report')) return { multiplier: 4, timeLimitMinutes: 8 };
  
  // Default medium complexity
  return { multiplier: 3, timeLimitMinutes: 6 };
}
```

### Regex Success Calculation
```typescript
private calculateRegexSuccess(gradingResultsDir: string, commandResults: CommandResult[]): number {
  let passed = 0, total = 0;
  
  // Read regex test results (19 total subtasks)
  const resultFiles = ['validators.json', 'transformations.json', 'puzzles.json'];
  
  resultFiles.forEach(file => {
    try {
      const filePath = path.join(gradingResultsDir, file);
      const results = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      total += results.length;
      passed += results.filter((r: any) => r.passed).length;
    } catch (error) {
      console.warn(`Failed to read ${file}: ${error}`);
    }
  });
  
  // Add quality checks (4 additional checks)
  const qualityCommands = [
    'workspace:lint', 'workspace:typecheck', 'workspace:build', 'grading:test:hidden'
  ];
  total += qualityCommands.length;
  passed += commandResults.filter(cmd => 
    qualityCommands.includes(cmd.name) && cmd.exitCode === 0
  ).length;
  
  return total > 0 ? passed / total : 0;
}
```

## Integration Points

### Scoring Engine Integration
```typescript
// Insert in runRegexChallenge.ts after agent command execution:

const agentCommand = /* llxprt or codex command */;
const vybesEngine = new VybesScoringEngine(/* config */);

// Calculate score after CLI completes but before workspace cleanup
const vybesScore = vybesEngine.calculateScore('regex-challenge', {
  cliResult: agentCommand,
  commands: commandResults,
  gradingResultsDir: path.join(gradingDir, 'results'),
  totalDuration: agentCommand.durationMs, // Use CLI duration only
  success: calculatedSuccess
});

// Include in results:
results.push({
  // ... existing fields ...
  vybesScore: vybesScore  // NEW field
});
```

### Interface Extensions
```typescript
// Extend existing EvalRunResult interface
interface EvalRunResult {
  profile: string;
  startedAt: string;
  finishedAt: string;
  runId: string;
  commands: CommandResult[];
  status: 'pass' | 'fail';
  workspaceArchive: string;
  taskSummaries?: Record<string, unknown>;
  vybesScore?: VybesResult;  // NEW
}

// Vybes result structure
interface VybesResult {
  finalScore: number;
  baseScore: number;
  successPercentage: number;
  timePenaltyMultiplier: number;
  actualTimeMinutes: number;
  breakdown?: {
    subtasksPassed: number;
    subtasksTotal: number;
    modulesCompleted: string[];
    modulesIncomplete: string[];
  };
}
```

## Error Handling Strategy

### Non-Breaking Error Management
```typescript
try {
  const score = vybesEngine.calculateScore(evalName, evalData);
  // Add score to results
} catch (error) {
  console.warn(`Scoring failed for profile ${profile.name}: ${error.message}`);
  // Store minimal error info and continue evaluation
  results.push({
    // ... existing fields ...
    vybesScore: {
      finalScore: 0,
      error: error.message,
      breakdown: { subtasksPassed: 0, subtasksTotal: 0 }
    }
  });
  continue; // Don't abort entire evaluation run
}
```

### Graceful Degradation
- **Missing regex files**: Treat as 0% completion for that module
- **Invalid duration**: Skip score, log warning, continue evaluation
- **Missing config**: Use defaults based on task name patterns
- **Malformed JSON**: Skip that file, continue with other results

## Implementation Priorities

### Phase 1: Core Infrastructure
1. Add vybes metadata to `eval-config.json`
2. Create `VybesScoringEngine` with above validation logic
3. Extend interfaces with vybes result fields

### Phase 2: Runner Integration
1. Implement scoring call in runRegexChallenge.ts
2. Add error handling that doesn't break evaluations
3. Extend result storage with vybes data

### Phase 3: Validation
1. Test with actual evaluation runs
2. Verify regex result parsing works
3. Validate time penalties and edge cases

This provides complete technical specifications for immediate implementation based on the actual codebase structure.