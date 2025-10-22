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
  getActiveObserver,
  EqualFn
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
  const computed: Observer<T> = {
    name: options?.name,
    value,
    updateFn,
    observers: new Set(),
  }

  const getter: GetterFn<T> = () => {
    const observer = getActiveObserver()
    if (observer) {
      computed.observers!.add(observer)
    }

    return computed.value!
  }

  // Initialize the computed value
  updateObserver(computed)

  return getter
}