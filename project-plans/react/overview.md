# React Exercise Implementation Plan

## Executive Command

**To execute this entire plan after clearing context, use:**
```
"@project-plans/react/"
```

This single command will execute the complete React exercise implementation across all phases.

## Prerequisites & Starting State

### Current Repository State
- **Current Branch**: `issue7` (already created from main)
- **Base Directory**: `/Users/acoliver/projects/llxprt-evals`
- **Source Exercise**: Located at `tmp/typescript/exercises/practice/react/react.ts`
- **Framework Patterns**: Use existing patterns from `problems/regex-challenge/` and `evals/runRegexChallenge.ts`

### Available Reference Files
- Source exercise: `tmp/typescript/exercises/practice/react/react.ts` (116 lines)
- Config templates: `problems/regex-challenge/workspace/.eslintrc.cjs`, `tsconfig.json`, `package.json`
- Evaluation runner: `evals/runRegexChallenge.ts` (use as template for `evals/runReact.ts`)
- Test patterns: `problems/regex-challenge/workspace/tests/public/`

### Context-Free Execution Requirements
When context is cleared, the executor should:
1. **Assume current branch is `issue7`**
2. **Use `/Users/acoliver/projects/llxprt-evals` as base directory**
3. **Reference files exist at the specified paths**
4. **Follow the exact file structure and content specifications below**

## Complete Implementation Blueprint

### Phase 1: Directory Structure & Core Files (Execute First)

#### 1.1 Create Directory Structure
```bash
mkdir -p problems/react-evaluation/workspace/{src/{types,core},tests/public}
mkdir -p grading/react-evaluation/{tests/hidden,workspace}
```

#### 1.2 Create Source Files (Exact Content)

**File: `problems/react-evaluation/workspace/src/types/reactive.ts`**
```typescript
/**
 * Type definitions for the reactive programming system
 * Adapted from Exercism TypeScript React exercise
 * MIT License - Original by Exercism community
 */

export type EqualFn<T> = (lhs: T, rhs: T) => boolean
export type GetterFn<T> = () => T
export type SetterFn<T> = (value: T) => T
export type UnsubscribeFn = () => void
export type UpdateFn<T> = (value?: T) => T

export type InputPair<T> = [GetterFn<T>, SetterFn<T>]

export type Options = {
  name: string // for debugging
}

export type ObserverR = {
  name?: string
}

export type ObserverV<T> = {
  value?: T
  updateFn: UpdateFn<T>
}

export type Observer<T> = ObserverR & ObserverV<T>

export type SubjectR = {
  name?: string
  observer: ObserverR | undefined
}

export type SubjectV<T> = {
  value: T
  equalFn?: EqualFn<T>
}

export type Subject<T> = SubjectR & SubjectV<T>

// module Context value
let activeObserver: ObserverR
```

**File: `problems/react-evaluation/workspace/src/types/observers.ts`**
```typescript
/**
 * Observer pattern interfaces
 * Adapted from Exercism TypeScript React exercise
 * MIT License - Original by Exercism community
 */

import { Observer, ObserverR, activeObserver } from './reactive.js'

export function updateObserver<T>(observer: Observer<T>): void {
  const prevObserver = activeObserver
  activeObserver = observer
  observer.value = observer.updateFn(observer.value)
  activeObserver = prevObserver
}
```

**File: `problems/react-evaluation/workspace/src/core/input.ts`**
```typescript
/**
 * Input closure implementation
 * Adapted from Exercism TypeScript React exercise
 * MIT License - Original by Exercism community
 */

import { 
  InputPair, 
  Subject, 
  Observer, 
  activeObserver, 
  updateObserver,
  EqualFn, 
  GetterFn, 
  SetterFn, 
  Options 
} from '../types/reactive.js'

/**
 * Creates an input closure. The value is accessed
 * via the accessor and changed via the
 * mutator returned as part an `InputPair<T>`.
 */
export function createInput<T>(
  value: T,
  _equal?: boolean | EqualFn<T>,
  options?: Options
): InputPair<T> {
  const s: Subject<T> = {
    name: options?.name,
    observer: undefined,
    value,
    equalFn: undefined,
  }

  const read: GetterFn<T> = () => {
    if (activeObserver) s.observer = activeObserver
    return s.value
  }

  const write: SetterFn<T> = (nextValue) => {
    s.value = nextValue
    if (s.observer) updateObserver(s.observer as Observer<unknown>)
    return s.value
  }

  return [read, write]
}
```

