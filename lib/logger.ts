// lib/logger.ts
import pino from 'pino'

const isProd = process.env.NODE_ENV === 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  redact: ['req.headers.authorization', 'password'],
})
