import { http, HttpResponse } from 'msw'

export const handlers = [
  http.post('/api/llm', () => {
    return HttpResponse.json({
      response: 'Mocked LLM response',
    })
  }),
]