**File: `problems/react-evaluation/workspace/src/core/computed.ts`**
```typescript
/**
 * Computed closure implementation
 * Adapted from Exercism TypeScript React exercise
 * MIT License - Original by Exercism community
 */

import { 
  GetterFn, 
  UpdateFn, 
  Observer, 
  updateObserver,
  EqualFn, 
  Options 
} from '../types/reactive.js'

/**
 * Creates a computed (derived) closure with the
 * supplied function which computes the current value
 * of the closure.
 */
export function createComputed<T>(
  updateFn: UpdateFn<T>,
  value?: T,
  _equal?: boolean | EqualFn<T>,
  options?: { name?: string }
): GetterFn<T> {
  const o: Observer<T> = {
    name: options?.name,
    value,
    updateFn,
  }
  updateObserver(o)
  return (): T => o.value!
}
```

**File: `problems/react-evaluation/workspace/src/core/callback.ts`**
```typescript
/**
 * Callback closure implementation
 * Adapted from Exercism TypeScript React exercise
 * MIT License - Original by Exercism community
 */

import { UnsubscribeFn } from '../types/reactive.js'

/**
 * Creates a callback closure with the supplied
 * function which is expected to perform side effects.
 */
export function createCallback<T>(_updateFn: (value?: T) => T, _value?: T): UnsubscribeFn {
  // TODO: Implement callback functionality
  return () => {
    // TODO: Implement unsubscribe functionality
  }
}
```

**File: `problems/react-evaluation/workspace/src/index.ts`**
```typescript
/**
 * Public exports for reactive programming system
 * Adapted from Exercism TypeScript React exercise
 * MIT License - Original by Exercism community
 */

export { createInput } from './core/input.js'
export { createComputed } from './core/computed.js'
export { createCallback } from './core/callback.js'

export type {
  EqualFn,
  GetterFn,
  SetterFn,
  UnsubscribeFn,
  UpdateFn,
  InputPair,
  Options,
  ObserverR,
  ObserverV,
  Observer,
  SubjectR,
  SubjectV,
  Subject
} from './types/reactive.js'
```

#### 1.3 Configuration Files (Copy from regex-challenge templates)

**File: `problems/react-evaluation/workspace/package.json`**
```json
{
  "name": "react-evaluation",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "lint": "eslint . --ext .ts",
    "test:public": "vitest run --config vitest.config.public.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "tsx": "^4.10.2",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0",
    "@typescript-eslint/eslint-plugin": "^7.13.1",
    "@typescript-eslint/parser": "^7.13.1",
    "eslint": "^8.57.0",
    "prettier": "^3.2.5"
  }
}
```

**File: `problems/react-evaluation/workspace/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "strict": true,
    "noEmit": true,
    "types": ["node", "vitest"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**File: `problems/react-evaluation/workspace/.eslintrc.cjs`**
```javascript
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-useless-escape': ['error', { 
      allowEscapes: /[\^\(\)\[\]\{\}\*\+\?\.\|\\\/]/ 
    }]
  }
};
```

**File: `problems/react-evaluation/workspace/vitest.config.public.ts`**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/public/**/*.spec.ts'],
    environment: 'node'
  }
})
```

#### 1.4 Public Tests

**File: `problems/react-evaluation/workspace/tests/public/input.spec.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { createInput } from '../src/index.js'

describe('createInput', () => {
  it('creates input with initial value', () => {
    const [getter, setter] = createInput(42)
    expect(getter()).toBe(42)
  })

  it('updates value through setter', () => {
    const [getter, setter] = createInput(42)
    setter(100)
    expect(getter()).toBe(100)
  })

  it('returns updated value from setter', () => {
    const [getter, setter] = createInput('hello')
    const result = setter('world')
    expect(result).toBe('world')
    expect(getter()).toBe('world')
  })
})
```

**File: `problems/react-evaluation/workspace/tests/public/computed.spec.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { createInput, createComputed } from '../src/index.js'

describe('createComputed', () => {
  it('creates computed value from input', () => {
    const [getter] = createInput(5)
    const double = createComputed(() => getter() * 2)
    expect(double()).toBe(10)
  })

  it('computes with initial value', () => {
    const computed = createComputed((x = 3) => x * 2)
    expect(computed()).toBe(6)
  })
})
```

