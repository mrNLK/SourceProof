import posthog from 'posthog-js'

const apiKey = import.meta.env.VITE_POSTHOG_KEY
const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

export const analyticsEnabled = Boolean(apiKey)

if (apiKey) {
  posthog.init(apiKey, {
    api_host: apiHost,
    capture_pageview: false, // we fire page_viewed manually
    persistence: 'localStorage',
  })
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (analyticsEnabled) {
    posthog.capture(event, properties)
  }
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  if (analyticsEnabled) {
    posthog.identify(userId, traits)
  }
}

export function reset() {
  if (analyticsEnabled) {
    posthog.reset()
  }
}
