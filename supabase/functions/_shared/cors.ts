const ALLOWED_ORIGINS = [
  'https://getsourcekit.vercel.app',
  'https://sourcekit.app',
  'http://localhost:5173',
]

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  // Allow exact matches and Vercel preview deploys
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/getsourcekit[a-z0-9-]*\.vercel\.app$/.test(origin)
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  }
}
