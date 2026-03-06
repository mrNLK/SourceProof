"""
Claude API: Document Update Generator

Generates cited redlines and document updates using the Anthropic API.
"""

import json
import logging
from datetime import date

import anthropic

from strata import config
from strata.database import supabase

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096

DEFAULT_MEMO_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui, sans-serif; color: #1a1a2e; max-width: 900px; margin: 0 auto; padding: 24px; }
  h1 { color: #0a0a0f; border-bottom: 2px solid #00e5a0; padding-bottom: 8px; }
  h2 { color: #1a1a2e; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #0f0f18; color: #e8e8f0; text-align: left; padding: 10px 12px; }
  td { border-bottom: 1px solid #e0e0e0; padding: 10px 12px; }
  .section { margin: 24px 0; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 13px; color: #6b6b8a; }
  .redline-add { background: rgba(0,200,100,0.15); border-left: 3px solid #00e5a0; padding: 2px 6px; }
  .redline-remove { text-decoration: line-through; opacity: 0.5; }
  sup.cite { color: #4a9eff; font-size: 10px; }
</style>
</head>
<body>
<h1>[CLIENT NAME] Regulatory Intelligence Brief</h1>

<div class="section">
<h2>1. Rate Case &amp; Tariff Status</h2>
<table>
  <thead><tr><th>Docket</th><th>Status</th><th>Effective Date</th><th>Impact</th></tr></thead>
  <tbody>
    <tr><td>—</td><td>—</td><td>—</td><td>—</td></tr>
  </tbody>
</table>
</div>

<div class="section">
<h2>2. Interconnection Queue</h2>
<table>
  <thead><tr><th>Filing</th><th>Order Date</th><th>Key Changes</th><th>Asset Impact</th></tr></thead>
  <tbody>
    <tr><td>—</td><td>—</td><td>—</td><td>—</td></tr>
  </tbody>
</table>
</div>

<div class="section">
<h2>3. Compliance Actions Required</h2>
<table>
  <thead><tr><th>Action</th><th>Priority</th><th>Deadline</th><th>Owner</th></tr></thead>
  <tbody>
    <tr><td>—</td><td>—</td><td>—</td><td>—</td></tr>
  </tbody>
</table>
</div>

<div class="section">
<h2>4. Background &amp; Context</h2>
<p>No regulatory updates to report at this time.</p>
</div>

<div class="footer">
  <p>Last updated: —</p>
  <p>Version: 1</p>
  <p>Sources: —</p>
</div>
</body>
</html>"""


def load_memo_template(client_id: str) -> str:
    """Load the most recent published memo template for a client."""
    result = (
        supabase.table("document_versions")
        .select("content_html")
        .eq("client_id", client_id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if result.data and result.data[0].get("content_html"):
        return result.data[0]["content_html"]
    return DEFAULT_MEMO_TEMPLATE


def build_generation_prompt(
    template_html: str, extraction: dict, item: dict
) -> str:
    """Build the prompt for Claude document generation."""
    return f"""You are a regulatory intelligence analyst generating a cited document update for a US utility client.

You will receive:
1. The current memo HTML template
2. Structured extraction data from a new regulatory filing
3. Metadata about the filing

Your task: Return updated HTML that incorporates the new regulatory information into the appropriate sections of the memo.

Rules:
- Mark changed or added content with: <span class="redline-add" style="background: rgba(0,200,100,0.15); border-left: 3px solid #00e5a0; padding: 2px 6px;">NEW</span> before added content
- Mark removed/superseded content with: <span class="redline-remove" style="text-decoration: line-through; opacity: 0.5;">OLD TEXT</span>
- Add citation footnotes as: <sup style="color: #4a9eff; font-size: 10px;">[{{citation_num}}]</sup>
- Add a citations section at the bottom listing all sources with links
- Do not change the overall memo structure or styling
- Update the "Last updated" date in the footer to today ({date.today().isoformat()})
- Increment the version number by 1
- Only update sections that are actually affected by this filing

CURRENT MEMO HTML:
{template_html}

EXTRACTION DATA:
What changed: {extraction.get('what_changed', 'Unknown')}
Plain English: {extraction.get('plain_english_summary', 'Unknown')}
Effective date: {extraction.get('effective_date', 'Unknown')}
Affected sections: {', '.join(extraction.get('affected_sections', []))}
Asset impact: {json.dumps(extraction.get('asset_impact', {{}}))}
Recommended actions: {json.dumps(extraction.get('recommended_actions', []))}
Citations from source: {json.dumps(extraction.get('citations', []))}

FILING METADATA:
Docket: {item.get('docket_number', 'Unknown')}
Source URL: {item.get('source_url', '')}
Filing type: {item.get('filing_type', 'Unknown')}
Jurisdiction: {item.get('jurisdiction', 'FERC')}

Return only the complete updated HTML document. No preamble."""


def generate_redline(document_version_id: str) -> str:
    """Generate a redlined document update using Claude."""
    # Fetch document version
    doc_version = (
        supabase.table("document_versions")
        .select("*")
        .eq("id", document_version_id)
        .limit(1)
        .execute()
    )
    if not doc_version.data:
        raise ValueError(f"Document version {document_version_id} not found")

    dv = doc_version.data[0]
    extraction = dv.get("extraction_data", {})

    # Fetch regulatory item
    item = (
        supabase.table("regulatory_items")
        .select("*")
        .eq("id", dv["regulatory_item_id"])
        .limit(1)
        .execute()
    )
    item_data = item.data[0] if item.data else {}

    # Load template
    template = load_memo_template(dv["client_id"])

    # Build prompt and call Claude
    prompt = build_generation_prompt(template, extraction, item_data)

    message = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )

    html_content = message.content[0].text
    return html_content


def map_impacted_assets(extraction_data: dict, client_id: str) -> list:
    """Map extraction findings to specific client assets."""
    assets = (
        supabase.table("asset_registry")
        .select("*")
        .eq("client_id", client_id)
        .execute()
    )

    if not assets.data:
        return []

    asset_impact = extraction_data.get("asset_impact", {})
    affected_sections = extraction_data.get("affected_sections", [])
    affected_sections_lower = [s.lower() for s in affected_sections]

    results = []
    for asset in assets.data:
        matches = []

        # Check asset type matches
        asset_type = asset.get("asset_type", "")
        if asset_impact.get(asset_type, False):
            matches.append(f"asset_type:{asset_type}")

        # Check interconnection specifically
        if asset_type in ("generation", "storage") and asset_impact.get("interconnection", False):
            if asset.get("queue_position"):
                matches.append("interconnection_queue_impact")

        # Check rate schedule in affected sections
        rate_schedule = (asset.get("rate_schedule") or "").lower()
        if rate_schedule and any(rate_schedule in s for s in affected_sections_lower):
            matches.append(f"rate_schedule:{asset.get('rate_schedule')}")

        # Determine impact level
        if len(matches) >= 2:
            impact_level = "HIGH"
        elif len(matches) == 1:
            impact_level = "MEDIUM"
        else:
            impact_level = "LOW"

        results.append(
            {
                "asset_id": asset["id"],
                "asset_name": asset["asset_name"],
                "impact_level": impact_level,
                "match_reason": "; ".join(matches) if matches else "same_jurisdiction",
            }
        )

    return results
