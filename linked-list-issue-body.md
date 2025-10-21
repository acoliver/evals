## Overview

This issue proposes adapting the Linked List exercise from [Exercism TypeScript](https://github.com/exercism/typescript) for our multi-file evaluation framework.

## Exercise Details

**Source**: `exercises/practice/linked-list/linked-list.ts`
**License**: MIT License (same as our framework)
**Original Author**: Exercism community

### Current Structure
The exercise implements a generic linked list with:
- `LinkedList<TElement>` class with generic type safety
- Methods: `push()`, `pop()`, `shift()`, `unshift()`, `delete()`, `count()`
- Node-based data structure implementation
- Type-safe element handling

### Current Code Structure
```typescript
export class LinkedList<TElement> {
  public push(element: unknown)
  public pop(): unknown
  public shift(): unknown
  public unshift(element: unknown)
  public delete(element: unknown)
  public count(): unknown
}
```

## Proposed Multi-File Structure

```
problems/linked-list-evaluation/workspace/
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── src/
│   ├── types/
│   │   ├── LinkedList.ts      // Main class interface
│   │   └── Node.ts            // Node type definitions
│   ├── core/
│   │   ├── LinkedList.ts      // Main implementation
│   │   ├── Node.ts            // Node implementation
│   │   └── utils.ts           // Helper functions
│   └── index.ts               // Public exports
├── tests/public/
│   ├── linked-list.spec.ts    // Basic functionality tests
│   └── edge-cases.spec.ts     // Edge case tests
└── problem.md
```

## Implementation Plan

### Phase 1: Problem Setup
1. Create multi-file structure with proper node-based implementation
2. Implement comprehensive problem specification
3. Design public test suite covering basic linked list operations
4. Create hidden test suite for edge cases and performance scenarios

### Phase 2: Evaluation Integration  
1. Create evaluation runner (`evals/runLinkedList.ts`)
2. Configure workspace and grading directories
3. Add npm script to package.json
4. Test with all model profiles

### Phase 3: Test Enhancement

**Public Tests**: Basic functionality verification
- Push and pop operations (stack-like behavior)
- Shift and unshift operations (queue-like behavior)
- Element deletion
- Count functionality
- Basic type safety

**Hidden Tests**: Advanced scenarios
- Empty list edge cases
- Single element operations
- Large list performance
- Type safety with complex elements
- Memory management and cleanup
- Iterator pattern implementation (optional advanced)

## Evaluation Focus Areas

This exercise tests capabilities that complement our existing tasks:

- **Data Structure Implementation**: Core computer science concepts
- **Generic Programming**: Type-safe parameterized implementations
- **Algorithmic Thinking**: Efficient operation implementation
- **Memory Management**: Node allocation and deallocation
- **Type System**: Advanced TypeScript generic usage

## Success Criteria

- All models can implement basic linked list operations
- Hidden tests catch edge cases and performance issues
- Type safety is maintained throughout implementation
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
- Fundamental data structure implementation
- Generic programming with TypeScript
- Algorithmic efficiency and performance
- Type system advanced usage
- Computer science fundamentals

It provides a classic computer science problem that tests core programming concepts while requiring multi-file coordination for a complete implementation.