**File: `problems/react-evaluation/workspace/tests/public/callback.spec.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { createCallback } from '../src/index.js'

describe('createCallback', () => {
  it('returns unsubscribe function', () => {
    const unsubscribe = createCallback(() => console.log('test'))
    expect(typeof unsubscribe).toBe('function')
  })

  it('unsubscribe function can be called without error', () => {
    const unsubscribe = createCallback(() => console.log('test'))
    expect(() => unsubscribe()).not.toThrow()
  })
})
```

#### 1.5 Problem Specification

**File: `problems/react-evaluation/workspace/problem.md`**
```markdown
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
```

### Phase 2: Grading Infrastructure

#### 2.1 Copy Workspace to Grading
```bash
cp -r problems/react-evaluation/workspace/* grading/react-evaluation/
```

#### 2.2 Create Hidden Tests

**File: `grading/react-evaluation/tests/hidden/advanced-observer.spec.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { createInput, createComputed } from '../src/index.js'

describe('Advanced Observer Patterns', () => {
  it('handles complex dependency chains', () => {
    const [input1, setInput1] = createInput(1)
    const [input2, setInput2] = createInput(2)
    
    const computed = createComputed(() => input1() + input2())
    expect(computed()).toBe(3)
    
    setInput1(10)
    expect(computed()).toBe(12)
  })

  it('handles nested computed values', () => {
    const [base, setBase] = createInput(5)
    const doubled = createComputed(() => base() * 2)
    const quadrupled = createComputed(() => doubled() * 2)
    
    expect(quadrupled()).toBe(20)
    setBase(10)
    expect(quadrupled()).toBe(40)
  })
})
```

**File: `grading/react-evaluation/tests/hidden/memory-management.spec.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { createInput, createComputed, createCallback } from '../src/index.js'

describe('Memory Management', () => {
  it('callback cleanup works correctly', () => {
    const [input, setInput] = createInput(0)
    let callCount = 0
    
    const unsubscribe = createCallback(() => {
      callCount++
      input()
    })
    
    setInput(1)
    unsubscribe()
    setInput(2)
    
    // Should only be called once before unsubscribe
    expect(callCount).toBe(1)
  })
})
```

### Phase 3: Evaluation Runner

**File: `evals/runReact.ts`** (Copy from runRegexChallenge.ts and adapt)
```typescript
import { exec } from 'child_process'
import { promisify } from 'util'
import { copyFile, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

interface ProfileConfig {
  name: string
  kind: 'llxprt' | 'codex'
}

const PROFILES: ProfileConfig[] = [
  { name: 'cerebrasqwen3', kind: 'llxprt' },
  { name: 'synthetic', kind: 'llxprt' },
  { name: 'codex', kind: 'codex' }
]

const REQUIRED_GRADE_COMMANDS = new Set([
  'workspace:typecheck',
  'workspace:lint',
  'workspace:test:public',
  'workspace:build',
  'grading:lint',
  'grading:typecheck',
  'grading:test:hidden'
])

async function runProfile(profile: ProfileConfig): Promise<void> {
  const runId = randomUUID()
  const workspaceDir = join(tmpdir(), `llxprt-react-${runId}`)
  
  await mkdir(workspaceDir, { recursive: true })
  
  // Copy workspace files
  await copyDirectory('problems/react-evaluation/workspace', workspaceDir)
  
  const prompt = `
You are implementing a reactive programming system in TypeScript.

Implement the functions in src/core/input.ts, src/core/computed.ts, and src/core/callback.ts to create
a reactive programming system with:

- createInput<T>() - Input closure with getter/setter pairs
- createComputed<T>() - Computed values with dependency tracking
- createCallback<T>() - Callback closures with subscription management

Focus on type safety, memory management, and proper observer pattern implementation.
All type definitions are already provided in src/types/.

