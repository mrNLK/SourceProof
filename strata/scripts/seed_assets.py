"""
Seed the asset_registry table with demo data for 2 simulated clients.
"""

import logging
from strata.database import supabase

logger = logging.getLogger(__name__)

DEMO_ASSETS = [
    # CLIENT 1: demo_iou (large investor-owned utility)
    {
        "client_id": "demo_iou",
        "asset_name": "Sunrise Solar Farm",
        "asset_type": "generation",
        "jurisdiction": "FERC",
        "rate_schedule": "CAISO Schedule 2",
        "queue_position": "QP-2023-0441",
        "state": "CA",
        "metadata": {"mw": 250, "fuel": "solar", "cod_target": "2026-06"},
    },
    {
        "client_id": "demo_iou",
        "asset_name": "Western Transmission Line 1",
        "asset_type": "transmission",
        "jurisdiction": "FERC",
        "rate_schedule": "Open Access Transmission Tariff",
        "queue_position": None,
        "state": "NV",
        "metadata": {"miles": 180, "voltage_kv": 500},
    },
    {
        "client_id": "demo_iou",
        "asset_name": "Desert Storage Project",
        "asset_type": "storage",
        "jurisdiction": "FERC",
        "rate_schedule": "CAISO Schedule 30",
        "queue_position": "QP-2024-0112",
        "state": "CA",
        "metadata": {"mwh": 1000, "mw": 250},
    },
    {
        "client_id": "demo_iou",
        "asset_name": "Mountain Wind Farm",
        "asset_type": "generation",
        "jurisdiction": "FERC",
        "rate_schedule": "WECC Schedule 1",
        "queue_position": "QP-2022-0887",
        "state": "WY",
        "metadata": {"mw": 400, "fuel": "wind"},
    },
    {
        "client_id": "demo_iou",
        "asset_name": "Southwest Substation Upgrade",
        "asset_type": "transmission",
        "jurisdiction": "FERC",
        "rate_schedule": "Open Access Transmission Tariff",
        "queue_position": None,
        "state": "AZ",
        "metadata": {"voltage_kv": 230},
    },
    # CLIENT 2: demo_developer (mid-size renewable developer)
    {
        "client_id": "demo_developer",
        "asset_name": "Horizon Solar 1",
        "asset_type": "generation",
        "jurisdiction": "FERC",
        "rate_schedule": "MISO Schedule E-3",
        "queue_position": "GIP-2023-1892",
        "state": "TX",
        "metadata": {"mw": 150, "fuel": "solar", "cod_target": "2025-12"},
    },
    {
        "client_id": "demo_developer",
        "asset_name": "Horizon Solar 2",
        "asset_type": "generation",
        "jurisdiction": "FERC",
        "rate_schedule": "MISO Schedule E-3",
        "queue_position": "GIP-2024-0331",
        "state": "TX",
        "metadata": {"mw": 200, "fuel": "solar+storage"},
    },
    {
        "client_id": "demo_developer",
        "asset_name": "Lakeshore Wind",
        "asset_type": "generation",
        "jurisdiction": "FERC",
        "rate_schedule": "PJM IA Schedule",
        "queue_position": "GI-2023-2241",
        "state": "IL",
        "metadata": {"mw": 300, "fuel": "wind"},
    },
    {
        "client_id": "demo_developer",
        "asset_name": "Coastal BESS",
        "asset_type": "storage",
        "jurisdiction": "FERC",
        "rate_schedule": "ISO-NE Schedule 17",
        "queue_position": "QP-2024-0567",
        "state": "MA",
        "metadata": {"mwh": 400, "mw": 100},
    },
]


def seed():
    """Insert demo assets into asset_registry."""
    for asset in DEMO_ASSETS:
        supabase.table("asset_registry").insert(asset).execute()
        print(f"  Seeded: {asset['client_id']} / {asset['asset_name']}")

    print(f"\nTotal assets seeded: {len(DEMO_ASSETS)}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Seeding asset registry...")
    seed()
    print("Done.")
