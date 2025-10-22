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
  equal?: boolean | EqualFn<T>,
  options?: Options
): InputPair<T> {
  const equalFn: EqualFn<T> | undefined = 
    equal === true ? (a: T, b: T) => a === b :
    equal === false || equal === undefined ? undefined :
    typeof equal === 'function' ? equal : undefined

  const s: Subject<T> = {
    name: options?.name,
    observers: new Set(),
    value,
    equalFn,
  }

  const read: GetterFn<T> = () => {
    const observer = getActiveObserver()
    if (observer) {
      s.observers.add(observer)
    }
    return s.value
  }

  const write: SetterFn<T> = (nextValue) => {
    const hasChanged = !equalFn || !equalFn(s.value, nextValue)
    if (!hasChanged) return s.value
    
    s.value = nextValue
    
    s.observers.forEach(observer => {
      if (observer) {
        updateObserver(observer as Observer<unknown>)
      }
    })
    
    return s.value
  }

  return [read, write]
}
