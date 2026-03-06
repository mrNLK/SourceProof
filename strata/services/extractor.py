"""
Parallel Deep Research: Extraction Engine

Uses Parallel Task API to extract structured regulatory intelligence.
"""

import json
import logging
import time

from parallel import Parallel
from httpx import Response

from strata import config
from strata.database import supabase

logger = logging.getLogger(__name__)

client = Parallel(api_key=config.PARALLEL_API_KEY)


def build_extraction_prompt(item: dict, prior_text: str | None) -> str:
    """Build the extraction prompt for Deep Research."""
    raw_text = (item.get("raw_text") or "")[:15000]
    prior_section = ""
    if prior_text:
        prior_section = f"\nPRIOR VERSION TEXT (for comparison):\n{prior_text[:8000]}"
    else:
        prior_section = "\nNo prior version available."

    return f"""You are a regulatory intelligence analyst specializing in US electric utility regulation.

Analyze the following regulatory document and extract structured intelligence.

DOCUMENT:
Source: {item.get('source_url', '')}
Filing Type: {item.get('filing_type', 'Unknown')}
Docket Number: {item.get('docket_number', 'Unknown')}
Jurisdiction: {item.get('jurisdiction', 'FERC')}

DOCUMENT TEXT:
{raw_text}
{prior_section}

Extract and return a JSON object with exactly these fields:

{{
  "what_changed": "Specific description of what changed in this filing vs prior version, or what this new filing establishes. Be specific about section numbers, rate values, dates, and requirements. If no prior version, describe what this filing establishes.",
  "plain_english_summary": "2-3 sentence plain English explanation of the practical impact for a utility operations team with no regulatory background.",
  "effective_date": "ISO 8601 date string, or null if not determinable",
  "compliance_deadline": "ISO 8601 date string for any compliance filing deadline, or null",
  "affected_sections": ["list of specific tariff sections, rate schedule names, or rule sections affected"],
  "affected_utility_types": ["list from: IOU, cooperative, municipal, developer, transmission_owner, generator"],
  "asset_impact": {{
    "generation": true/false,
    "transmission": true/false,
    "interconnection": true/false,
    "storage": true/false,
    "rationale": "brief explanation of which asset types are affected and how"
  }},
  "recommended_actions": [
    {{"action": "description of action", "priority": "high/medium/low", "deadline": "ISO date or null"}}
  ],
  "citations": [
    {{"text": "quoted passage supporting a key finding", "location": "page X or section Y"}}
  ],
  "confidence": "high/medium/low"
}}

Return only valid JSON. No preamble, no markdown fences."""


def run_extraction(regulatory_item_id: str, prior_text: str | None = None) -> str:
    """Launch a Deep Research extraction task."""
    # Fetch the regulatory item
    result = (
        supabase.table("regulatory_items")
        .select("*")
        .eq("id", regulatory_item_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise ValueError(f"Regulatory item {regulatory_item_id} not found")

    item = result.data[0]
    prompt = build_extraction_prompt(item, prior_text)

    # Create Deep Research task
    res = client.post(
        "/v1/tasks",
        cast_to=Response,
        body={
            "type": "deep_research",
            "prompt": prompt,
        },
    ).json()

    task_id = res.get("task_id") or res.get("id")
    logger.info("Started extraction task %s for item %s", task_id, regulatory_item_id)
    return task_id


def poll_extraction(parallel_job_id: str) -> dict | None:
    """Poll a Parallel task for completion."""
    res = client.get(
        f"/v1/tasks/{parallel_job_id}",
        cast_to=Response,
    ).json()

    status = res.get("status", "")

    if status == "completed":
        output = res.get("output") or res.get("result", "")
        if isinstance(output, str):
            try:
                # Try to parse JSON from the output
                output = output.strip()
                if output.startswith("```"):
                    output = output.split("\n", 1)[1].rsplit("```", 1)[0]
                return json.loads(output)
            except json.JSONDecodeError:
                return {"what_changed": output, "confidence": "low"}
        return output

    if status == "failed":
        error = res.get("error", "Unknown error")
        logger.error("Extraction task %s failed: %s", parallel_job_id, error)
        return {"error": str(error), "confidence": "low"}

    return None


def validate_extraction(extraction_data: dict) -> bool:
    """Validate that required extraction fields are present."""
    required_fields = ["what_changed", "plain_english_summary", "affected_sections"]
    for field in required_fields:
        value = extraction_data.get(field)
        if not value:
            return False
        if isinstance(value, list) and len(value) == 0:
            return False
    return True
