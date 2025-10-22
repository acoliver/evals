You are implementing a reactive programming system in TypeScript.

Implement the functions in src/core/input.ts, src/core/computed.ts, and src/core/callback.ts to create a reactive programming system with:

- createInput<T>() - Input closure with getter/setter pairs
- createComputed<T>() - Computed values with dependency tracking
- createCallback<T>() - Callback closures with subscription management

The type definitions in src/types/reactive.ts and src/types/observers.ts are already provided.
Focus on type safety, memory management, and proper observer pattern implementation.

The current implementations in the core files are incomplete/stubs. You need to implement the full functionality.

Problem context:

# Reactive Programming System

## Overview

Implement a reactive programming system inspired by modern frontend frameworks like React and Solid. This exercise tests your ability to work with:

- Functional programming patterns
- Observer pattern implementation
- Generic type systems
- State management and coordination

## Source

This exercise is adapted from the React exercise on Exercism (MIT License). Original implementation by the Exercism community.

## Requirements

### Core Functions

Implement the following functions in the specified files:

#### `createInput<T>(value, equal?, options?)`
- **Location**: `src/core/input.ts`
- **Returns**: `[getter, setter]` pair
- **Behavior**: Create reactive input with getter/setter functionality
- **Types**: Use generics for type safety

#### `createComputed<T>(updateFn, value?, equal?, options?)`
- **Location**: `src/core/computed.ts`
- **Returns**: `getter` function
- **Behavior**: Create computed values that react to dependencies
- **Dependency Tracking**: Automatically track and update when dependencies change

#### `createCallback<T>(updateFn, value?)`
- **Location**: `src/core/callback.ts`
- **Returns**: `unsubscribe` function
- **Behavior**: Create side-effect callbacks that react to dependency changes

### Type System Requirements

- Use proper TypeScript generics
- Implement observer pattern interfaces
- Ensure type safety throughout
- Handle edge cases with proper typing

### Memory Management

- Implement proper cleanup for observers
- Prevent memory leaks in subscription patterns
- Handle edge cases for circular dependencies

## Files to Modify

- `src/core/input.ts` - Implement createInput function
- `src/core/computed.ts` - Implement createComputed function  
- `src/core/callback.ts` - Implement createCallback function

## Testing

Run the following commands to verify your implementation:

```bash
npm run lint        # Check code style
npm run typecheck   # Verify TypeScript types
npm run test:public # Run public tests
npm run build       # Build the project
```

## Success Criteria

- All public tests pass
- Code follows TypeScript best practices
- Implementation is type-safe
- Observer pattern works correctly
- Memory management is handled properly

## Challenges

This exercise tests advanced concepts:
- Generic programming with TypeScript
- Observer pattern implementation
- Functional programming patterns
- State management coordination
- Memory leak prevention

Focus on creating a robust, type-safe implementation that properly handles the reactive programming paradigm.

Before finishing, run these commands and report any failures honestly:
npm run typecheck, npm run lint, npm run test:public, npm run build

IMPORTANT: You must run lint and the build as a final step and resolve ANY lint or build errors before finishing.
Fix all ESLint errors (unused variables, any types, etc.) and ensure the build completes successfully.