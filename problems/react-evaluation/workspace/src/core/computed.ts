/**
 * Computed closure implementation for derived values.
 */

import { 
  GetterFn, 
  UpdateFn, 
  Observer, 
  updateObserver,
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
  const o: Observer<T> = {
    name: options?.name,
    value,
    updateFn,
  }
  updateObserver(o)
  return (): T => o.value!
}
