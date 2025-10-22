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
  const callback: Observer<T> = {
    value,
    updateFn,
  }

  let disposed = false

  const run = () => {
    if (disposed) return
    updateObserver(callback)
  }

  run()

  return () => {
    if (disposed) return
    disposed = true
    callback.value = undefined
    callback.updateFn = () => value!
  }
}