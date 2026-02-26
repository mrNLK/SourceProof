import { loadStripe, type Stripe } from '@stripe/stripe-js'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  if (!publishableKey) return Promise.resolve(null)
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise
}

export type PlanStatus = 'free' | 'pro' | 'past_due'

export interface PlanInfo {
  status: PlanStatus
  current_period_end?: string
}

const PLAN_STORAGE_KEY = 'sourcekit_plan'

export function loadPlan(): PlanInfo {
  try {
    const data = localStorage.getItem(PLAN_STORAGE_KEY)
    if (data) return JSON.parse(data)
  } catch { /* ignore */ }
  return { status: 'free' }
}

export function savePlan(plan: PlanInfo): void {
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
  } catch { /* ignore */ }
}

export async function createCheckoutSession(supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ return_url: window.location.origin + '/settings' }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Checkout failed: ${err}`)
  }

  const { url } = await res.json()
  return url
}

export async function fetchPlanStatus(supabaseUrl: string, supabaseKey: string): Promise<PlanInfo> {
  const res = await fetch(`${supabaseUrl}/functions/v1/billing-status`, {
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
    },
  })

  if (!res.ok) return { status: 'free' }
  return res.json()
}
