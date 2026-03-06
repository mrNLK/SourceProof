"""
Parallel Monitor: Watch Layer Manager

Manages Parallel Monitor instances for continuous regulatory tracking.
"""

import argparse
import logging

from parallel import Parallel
from httpx import Response

from strata import config
from strata.database import supabase

logger = logging.getLogger(__name__)

client = Parallel(api_key=config.PARALLEL_API_KEY)

FERC_MONITORS = [
    {
        "name": "ferc_new_orders",
        "query": "New FERC orders and decisions for electric utility rate cases, tariffs, and interconnection",
        "frequency": "1d",
        "metadata": {
            "source": "FERC",
            "jurisdiction": "federal",
            "filing_types": "rate_case,interconnection_order",
        },
    },
    {
        "name": "ferc_interconnection_queue",
        "query": "FERC interconnection queue reform proceedings and new interconnection service agreements",
        "frequency": "1d",
        "metadata": {
            "source": "FERC",
            "jurisdiction": "federal",
            "filing_types": "interconnection_order",
        },
    },
    {
        "name": "federal_register_energy",
        "query": "Federal Register new rules and proposed rules for electric utilities, PURPA, transmission access",
        "frequency": "1d",
        "metadata": {
            "source": "FederalRegister",
            "jurisdiction": "federal",
            "filing_types": "guidance",
        },
    },
    {
        "name": "nerc_standards",
        "query": "NERC reliability standards new approvals and amendments",
        "frequency": "1w",
        "metadata": {
            "source": "NERC",
            "jurisdiction": "federal",
            "filing_types": "guidance",
        },
    },
]


def create_monitor(name: str, query: str, frequency: str, metadata: dict) -> dict:
    """Create a new Parallel Monitor instance."""
    webhook_url = f"{config.BASE_URL}/webhooks/monitor"

    res = client.post(
        "/v1alpha/monitors",
        cast_to=Response,
        body={
            "query": query,
            "frequency": frequency,
            "webhook": {
                "url": webhook_url,
                "event_types": ["monitor.event.detected"],
            },
            "metadata": metadata,
        },
    ).json()

    # Save to monitor_registry
    supabase.table("monitor_registry").insert(
        {
            "monitor_id": res["monitor_id"],
            "name": name,
            "query": query,
            "frequency": frequency,
            "status": "active",
        }
    ).execute()

    logger.info("Created monitor %s: %s", name, res["monitor_id"])
    return res


def initialize_ferc_monitors() -> list[dict]:
    """Initialize all FERC regulatory monitors."""
    results = []
    for m in FERC_MONITORS:
        res = create_monitor(
            name=m["name"],
            query=m["query"],
            frequency=m["frequency"],
            metadata=m["metadata"],
        )
        results.append(res)
    return results


def list_monitors() -> list:
    """List all active monitors."""
    res = client.get(
        "/v1alpha/monitors",
        cast_to=Response,
    ).json()
    return res.get("monitors", res) if isinstance(res, dict) else res


def delete_monitor(monitor_id: str):
    """Delete a monitor and update registry."""
    client.delete(
        f"/v1alpha/monitors/{monitor_id}",
        cast_to=Response,
    )

    supabase.table("monitor_registry").update(
        {"status": "deleted"}
    ).eq("monitor_id", monitor_id).execute()

    logger.info("Deleted monitor %s", monitor_id)


def get_event_group(monitor_id: str, event_group_id: str) -> dict:
    """Fetch full events for a specific event group."""
    res = client.get(
        f"/v1alpha/monitors/{monitor_id}/event_groups/{event_group_id}",
        cast_to=Response,
    ).json()
    return res


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="STRATA Monitor Manager")
    parser.add_argument("--init", action="store_true", help="Initialize FERC monitors")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if args.init:
        results = initialize_ferc_monitors()
        print(f"\nFERC Monitors Initialized — {len(results)} monitors created")
        for r in results:
            print(f"  {r['monitor_id']}: {r.get('query', '')[:60]}...")
