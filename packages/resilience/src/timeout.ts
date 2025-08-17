import type { TimeoutOptions, ResilienceOperation } from './types.js'
import { TimeoutError } from './types.js'

export async function timeout<T>(
  operation: ResilienceOperation<T>,
  options: TimeoutOptions,
): Promise<T> {
  const controller = new AbortController()

  const timeoutId = setTimeout(() => {
    controller.abort()
  }, options.timeoutMs)

  try {
    const result = await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new TimeoutError())
        })
      }),
    ])

    clearTimeout(timeoutId)
    return result
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}
