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
    const observer = getActiveObserver()
    if (observer) s.observer = observer
    return s.value
  }

  const write: SetterFn<T> = (nextValue) => {
    s.value = nextValue
    if (s.observer) updateObserver(s.observer as Observer<unknown>)
    return s.value
  }

  return [read, write]
}
