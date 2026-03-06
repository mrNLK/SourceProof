"""
Document Fetcher + Parser + Classifier

Fetches and parses regulatory documents from source URLs detected by Monitor.
"""

import logging
import re
import tempfile
from datetime import datetime, timezone

import httpx
import pdfplumber

logger = logging.getLogger(__name__)


async def fetch_document(url: str) -> dict:
    """Fetch and extract text from a regulatory document URL."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            response = await client.get(url)
            response.raise_for_status()

        content_type = response.headers.get("content-type", "")

        if "application/pdf" in content_type:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name

            pdf_result = extract_pdf_text(tmp_path)
            return {
                "url": url,
                "content_type": "pdf",
                "raw_text": pdf_result["full_text"],
                "page_count": pdf_result["page_count"],
                "fetch_timestamp": datetime.now(timezone.utc).isoformat(),
                "success": True,
                "error": None,
            }
        else:
            # HTML or plain text
            text = response.text
            # Strip common boilerplate
            text = re.sub(r"<(nav|footer|header|script|style)[^>]*>.*?</\1>", "", text, flags=re.DOTALL)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()

            return {
                "url": url,
                "content_type": "html",
                "raw_text": text,
                "page_count": None,
                "fetch_timestamp": datetime.now(timezone.utc).isoformat(),
                "success": True,
                "error": None,
            }

    except Exception as e:
        logger.error("Failed to fetch document %s: %s", url, str(e))
        return {
            "url": url,
            "content_type": None,
            "raw_text": None,
            "page_count": None,
            "fetch_timestamp": datetime.now(timezone.utc).isoformat(),
            "success": False,
            "error": str(e),
        }


def extract_pdf_text(pdf_path: str) -> dict:
    """Extract text from a PDF file with section detection."""
    pages = []
    sections = []
    full_text_parts = []
    current_section = None

    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            pages.append({"page_num": i + 1, "text": text})
            full_text_parts.append(text)

            # Detect section headers
            for line in text.split("\n"):
                stripped = line.strip()
                if not stripped:
                    continue
                is_header = (
                    stripped.isupper() and len(stripped) > 3
                    or stripped.endswith(":")
                    or re.match(r"^(I{1,3}V?|V?I{0,3})\.\s", stripped)
                    or re.match(r"^\d+\.\s", stripped)
                )
                if is_header:
                    if current_section:
                        sections.append(current_section)
                    current_section = {
                        "title": stripped,
                        "start_page": i + 1,
                        "text": "",
                    }
                elif current_section:
                    current_section["text"] += stripped + "\n"

        if current_section:
            sections.append(current_section)

    return {
        "full_text": "\n".join(full_text_parts),
        "pages": pages,
        "sections": sections,
        "page_count": len(pages),
    }


def classify_document(raw_text: str, source_url: str) -> str:
    """Classify a regulatory document by type."""
    text_lower = raw_text.lower() if raw_text else ""
    url_lower = source_url.lower() if source_url else ""

    if "elibrary.ferc.gov" in url_lower and "interconnection" in text_lower:
        return "interconnection_order"
    if any(term in text_lower for term in ["rate schedule", "rate case", "revenue requirement"]):
        return "rate_case"
    if "tariff" in text_lower and any(term in text_lower for term in ["sheet", "amendment", "filing"]):
        return "tariff_filing"
    if "federalregister.gov" in url_lower or any(term in text_lower for term in ["final rule", "proposed rule"]):
        return "guidance"
    return "unknown"


async def build_document_record(
    url: str, monitor_id: str, monitor_metadata: dict
) -> dict:
    """Fetch, parse, and classify a document into a structured record."""
    doc = await fetch_document(url)

    if not doc["success"]:
        return {**doc, "filing_type": None, "monitor_id": monitor_id}

    filing_type = classify_document(doc["raw_text"], url)

    return {
        **doc,
        "filing_type": filing_type,
        "monitor_id": monitor_id,
        "monitor_metadata": monitor_metadata,
    }
