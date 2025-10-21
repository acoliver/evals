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
  name: string // for debugging
}

export type ObserverR = {
  name?: string
}

export type ObserverV<T> = {
  value?: T
  updateFn: UpdateFn<T>
}

export type Observer<T> = ObserverR & ObserverV<T>

export type SubjectR = {
  name?: string
  observer: ObserverR | undefined
}

export type SubjectV<T> = {
  value: T
  equalFn?: EqualFn<T>
}

export type Subject<T> = SubjectR & SubjectV<T>

// module Context value
let activeObserver: ObserverR

export function updateObserver<T>(observer: Observer<T>): void {
  const prevObserver = activeObserver
  activeObserver = observer
  observer.value = observer.updateFn(observer.value)
  activeObserver = prevObserver
}

export { activeObserver }