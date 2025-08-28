import { http, HttpResponse } from 'msw'

export const handlers = [
  // User management
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    ])
  }),

  http.post('/api/users', async ({ request }) => {
    const newUser = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      {
        id: Date.now(),
        ...newUser,
      },
      { status: 201 },
    )
  }),

  http.put('/api/users/:id', async ({ params, request }) => {
    const { id } = params
    const updates = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: Number(id),
      ...updates,
    })
  }),

  http.delete('/api/users/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Authentication
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string }

    if (email === 'admin@example.com' && password === 'password') {
      return HttpResponse.json({
        token: 'mock-jwt-token',
        user: {
          id: 1,
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'admin',
        },
      })
    }

    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }),

  // File upload
  http.post('/api/upload', () => {
    return HttpResponse.json({
      url: 'https://example.com/uploaded-file.jpg',
      id: 'file-123',
    })
  }),

  // Paginated data
  http.get('/api/posts', ({ request }) => {
    const url = new URL(request.url)
    const pageParam = Number(url.searchParams.get('page') ?? 1)
    const limitParam = Number(url.searchParams.get('limit') ?? 10)

    // Guard against invalid pagination parameters
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : Math.floor(pageParam)
    const limit = Number.isNaN(limitParam) || limitParam <= 0 ? 10 : Math.floor(limitParam)

    const posts = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      title: `Post ${String(i + 1)}`,
      content: `Content for post ${String(i + 1)}`,
    }))

    const start = (page - 1) * limit
    const end = start + limit

    return HttpResponse.json({
      data: posts.slice(start, end),
      pagination: {
        page,
        limit,
        total: posts.length,
        totalPages: Math.ceil(posts.length / limit),
      },
    })
  }),
]