Run lint/test/typecheck/build before finishing. Report any failures honestly.
`

  const llxprtCmd = profile.kind === 'llxprt' 
    ? `llxprt --profile-load ${profile.name} --yolo --prompt "${prompt}"`
    : `codex --prompt "${prompt}"`

  try {
    await execAsync(llxprtCmd, { cwd: workspaceDir })
    console.log(`[OK] Profile ${profile.name} completed successfully`)
  } catch (error) {
    console.log(`[ERROR] Profile ${profile.name} failed`)
    throw error
  }
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await execAsync(`cp -r ${src}/* ${dest}/`)
}

async function main(): Promise<void> {
  console.log('=== React Exercise Evaluation ===')
  
  for (const profile of PROFILES) {
    console.log(`\n=== Evaluating profile: ${profile.name} ===`)
    try {
      await runProfile(profile)
    } catch (error) {
      console.error(`Profile ${profile.name} evaluation failed:`, error)
    }
  }
  
  console.log('\n=== Evaluation complete ===')
}

main().catch(console.error)
```

### Phase 4: Integration

#### 4.1 Update Package.json
Add to `/Users/acoliver/projects/llxprt-evals/package.json`:
```json
{
  "scripts": {
    "eval:react": "tsx evals/runReact.ts"
  }
}
```

#### 4.2 Update Root tsconfig.json
Add to compilerOptions.include:
```json
{
  "include": ["evals/**/*.ts", "problems/**/src/**/*.ts"]
}
```

## Context-Free Execution Summary

When context is cleared and you execute `"@project-plans/react/"`, the following will happen:

1. **Create all directories and files** exactly as specified
2. **Copy content from source exercise** and adapt to multi-file structure
3. **Set up configuration files** using regex-challenge templates
4. **Create comprehensive test suites** (public and hidden)
5. **Implement evaluation runner** adapted from existing patterns
6. **Update root package.json** for evaluation script
7. **Verify all files are created correctly**

The plan is now completely self-contained and executable without any additional context.

## Overview

This project plan details the implementation of the React exercise adapted from [Exercism TypeScript](https://github.com/exercism/typescript) for our multi-file evaluation framework. This addresses GitHub issue #7.

## Exercise Analysis

### Source Material
- **Exercise**: `exercises/practice/react/react.ts` (116 lines)
- **License**: MIT License (compatible with our framework)
- **Original Author**: Exercism community

### Current Exercise Structure
The exercise implements a reactive programming system with three main functions:
- `createInput<T>()` - Input closure with getter/setter pairs
- `createComputed<T>()` - Computed values with dependency tracking
- `createCallback<T>()` - Callback closures with subscription management

### Key Features
- Complex type definitions and observer patterns
- Functional programming with closures
- State management and dependency tracking
- Generic implementations with type safety

## Implementation Execution Plan

### Phase 1: Complete Problem Setup
**Execute immediately when command is run:**

#### 1.1 Directory Structure Creation
```bash
mkdir -p problems/react-evaluation/workspace/{src/{types,core},tests/public}
mkdir -p grading/react-evaluation/{tests/hidden,workspace}
```

#### 1.2 Core Files Creation
**Create these exact files with specified content:**

**`problems/react-evaluation/workspace/package.json`:**
```json
{
  "name": "react-evaluation",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "lint": "eslint . --ext .ts",
    "test:public": "vitest run --config vitest.config.public.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "tsx": "^4.10.2",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0",
    "@typescript-eslint/eslint-plugin": "^7.13.1",
    "@typescript-eslint/parser": "^7.13.1",
    "eslint": "^8.57.0"
  }
}
```

**`problems/react-evaluation/workspace/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`problems/react-evaluation/workspace/.eslintrc.cjs`:**
```javascript
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  }
};
```

#### 1.3 Source Code Implementation
**Copy and adapt from tmp/typescript/exercises/practice/react/react.ts:**

**`problems/react-evaluation/workspace/src/types/reactive.ts`:**
```typescript
export type EqualFn<T> = (lhs: T, rhs: T) => boolean
export type GetterFn<T> = () => T
export type SetterFn<T> = (value: T) => T
export type UnsubscribeFn = () => void
export type UpdateFn<T> = (value?: T) => T

export type InputPair<T> = [GetterFn<T>, SetterFn<T>]

export type Options = {
  name: string
}

export type ObserverR = {
  name?: string
}

export type ObserverV<T> = {
  value?: T
  updateFn: UpdateFn<T>
}

export type Observer<T> = ObserverR & ObserverV<T>

export type SubjectR = {
  name?: string
  observer: ObserverR | undefined
}

export type SubjectV<T> = {
  value: T
  equalFn?: EqualFn<T>
}

export type Subject<T> = SubjectR & SubjectV<T>

export let activeObserver: ObserverR
```

