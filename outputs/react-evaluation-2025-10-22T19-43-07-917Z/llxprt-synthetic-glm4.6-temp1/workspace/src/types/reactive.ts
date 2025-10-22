/**
 * Type definitions for the reactive programming system
 * Adapted from Exercism TypeScript React exercise
 * MIT License - Original by Exercism community
 */

export type EqualFn<T> = (lhs: T, rhs: T) => boolean
export type GetterFn<T> = () => T
export type SetterFn<T> = (value: T) => T
export type UnsubscribeFn = () => void
export type UpdateFn<T> = (value?: T) => T

export type InputPair<T> = [GetterFn<T>, SetterFn<T>]

export type Options = {
  name?: string // for debugging
}

export type ObserverR = {
  name?: string
  observers?: Set<ObserverR | undefined>
}

export type ObserverV<T> = {
  value?: T
  updateFn: UpdateFn<T>
}

export type Observer<T> = ObserverR & ObserverV<T>

export type SubjectR = {
  name?: string
  observers: Set<ObserverR | undefined>
}

export type SubjectV<T> = {
  value: T
  equalFn?: EqualFn<T>
}

export type Subject<T> = SubjectR & SubjectV<T>

let activeObserver: ObserverR | undefined

export function getActiveObserver(): ObserverR | undefined {
  return activeObserver
}

const updating = new Set<ObserverR>()

export function updateObserver<T>(observer: Observer<T>): void {
  if (updating.has(observer)) return
  
  updating.add(observer)
  const previous = activeObserver
  activeObserver = observer
  try {
    observer.value = observer.updateFn(observer.value)
    
    // Notify all observers of this observer
    if (observer.observers) {
      const observers = Array.from(observer.observers)
      observers.forEach(obs => {
        if (obs && obs !== previous) {
          updateObserver(obs as Observer<unknown>)
        }
      })
    }
  } finally {
    activeObserver = previous
    updating.delete(observer)
  }
}
