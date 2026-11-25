import { useEffect, useMemo, useSyncExternalStore } from 'react'

type Result<T> = { data?: T; error?: Error }
const primed = new WeakMap<() => Promise<unknown>, Promise<unknown>>()

export function primeRequest<T>(load: () => Promise<T>) {
  const pending = (primed.get(load) as Promise<T> | undefined) ?? load()
  primed.set(load, pending)
  // The route can be left before it subscribes.
  void pending.catch(() => {})
  return pending
}

function resource<T>(load: () => Promise<T>) {
  let result: Result<T> = {}
  let pending: Promise<void> | undefined
  const listeners = new Set<() => void>()

  function publish(next: Result<T>) {
    result = next
    for (const notify of listeners) notify()
  }

  function reload() {
    if (pending) return pending
    if (result.error) publish({ data: result.data })
    const prepared = primed.get(load) as Promise<T> | undefined
    primed.delete(load)
    pending = (prepared ?? load()).then(
      (data) => publish({ data }),
      (reason: unknown) => publish({
        data: result.data,
        error: reason instanceof Error ? reason : new Error('Попробуйте ещё раз.'),
      }),
    ).finally(() => { pending = undefined })
    return pending
  }

  return {
    reload,
    ensure: () => { if (!result.data && !result.error) void reload() },
    snapshot: () => result,
    subscribe(notify: () => void) {
      listeners.add(notify)
      return () => { listeners.delete(notify) }
    },
  }
}

export function useRequest<T>(load: () => Promise<T>, enabled: boolean) {
  const request = useMemo(() => resource(load), [load])
  const result = useSyncExternalStore(request.subscribe, request.snapshot)
  useEffect(() => { if (enabled) request.ensure() }, [enabled, request])
  return { ...result, reload: request.reload, ensure: request.ensure }
}
