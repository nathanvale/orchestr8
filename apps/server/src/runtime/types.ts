/**
 * Runtime adapter types for abstracting server implementations
 * between Bun (production) and Node.js (testing)
 */

/**
 * Represents a running server instance
 */
export interface RuntimeServer {
  /** The port the server is listening on */
  port: number
  /** The hostname the server is bound to */
  hostname: string
  /** Stops the server and releases resources */
  stop: () => void | Promise<void>
}

/**
 * Options for starting a server
 */
export interface ServeOptions {
  /** Port to bind to (can be string or number) */
  port: number | string
  /** Request handler function following Fetch API */
  fetch: (request: Request) => Promise<Response> | Response
}

/**
 * Runtime abstraction interface
 */
export interface Runtime {
  /** Start a server with the given options */
  serve: (options: ServeOptions) => RuntimeServer
}
