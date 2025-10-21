## Overview

This issue proposes adapting the React exercise from [Exercism TypeScript](https://github.com/exercism/typescript) for our multi-file evaluation framework.

## Exercise Details

**Source**: `exercises/practice/react/react.ts` (116 lines)
**License**: MIT License (same as our framework)
**Original Author**: Exercism community

### Current Structure
The exercise implements a reactive programming system with:
- `createInput<T>()` - Input closure with getter/setter pairs
- `createComputed<T>()` - Computed values with dependency tracking  
- `createCallback<T>()` - Callback closures with subscription management
- Complex type definitions and observer patterns

## Proposed Multi-File Structure

```
problems/react-evaluation/workspace/
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── src/
│   ├── types/
│   │   ├── reactive.ts      // Type definitions
│   │   └── observers.ts     // Observer interfaces
│   ├── core/
│   │   ├── input.ts         // createInput implementation
│   │   ├── computed.ts      // createComputed implementation
│   │   └── callback.ts      // createCallback implementation
│   └── index.ts             // Public exports
├── tests/public/
│   ├── input.spec.ts
│   ├── computed.spec.ts
│   └── callback.spec.ts
└── problem.md
```

## Implementation Plan

### Phase 1: Problem Setup
1. Copy React exercise content to multi-file structure
2. Create comprehensive problem specification
3. Design public test suite covering core functionality
4. Implement hidden test suite for edge cases

### Phase 2: Evaluation Integration  
1. Create evaluation runner (`evals/runReact.ts`)
2. Configure workspace and grading directories
3. Add npm script to package.json
4. Test with all model profiles

### Phase 3: Test Enhancement
1. **Public Tests**: Basic functionality verification
   - Input creation and basic getter/setter behavior
   - Simple computed value creation
   - Callback subscription basics

2. **Hidden Tests**: Advanced scenarios
   - Complex dependency chains
   - Subscription management and cleanup
   - Type safety with generics
   - Observer pattern edge cases
   - Memory leak prevention

## Evaluation Focus Areas

This exercise tests capabilities that complement our existing tasks:

- **Complex Type System**: Generic implementations with type safety
- **State Management**: Multi-component coordination
- **Observer Patterns**: Subscription and notification systems
- **Functional Programming**: Closure-based APIs
- **Memory Management**: Proper cleanup and disposal

## Success Criteria

- All models can implement basic reactive patterns
- Hidden tests catch edge cases and memory leaks
- Multi-file coordination is properly evaluated
- Type safety is enforced throughout implementation

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
- Modern reactive programming patterns
- Complex type system usage
- State management coordination
- Industry-relevant React-like patterns

It provides a challenging but realistic multi-file problem that tests advanced TypeScript capabilities.