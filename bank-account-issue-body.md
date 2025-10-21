## Overview

This issue proposes adapting the Bank Account exercise from [Exercism TypeScript](https://github.com/exercism/typescript) for our multi-file evaluation framework.

## Exercise Details

**Source**: `exercises/practice/bank-account/bank-account.ts`
**License**: MIT License (same as our framework)
**Original Author**: Exercism community

### Current Structure
The exercise implements a banking system with:
- `ValueError` custom exception class
- `BankAccount` class with state management
- Methods: `open()`, `close()`, `deposit()`, `withdraw()`, `balance` getter
- Error handling for invalid operations

### Current Code Structure
```typescript
export class ValueError extends Error {
  constructor() {
    super('Bank account error')
  }
}

export class BankAccount {
  constructor()
  open(): unknown
  close(): unknown
  deposit(_argument: unknown): unknown
  withdraw(_argument: unknown): unknown
  get balance(): unknown
}
```

## Proposed Multi-File Structure

```
problems/bank-account-evaluation/workspace/
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── src/
│   ├── errors/
│   │   └── ValueError.ts     // Custom error class
│   ├── account/
│   │   ├── BankAccount.ts    // Main class implementation
│   │   ├── types.ts          // Account-related types
│   │   └── validation.ts     // Input validation helpers
│   └── index.ts              // Public exports
├── tests/public/
│   ├── bank-account.spec.ts  // Basic functionality tests
│   └── error-handling.spec.ts // Error scenario tests
└── problem.md
```

## Implementation Plan

### Phase 1: Problem Setup
1. Create multi-file structure with proper separation of concerns
2. Implement comprehensive problem specification
3. Design public test suite covering basic banking operations
4. Create hidden test suite for edge cases and error scenarios

### Phase 2: Evaluation Integration  
1. Create evaluation runner (`evals/runBankAccount.ts`)
2. Configure workspace and grading directories
3. Add npm script to package.json
4. Test with all model profiles

### Phase 3: Test Enhancement

**Public Tests**: Basic functionality verification
- Account opening and closing
- Deposit and withdrawal operations
- Balance tracking
- Basic error handling

**Hidden Tests**: Advanced scenarios
- Edge cases for negative amounts
- Multiple operations in sequence
- Error boundary conditions
- State consistency validation
- Concurrent operation handling

## Evaluation Focus Areas

This exercise tests capabilities that complement our existing tasks:

- **Class-Based Design**: Object-oriented programming patterns
- **State Management**: Internal state coordination and validation
- **Error Handling**: Custom exceptions and error propagation
- **Business Logic**: Domain-specific rule implementation
- **Method Coordination**: Multiple method interactions

## Success Criteria

- All models can implement basic banking operations
- Hidden tests catch edge cases and state inconsistencies
- Error handling is properly implemented across all scenarios
- Multi-file coordination is properly evaluated

## Dependencies

- Existing TypeScript/ESLint configuration
- Vitest for testing
- No additional runtime dependencies required

## MIT License Compliance

This adaptation follows the MIT License terms:
- Original exercise is MIT licensed
- We maintain license compatibility
- Proper attribution to Exercism
- Modifications are clearly documented

## Value Proposition

This exercise addresses a gap in our evaluation suite by testing:
- Object-oriented programming with TypeScript
- State management in class-based systems
- Error handling and validation patterns
- Business logic implementation
- Method coordination and state consistency

It provides a realistic multi-file problem that tests fundamental software engineering patterns commonly used in enterprise applications.