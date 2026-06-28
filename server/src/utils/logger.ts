import pino from 'pino';

// Structured, leveled JSON logger.
//
//  - Production: plain JSON to stdout (one object per line) so log aggregators
//    (Render logs, Loki, Datadog, etc.) can parse it without extra config.
//  - Development: pretty, colourised, human-readable output via pino-pretty.
//  - Tests: silent, so Jest output stays clean.
//
// Level is controlled by LOG_LEVEL (default 'info', or 'silent' under test).
const isTest = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
const isProd = process.env.NODE_ENV === 'production';

const level = process.env.LOG_LEVEL || (isTest ? 'silent' : 'info');

export const logger = pino({
  level,
  // Pretty-print only in non-production, non-test environments.
  transport:
    !isProd && !isTest
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  // Never log secrets if a request/headers object is ever attached.
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password'],
    censor: '[redacted]',
  },
});

export default logger;
