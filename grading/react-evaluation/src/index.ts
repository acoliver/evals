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