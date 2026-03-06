"""
Exa Websets: Regulatory Corpus Builder

Manages Exa Websets that form STRATA's regulatory document catalog.
"""

import argparse
import logging
import time

from exa_py import Exa
from exa_py.api import CreateEnrichmentParameters

from strata import config
from strata.database import supabase

logger = logging.getLogger(__name__)

exa = Exa(api_key=config.EXA_API_KEY)

FILING_QUERIES = {
    "ferc_interconnection_orders": "FERC interconnection queue reform orders and decisions for electric utilities",
    "ferc_rate_cases": "FERC rate case filings and orders for electric utilities transmission",
    "ferc_tariff_filings": "FERC tariff filings and amendments electric utilities",
}

ENRICHMENTS = [
    CreateEnrichmentParameters(
        description="FERC docket number in format EL00-000-000 or ER00-000-000",
        format="text",
    ),
    CreateEnrichmentParameters(
        description="Filing type: rate_case, tariff_filing, or interconnection_order",
        format="options",
        options=[
            {"label": "rate_case"},
            {"label": "tariff_filing"},
            {"label": "interconnection_order"},
            {"label": "guidance"},
        ],
    ),
    CreateEnrichmentParameters(
        description="Effective date of the order or filing in ISO 8601 format",
        format="date",
    ),
    CreateEnrichmentParameters(
        description="Names of affected utilities or companies mentioned in the filing",
        format="text",
    ),
    CreateEnrichmentParameters(
        description="Direct URL to the FERC document or order PDF",
        format="url",
    ),
]


def create_regulatory_webset(
    filing_type: str, jurisdiction: str = "FERC", count: int = 50
) -> dict:
    """Create a new Exa Webset for a specific filing type."""
    query = FILING_QUERIES.get(filing_type)
    if not query:
        raise ValueError(f"Unknown filing_type: {filing_type}")

    webset = exa.websets.create(
        search={"query": query, "count": count},
        enrichments=ENRICHMENTS,
    )

    # Save to webset_registry
    supabase.table("webset_registry").insert(
        {
            "webset_id": webset.id,
            "filing_type": filing_type,
            "jurisdiction": jurisdiction,
        }
    ).execute()

    return {
        "webset_id": webset.id,
        "status": webset.status,
        "filing_type": filing_type,
        "count": count,
    }


def sync_webset_items(webset_id: str) -> int:
    """Sync all items from an Exa Webset into regulatory_items."""
    items = exa.websets.items.list(webset_id=webset_id)
    count = 0

    for item in items.results:
        enrichment_data = {}
        docket_number = None
        filing_type = None
        effective_date = None
        affected_utilities = None

        if hasattr(item, "enrichments") and item.enrichments:
            enrichment_data = {e.description: e.value for e in item.enrichments if e.value}
            for e in item.enrichments:
                if not e.value:
                    continue
                desc = e.description.lower()
                if "docket" in desc:
                    docket_number = e.value
                elif "filing type" in desc:
                    filing_type = e.value
                elif "effective date" in desc:
                    effective_date = e.value
                elif "affected" in desc or "utilities" in desc:
                    if isinstance(e.value, str):
                        affected_utilities = [u.strip() for u in e.value.split(",")]
                    elif isinstance(e.value, list):
                        affected_utilities = e.value

        record = {
            "exa_item_id": item.id,
            "webset_id": webset_id,
            "source_url": item.url,
            "enrichment_data": enrichment_data,
            "docket_number": docket_number,
            "filing_type": filing_type,
            "effective_date": effective_date,
            "affected_utilities": affected_utilities,
        }

        supabase.table("regulatory_items").upsert(
            record, on_conflict="exa_item_id"
        ).execute()
        count += 1

    return count


def find_prior_version(docket_number: str) -> dict | None:
    """Find the most recent regulatory item for a docket number."""
    result = (
        supabase.table("regulatory_items")
        .select("*")
        .eq("docket_number", docket_number)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def add_item_to_corpus(source_url: str, raw_text: str, metadata: dict) -> str:
    """Insert a new regulatory item directly from Monitor detection."""
    record = {
        "source_url": source_url,
        "raw_text": raw_text,
        "filing_type": metadata.get("filing_type"),
        "docket_number": metadata.get("docket_number"),
        "jurisdiction": metadata.get("jurisdiction", "FERC"),
        "enrichment_data": metadata,
    }
    result = supabase.table("regulatory_items").insert(record).execute()
    return result.data[0]["id"]


def initialize_ferc_corpus():
    """Create websets for all FERC filing types and sync items."""
    results = {}

    for filing_type in FILING_QUERIES:
        logger.info("Creating webset for %s", filing_type)
        ws = create_regulatory_webset(filing_type)
        results[filing_type] = {"webset_id": ws["webset_id"], "status": ws["status"]}

    # Wait for all websets to finish populating
    for filing_type, info in results.items():
        logger.info("Waiting for webset %s to complete...", info["webset_id"])
        exa.websets.wait_until_idle(webset_id=info["webset_id"], timeout=300)

    # Sync items
    total = 0
    for filing_type, info in results.items():
        count = sync_webset_items(info["webset_id"])
        results[filing_type]["synced"] = count
        total += count
        logger.info("Synced %d items for %s", count, filing_type)

    return results, total


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="STRATA Exa Corpus Manager")
    parser.add_argument("--init", action="store_true", help="Initialize FERC corpus")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if args.init:
        results, total = initialize_ferc_corpus()
        print(f"\nFERC Corpus Initialized — {total} total items synced")
        for ft, info in results.items():
            print(f"  {ft}: webset={info['webset_id']}, synced={info.get('synced', 0)}")
