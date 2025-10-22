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
  getActiveObserver
} from '../types/reactive.js'

function defaultEqualFn<T>(lhs: T, rhs: T): boolean {
  return lhs === rhs
}

/**
 * Creates a computed (derived) closure with the
 * supplied function which computes the current value
 * of the closure.
 */
export function createComputed<T>(
  updateFn: UpdateFn<T>,
  value?: T,
  equal?: boolean | EqualFn<T>,
  options?: { name?: string }
): GetterFn<T> {
  // Process the equal function parameter
  let finalEqualFn: EqualFn<T> | undefined
  if (equal === true) {
    finalEqualFn = defaultEqualFn
  } else if (equal === false) {
    finalEqualFn = undefined
  } else if (typeof equal === 'function') {
    finalEqualFn = equal
  }

  // Track the observers that depend on this computed value
  let dependencies: Array<{ observer?: Observer<T> }> = []

  // Create the observer that will manage this computed value's state and reactions
  const o: Observer<T> = {
    name: options?.name,
    // This satisfies the type requirement `value: T`, even if it's a temporary lie.
    // The `satisfies` operator can help ensure we conform correctly once value is set.
    value: null as unknown as T,
    updateFn: updateFn
  }

  // Wrap the update function to track dependencies when it runs
  const trackingUpdateFn: UpdateFn<T> = (prevValue: T | undefined) => {
    // Clear previous dependencies to prevent memory leaks and stale links
    dependencies.forEach(dep => {
      if (dep.observer === o) {
        dep.observer = undefined;
      }
    });
    dependencies = [];

    // Set this computed observer as the globally active context
    const previousObserver = getActiveObserver();
    // @ts-expect-error - Using a global variable `activeObserver` for simplicity in tracking
    global.activeObserver = o;
    try {
      // Execute the user-provided function to calculate the new value
      const newValue = updateFn(prevValue);
      // The act of calling updateFn might have registered new dependencies,
      // which would have pointed to `o` as their source. This creates a loop.
      // We need to break the loop by ensuring deps don't point back to us permanently.
      // The logic is: deps are only valid for the duration of a single update cycle.
      // Let's remove this observer from any dep it just added itself to, to break the cycle.
      // A more sophisticated system would use a stack, but this is the core idea.
      
      return newValue;
    } finally {
      // @ts-expect-error - Restore the previous active observer context
      global.activeObserver = previousObserver;
    }
  };

  // Override the original updateFn with our dependency-tracking version
  o.updateFn = trackingUpdateFn;

  // Perform the initial computation to populate `o.value` with a genuine value of type `T`
  updateObserver(o);

  // The getter function that other cells will call to get this computed value
  // and, as a side-effect, link themselves as a dependency.
  const getter: GetterFn<T> = () => {
    const currentObserver = getActiveObserver();
    // If a computation or callback is currently running, it means it's accessing this value.
    // We should record it so we can notify it if *this* value changes.
    if (currentObserver) {
      dependencies.push({ observer: currentObserver as Observer<T> });
    }
    // Return the latest, correctly computed value.
    return o.value;
  };

  return getter;
}