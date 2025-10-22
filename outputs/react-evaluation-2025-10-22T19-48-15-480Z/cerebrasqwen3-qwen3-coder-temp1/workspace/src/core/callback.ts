/**
 * Callback closure implementation
 * Adapted from Exercism TypeScript React exercise
 * MIT License - Original by Exercism community
 */

import { UnsubscribeFn, Observer, UpdateFn, updateObserver } from '../types/reactive.js'

/**
 * Creates a callback closure with the supplied
 * function which is expected to perform side effects.
 */
export function createCallback<T>(updateFn: UpdateFn<T>, value?: T): UnsubscribeFn {
  const observer: Observer<T> = {
    value,
    updateFn,
  }

  // Register observer and run the initial effect
  updateObserver(observer)

  let disposed = false

  return () => {
    if (disposed) return
    disposed = true

    // Marking as disposed is enough. There's no complex linking to sever in this model.
    // The observer itself will be garbage collected.
  }
}