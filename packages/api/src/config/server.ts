export const serverConfig = {
  port: process.env['PORT'] || 3000,
  env: process.env['NODE_ENV'] || 'development',
  api: {
    prefix: '/api',
    version: 'v1',
  },
  cors: {
    origin: process.env['CORS_ORIGIN'] || '*',
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
};
