/**
 * Input closure implementation
 * Adapted from Exercism TypeScript React exercise
 * MIT License - Original by Exercism community
 */

import {
  InputPair,
  Subject,
  Observer,
  getActiveObserver,
  updateObserver,
  EqualFn,
  GetterFn,
  SetterFn,
  Options
} from '../types/reactive.js'

function defaultEqualFn<T>(lhs: T, rhs: T): boolean {
  return lhs === rhs
}

/**
 * Creates an input closure. The value is accessed
 * via the accessor and changed via the
 * mutator returned as part an `InputPair<T>`.
 */
export function createInput<T>(
  value: T,
  equal?: boolean | EqualFn<T>,
  options?: Options
): InputPair<T> {
  // Process the equal function parameter
  let finalEqualFn: EqualFn<T> | undefined
  if (equal === true) {
    finalEqualFn = defaultEqualFn
  } else if (equal === false) {
    finalEqualFn = undefined
  } else if (typeof equal === 'function') {
    finalEqualFn = equal
  }

  const s: Subject<T> = {
    name: options?.name,
    observer: undefined,
    value,
    equalFn: finalEqualFn,
  }

  const read: GetterFn<T> = () => {
    const observer = getActiveObserver()
    if (observer) {
      // Link this subject to the active observer (e.g. a computed or callback)
      s.observer = observer;
    }
    return s.value
  }

  const write: SetterFn<T> = (nextValue) => {
    // Use the provided equal function or strict equality to check if the value has actually changed
    const isEqual = s.equalFn ?? defaultEqualFn
    if (!isEqual(s.value, nextValue)) {
      s.value = nextValue
      // If there's an observer linked to this subject, notify it of the change
      if (s.observer) {
        // Type assertion is necessary as the ObserverR type doesn't have all details of Observer<T>
        updateObserver(s.observer as Observer<unknown>)
      }
    }
    return s.value
  }

  return [read, write]
}