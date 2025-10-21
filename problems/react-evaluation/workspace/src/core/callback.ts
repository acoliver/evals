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
  
  // Register observer to track dependencies
  updateObserver(observer)
  
  let disposed = false
  
  return () => {
    if (disposed) return
    disposed = true
    
    // Clear the observer to stop further updates
    observer.value = undefined
    observer.updateFn = () => value!
  }
}