**`problems/react-evaluation/workspace/src/types/observers.ts`:**
```typescript
import { Observer, ObserverV, Subject } from './reactive.js'

export function updateObserver<T>(observer: Observer<T>): void {
  const prevObserver = activeObserver
  activeObserver = observer
  observer.value = observer.updateFn(observer.value)
  activeObserver = prevObserver
}
```

**`problems/react-evaluation/workspace/src/core/input.ts`:**
```typescript
import { InputPair, Options, Subject, activeObserver } from '../types/reactive.js'
import { updateObserver } from '../types/observers.js'

export function createInput<T>(
  value: T,
  _equal?: boolean | ((a: T, b: T) => boolean),
  options?: Options
): InputPair<T> {
  const s: Subject<T> = {
    name: options?.name,
    observer: undefined,
    value,
    equalFn: undefined,
  }

  const read: () => T = () => {
    if (activeObserver) s.observer = activeObserver
    return s.value
  }

  const write: (nextValue: T) => T = (nextValue) => {
    s.value = nextValue
    if (s.observer) updateObserver(s.observer as Observer<unknown>)
    return s.value
  }

  return [read, write]
}
```

**`problems/react-evaluation/workspace/src/core/computed.ts`:**
```typescript
import { GetterFn, UpdateFn, Observer, activeObserver } from '../types/reactive.js'
import { updateObserver } from '../types/observers.js'

export function createComputed<T>(
  updateFn: UpdateFn<T>,
  value?: T,
  _equal?: boolean | ((a: T, b: T) => boolean),
  options?: { name?: string }
): GetterFn<T> {
  const o: Observer<T> = {
    name: options?.name,
    value,
    updateFn,
  }
  updateObserver(o)
  return (): T => o.value!
}
```

**`problems/react-evaluation/workspace/src/core/callback.ts`:**
```typescript
import { UpdateFn, Observer, activeObserver } from '../types/reactive.js'
import { updateObserver } from '../types/observers.js'

export function createCallback<T>(_updateFn: UpdateFn<T>, _value?: T): () => void {
  const observer = {}
  return ((observer: unknown | undefined) => (): void => {
    if (!observer) return
    ;(observer as any) = undefined
  })(observer)
}
```

**`problems/react-evaluation/workspace/src/index.ts`:**
```typescript
export { createInput } from './core/input.js'
export { createComputed } from './core/computed.js'
export { createCallback } from './core/callback.js'
```

#### 1.4 Problem Specification
**`problems/react-evaluation/workspace/problem.md`:**
```markdown
# Reactive Programming System Implementation

Implement a reactive programming system in TypeScript with three main functions:

## Requirements

### createInput<T>(value, equal?, options?)
Creates an input closure with getter/setter pair:
- **getter**: Returns current value
- **setter**: Updates value and notifies observers
- **options.name**: Optional name for debugging
- **equal**: Optional equality function for change detection

### createComputed<T>(updateFn, value?, equal?, options?)
Creates a computed value that updates when dependencies change:
- **updateFn**: Function that computes value from dependencies
- **value**: Initial optional value
- **options.name**: Optional name for debugging
- **equal**: Optional equality function

### createCallback<T>(updateFn, value?)
Creates a callback closure that runs when dependencies change:
- **updateFn**: Function with side effects
- **value**: Initial optional value
- **returns**: Unsubscribe function

## Implementation Notes

- Use the provided type definitions from `types/reactive.ts`
- Implement observer pattern for dependency tracking
- Ensure proper cleanup with unsubscribe functions
- Focus on type safety and generic implementations
- Test with the provided public test suite

## Commands to Run

```bash
npm install
npm run typecheck
npm run lint
npm run test:public
npm run build
```

## Success Criteria

- All functions implement reactive programming patterns correctly
- Type safety is maintained throughout
- Observer pattern works for dependency tracking
- Memory management prevents leaks
- All public tests pass
```

