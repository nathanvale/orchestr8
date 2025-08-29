import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Runtime, RuntimeServer } from './types'

// Helper to process request body
async function collectBody(nodeReq: http.IncomingMessage): Promise<Buffer> {
  const bodyChunks: Buffer[] = []
  return new Promise<Buffer>((resolve, reject) => {
    nodeReq.on('data', (chunk: Buffer) => bodyChunks.push(chunk))
    nodeReq.on('end', () => {
      resolve(Buffer.concat(bodyChunks))
    })
    nodeReq.on('error', reject)
  })
}

// Helper to handle requests
// eslint-disable-next-line max-statements
async function handleRequest(
  nodeReq: http.IncomingMessage,
  nodeRes: http.ServerResponse,
  fetch: (request: Request) => Promise<Response> | Response,
  actualPort: number,
): Promise<void> {
  try {
    // Build URL
    const url = `http://localhost:${String(actualPort)}${nodeReq.url ?? '/'}`

    // Convert headers
    const headers = new Headers()
    for (const [key, value] of Object.entries(nodeReq.headers)) {
      if (Array.isArray(value)) {
        headers.set(key, value.join(', '))
      } else if (value !== undefined) {
        headers.set(key, value)
      }
    }

    // Collect body
    const body = await collectBody(nodeReq)

    // Create request
    const request = new Request(url, {
      method: nodeReq.method ?? 'GET',
      headers,
      body: body.length > 0 ? body : undefined,
    })

    // Call fetch handler
    let response: Response
    try {
      response = await fetch(request)
    } catch (error) {
      response = new Response(
        JSON.stringify({
          error: 'Internal error',
          details: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Write response
    nodeRes.statusCode = response.status
    nodeRes.statusMessage = response.statusText || ''

    for (const [key, value] of response.headers.entries()) {
      nodeRes.setHeader(key, value)
    }

    const responseBody = await response.arrayBuffer()
    nodeRes.end(Buffer.from(responseBody))
  } catch (error) {
    nodeRes.statusCode = 500
    nodeRes.setHeader('Content-Type', 'application/json')
    nodeRes.end(
      JSON.stringify({
        error: 'Unhandled error',
        details: error instanceof Error ? error.message : String(error),
      }),
    )
  }
}

/**
 * Node.js runtime adapter for testing with Vitest
 * Provides compatibility layer between Node.js http module and Fetch API
 */
export function nodeRuntime(): Runtime {
  return {
    serve({ port, fetch }) {
      const server = http.createServer((nodeReq, nodeRes) => {
        const address = server.address() as AddressInfo | null
        const actualPort = address?.port ?? Number(port)
        void handleRequest(nodeReq, nodeRes, fetch, actualPort)
      })

      // Start listening
      server.listen(Number(port))

      // Get actual port
      const address = server.address() as AddressInfo | null
      const actualPort = address?.port ?? Number(port)

      return {
        port: actualPort,
        hostname: 'localhost',
        stop: () =>
          new Promise<void>((resolve, reject) => {
            server.close((err) => {
              if (err) reject(err)
              else resolve()
            })
          }),
      } satisfies RuntimeServer
    },
  }
}
