let debugLogging = false

export function setDebugLogging(enabled: boolean): void {
  debugLogging = enabled
}

/** Console logger whose debug output only appears when debug logging is enabled in settings. */
export function createLogger(scope: string) {
  const prefix = `[Immersive Memorize:${scope}]`
  return {
    debug: (...args: unknown[]) => {
      if (debugLogging) console.log(prefix, ...args)
    },
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