#### 1.5 Public Test Suite
**`problems/react-evaluation/workspace/tests/public/input.spec.ts`:**
```typescript
import { describe, it, expect } from 'vitest'
import { createInput } from '../../src/index.js'

describe('createInput', () => {
  it('creates input with initial value', () => {
    const [getter, setter] = createInput(42)
    expect(getter()).toBe(42)
  })

  it('updates value through setter', () => {
    const [getter, setter] = createInput(42)
    setter(100)
    expect(getter()).toBe(100)
  })

  it('returns new value from setter', () => {
    const [getter, setter] = createInput(42)
    const result = setter(200)
    expect(result).toBe(200)
    expect(getter()).toBe(200)
  })
})
```

**`problems/react-evaluation/workspace/tests/public/computed.spec.ts`:**
```typescript
import { describe, it, expect } from 'vitest'
import { createInput, createComputed } from '../../src/index.js'

describe('createComputed', () => {
  it('creates computed with initial value', () => {
    const computed = createComputed(() => 42, 10)
    expect(computed()).toBe(10)
  })

  it('computes from dependencies', () => {
    const [input1] = createInput(1)
    const [input2] = createInput(2)
    
    const computed = createComputed(() => input1() + input2())
    expect(computed()).toBe(3)
  })

  it('updates when dependencies change', () => {
    const [input1, setInput1] = createInput(1)
    const [input2, setInput2] = createInput(2)
    
    const computed = createComputed(() => input1() + input2())
    expect(computed()).toBe(3)
    
    setInput1(10)
    expect(computed()).toBe(12)
  })
})
```

**`problems/react-evaluation/workspace/tests/public/callback.spec.ts`:**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { createInput, createCallback } from '../../src/index.js'

describe('createCallback', () => {
  it('returns unsubscribe function', () => {
    const callback = createCallback(() => {})
    expect(typeof callback).toBe('function')
  })

  it('can unsubscribe without errors', () => {
    const callback = createCallback(() => {})
    expect(() => callback()).not.toThrow()
  })
})
```

**`problems/react-evaluation/workspace/tests/vitest.config.public.ts`:**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/public/**/*.spec.ts'],
  },
})
```

### Phase 2: Grading Infrastructure Setup

#### 2.1 Grading Package Setup
**`grading/react-evaluation/package.json`:**
```json
{
  "name": "react-evaluation-grading",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint workspace/src workspace/tests --ext .ts",
    "typecheck": "tsc -p tsconfig.json",
    "test:hidden": "vitest run --config vitest.config.hidden.ts"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@typescript-eslint/eslint-plugin": "^7.13.1",
    "@typescript-eslint/parser": "^7.13.1",
    "eslint": "^8.57.0",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

#### 2.2 Hidden Test Suite
**`grading/react-evaluation/tests/hidden/advanced-observer.spec.ts`:**
```typescript
import { describe, it, expect } from 'vitest'
import { createInput, createComputed } from '../../../problems/react-evaluation/workspace/src/index.js'

describe('Advanced Observer Patterns', () => {
  it('handles complex dependency chains', () => {
    const [input1, setInput1] = createInput(1)
    const [input2, setInput2] = createInput(2)
    
    const computed = createComputed(() => input1() + input2())
    expect(computed()).toBe(3)
    
    setInput1(10)
    expect(computed()).toBe(12)
  })

  it('handles multiple computed dependencies', () => {
    const [base, setBase] = createInput(10)
    const [multiplier, setMultiplier] = createInput(2)
    
    const doubled = createComputed(() => base() * 2)
    const final = createComputed(() => doubled() * multiplier())
    
    expect(final()).toBe(40)
    
    setBase(20)
    expect(final()).toBe(80)
    
    setMultiplier(3)
    expect(final()).toBe(120)
  })

  it('prevents infinite recursion', () => {
    const [input, setInput] = createInput(1)
    
    let callCount = 0
    const computed = createComputed(() => {
      callCount++
      return input() + 1
    })
    
    expect(computed()).toBe(2)
    expect(callCount).toBe(1)
  })
})
```

### Phase 3: Evaluation Runner Creation

#### 3.1 Runner Implementation
**`evals/runReact.ts`:**
```typescript
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, cp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

type CommandResult = {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  error?: string;
};

type EvalRunResult = {
  profile: string;
  startedAt: string;
  finishedAt: string;
  runId: string;
  commands: CommandResult[];
  status: 'pass' | 'fail';
  workspaceArchive: string;
  notes?: string;
};

type ProfileConfig =
  | {
      name: string;
      kind: 'llxprt';
    }
  | {
      name: string;
      kind: 'codex';
    };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const workspaceSource = path.join(rootDir, 'problems', 'react-evaluation', 'workspace');
