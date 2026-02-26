import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

export const sentryEnabled = Boolean(dsn)

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: 'sourcekit@1.0.0',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  })
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (sentryEnabled) {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  }
}
