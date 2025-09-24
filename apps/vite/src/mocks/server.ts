/**
 * MSW worker setup for development browser environment
 */
import { worker } from './browser'
import { handlers } from './handlers'

worker.use(...handlers)