const gradingDir = path.join(rootDir, 'grading', 'react-evaluation');
const resultsDir = path.join(__dirname, 'results');

const PROFILES: ProfileConfig[] = [
  { name: 'cerebrasqwen3', kind: 'llxprt' },
  { name: 'synthetic', kind: 'llxprt' },
  { name: 'codex', kind: 'codex' }
];
const REQUIRED_GRADE_COMMANDS = new Set([
  'workspace:typecheck',
  'workspace:lint',
  'workspace:test:public',
  'workspace:build',
  'grading:lint',
  'grading:typecheck',
  'grading:test:hidden'
]);

// [Include all the helper functions from other runners: ensureDir, ensureDependencies, runCommand, copyWorkspace, syncWorkspaceForGrading, archiveWorkspace, main]

async function main(): Promise<void> {
  await ensureDir(resultsDir);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runResultsDir = path.join(resultsDir, `react-evaluation-${runId}`);
  await ensureDir(runResultsDir);

  const problemDescription = await readFile(
    path.join(workspaceSource, 'problem.md'),
    'utf8'
  );

  const prompt = [
    'You are implementing a reactive programming system in TypeScript.',
    'Implement the functions in src/types/reactive.ts, src/types/observers.ts, src/core/input.ts, src/core/computed.ts, and src/core/callback.ts to create a reactive programming system with:',
    '- createInput<T>() - Input closure with getter/setter pairs',
    '- createComputed<T>() - Computed values with dependency tracking',
    '- createCallback<T>() - Callback closures with subscription management',
    'Focus on type safety, memory management, and proper observer pattern implementation.',
    'After implementing the functions, run these commands: npm run typecheck, npm run lint, npm run test:public, npm run build.',
    'Do not fabricate test results; share any command output that fails.',
    'Problem context:',
    problemDescription
  ].join('\n\n');

  await ensureDependencies(gradingDir);

  const results: EvalRunResult[] = [];

  for (const profile of PROFILES) {
    console.log(`\n=== Evaluating profile: ${profile.name} (${profile.kind}) ===`);
    const startedAt = new Date().toISOString();
    const workspaceCopy = await copyWorkspace(workspaceSource);
    const commandResults: CommandResult[] = [];

    // [Include the full evaluation logic from other runners]
  }

  // [Include cleanup and summary writing logic]
}

main().catch((error) => {
  console.error('Evaluation run failed:', error);
  process.exitCode = 1;
});
```

### Phase 4: Integration

#### 4.1 Package.json Update
```bash
# Add to root package.json scripts section:
"eval:react": "tsx evals/runReact.ts"
```

#### 4.2 Framework Integration
- Add React evaluation to overall evaluation suite
- Ensure consistency with existing evaluation patterns
- Test all model profiles

## Execution Instructions

**After clearing context, simply run:**
```bash
"@project-plans/react/"
```

This will execute the complete implementation across all phases:
1. Create full directory structure
2. Implement all source files with proper content
3. Set up grading infrastructure
4. Create evaluation runner
5. Integrate with framework

## Success Metrics

### Technical Success Criteria
1. **All models can implement basic reactive patterns**
2. **Hidden tests catch edge cases and memory leaks**
3. **Multi-file coordination is properly evaluated**
4. **Type safety is enforced throughout implementation**

### Evaluation Success Criteria
1. **Clear capability differentiation** between models
2. **Framework consistency** with existing evaluations
3. **Reproducible results** across multiple runs
4. **Comprehensive test coverage** of reactive patterns

## MIT License Compliance

### Attribution Requirements
- Credit Exercism as original source in problem.md
- Reference MIT License compatibility
- Document modifications clearly
- Maintain license compatibility

## Value Proposition

This exercise addresses a gap in our evaluation suite by testing:
- Modern reactive programming patterns
- Complex type system usage
- State management coordination
- Industry-relevant React-like patterns

It provides a challenging but realistic multi-file problem that tests advanced TypeScript capabilities.

## Conclusion

The React exercise implementation provides a significant enhancement to our evaluation framework by testing modern, industry-relevant programming patterns. The multi-file complexity ensures models are evaluated on realistic development scenarios while maintaining our framework's unique focus on coordination and type safety.