/**
 * Deno runtime type declarations for Supabase Edge Functions.
 * This file lets VS Code's TypeScript server understand Deno globals
 * without requiring the Deno extension to be active.
 */

declare namespace Deno {
  // ── Environment Variables ──────────────────────────────────────────
  interface Env {
    /** Returns the value of an environment variable, or undefined if not set. */
    get(key: string): string | undefined
    /** Sets an environment variable. */
    set(key: string, value: string): void
    /** Deletes an environment variable. */
    delete(key: string): void
    /** Returns true if the environment variable is set. */
    has(key: string): boolean
    /** Returns all environment variables as an object. */
    toObject(): { [key: string]: string }
  }

  /** Access to environment variables. */
  const env: Env

  // ── HTTP Server ────────────────────────────────────────────────────
  interface ServeOptions {
    port?: number
    hostname?: string
    signal?: AbortSignal
    reusePort?: boolean
    onError?: (error: unknown) => Response | Promise<Response>
    onListen?: (params: { hostname: string; port: number }) => void
  }

  interface ServeHandlerInfo {
    remoteAddr: { transport: string; hostname: string; port: number }
  }

  type ServeHandler = (
    request: Request,
    info?: ServeHandlerInfo,
  ) => Response | Promise<Response>

  /** Starts an HTTP server with the given handler. */
  function serve(handler: ServeHandler, options?: ServeOptions): void
  function serve(options: ServeOptions & { handler: ServeHandler }): void
}
