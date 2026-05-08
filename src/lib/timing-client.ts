export async function timed<T>(label: string, fn: () => Promise<T>, meta?: Record<string, any>): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const ms = Math.round(performance.now() - start)
    console.log(JSON.stringify({ kind: 'timing', label, ms, ok: true, ...meta }))
    return result
  } catch (err: any) {
    const ms = Math.round(performance.now() - start)
    console.log(JSON.stringify({ kind: 'timing', label, ms, ok: false, error: err?.message, ...meta }))
    throw err
  }
}

export function timeBlock(label: string, meta?: Record<string, any>) {
  const start = performance.now()
  return {
    end: (extra?: Record<string, any>) => {
      const ms = Math.round(performance.now() - start)
      console.log(JSON.stringify({ kind: 'timing', label, ms, ...meta, ...extra }))
      return ms
    }
  }
}
