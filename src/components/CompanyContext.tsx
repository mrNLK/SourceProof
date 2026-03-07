import { Building2, TrendingUp, TrendingDown, Users, DollarSign, Loader2, ExternalLink, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { useHarmonicCompany, extractCompanyDomain } from "@/hooks/useHarmonicCompany"
import type { CompanyPoachability } from "@/types/harmonic"

interface CompanyContextProps {
  bio?: string
  about?: string
  companyDomain?: string | null
}

function formatFunding(amount?: number): string {
  if (!amount) return 'Undisclosed'
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${amount}`
}

function formatStage(stage?: string): string {
  if (!stage) return 'Unknown'
  return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function PoachabilityBadge({ score }: { score: number }) {
  let color: string
  let label: string

  if (score >= 70) {
    color = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    label = 'High Poachability'
  } else if (score >= 50) {
    color = 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    label = 'Moderate'
  } else {
    color = 'bg-red-500/15 text-red-400 border-red-500/30'
    label = 'Hard to Poach'
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {score >= 60 ? <TrendingUp className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {label} ({score})
    </span>
  )
}

function MetricRow({ label, value, trend }: { label: string; value: string; trend?: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-foreground">{value}</span>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs ${trend > 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center gap-0.5`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}

export function CompanyContext({ bio, about, companyDomain }: CompanyContextProps) {
  const [expanded, setExpanded] = useState(false)
  const domain = companyDomain || extractCompanyDomain(bio, about)
  const { company, poachability, isLoading, error } = useHarmonicCompany(domain)

  if (!domain) return null

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading company intel for {domain}...
        </div>
      </div>
    )
  }

  if (error || !company || !poachability) return null

  const tm = company.traction_metrics

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
      >
        {company.logo_url ? (
          <img src={company.logo_url} alt="" className="w-8 h-8 rounded-md object-contain bg-white/5 border border-border" />
        ) : (
          <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{company.name}</span>
            <PoachabilityBadge score={poachability.score} />
          </div>
          <span className="text-xs text-muted-foreground">
            {formatStage(company.stage)} · {company.headcount ? `${company.headcount} employees` : 'Size unknown'}
            {company.funding?.fundingTotal ? ` · ${formatFunding(company.funding.fundingTotal)} raised` : ''}
          </span>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50">
          {/* Description */}
          {company.short_description && (
            <p className="text-xs text-muted-foreground mt-2 mb-2 line-clamp-2">
              {company.short_description}
            </p>
          )}

          {/* Key Metrics */}
          <div className="space-y-0.5 mt-2">
            {company.headcount !== undefined && (
              <MetricRow
                label="Headcount"
                value={company.headcount.toLocaleString()}
                trend={tm?.headcount?.ago90d?.percentChange}
              />
            )}
            {tm?.headcountEngineering?.ago90d?.percentChange !== undefined && (
              <MetricRow
                label="Engineering Team"
                value=""
                trend={tm.headcountEngineering.ago90d.percentChange}
              />
            )}
            {tm?.webTraffic?.ago30d?.percentChange !== undefined && (
              <MetricRow
                label="Web Traffic (30d)"
                value=""
                trend={tm.webTraffic.ago30d.percentChange}
              />
            )}
            {company.funding?.fundingTotal !== undefined && (
              <MetricRow label="Total Funding" value={formatFunding(company.funding.fundingTotal)} />
            )}
            {company.funding?.lastFundingDate && (
              <MetricRow
                label="Last Round"
                value={`${company.funding.lastFundingType || ''} ${new Date(company.funding.lastFundingDate).toLocaleDateString()}`}
              />
            )}
          </div>

          {/* Poachability Signals */}
          {poachability.signals.length > 0 && (
            <div className="mt-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Poachability Signals</span>
              <div className="mt-1 space-y-1">
                {poachability.signals.map((signal, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                    <span className="mt-0.5 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                    {signal}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Investors */}
          {poachability.topInvestors && poachability.topInvestors.length > 0 && (
            <div className="mt-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lead Investors</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {poachability.topInvestors.map((inv, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted/40 text-foreground/70 border border-border/50">
                    {inv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {company.tags_v2 && company.tags_v2.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {company.tags_v2.slice(0, 6).map((tag, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-primary/5 text-primary/70 border border-primary/20">
                  {tag.displayValue}
                </span>
              ))}
            </div>
          )}

          {/* Links */}
          <div className="flex gap-3 mt-3">
            {company.website?.url && (
              <a
                href={company.website.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary/70 hover:text-primary flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Website
              </a>
            )}
            {company.socials?.linkedin?.url && (
              <a
                href={company.socials.linkedin.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary/70 hover:text-primary flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
