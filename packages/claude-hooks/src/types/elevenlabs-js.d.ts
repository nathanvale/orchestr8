declare module '@elevenlabs/elevenlabs-js' {
  export class ElevenLabsClient {
    constructor(config?: { apiKey?: string })
    textToSpeech: {
      convert: (
        voiceId: string,
        request: {
          text: string
          modelId?: string
          outputFormat?: string
          voiceSettings?: Record<string, unknown>
          enableLogging?: boolean
        },
        requestOptions?: Record<string, unknown>,
      ) => AsyncIterable<Uint8Array> | Promise<AsyncIterable<Uint8Array>>
    }
    voices: {
      search: (
        request?: Record<string, unknown>,
        requestOptions?: Record<string, unknown>,
      ) => Promise<{ voices?: Array<Record<string, unknown>> }>
    }
  }
}
