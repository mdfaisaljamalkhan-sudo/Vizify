"""
/api/news — live business headlines.

Strategy:
  1. Fetch 3 RSS feeds in parallel (always fresh, no API key needed)
  2. Concurrently ask Gemini to add context / fill gaps
  3. Merge, deduplicate, sort by recency, return top 8
"""
import asyncio
import json
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx
from fastapi import APIRouter
from openai import OpenAI

from app.database import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["news"])

RSS_FEEDS = [
    ("Reuters Business", "https://feeds.reuters.com/reuters/businessNews"),
    ("BBC Business",     "http://feeds.bbci.co.uk/news/business/rss.xml"),
    ("FT",               "https://www.ft.com/rss/home/uk"),
]

GEMINI_PROMPT = (
    "You are a financial news editor. List 6 major global business news stories "
    "from the past 24 hours. Focus on markets, economy, M&A, earnings, central banks. "
    "Return ONLY a JSON array, no markdown:\n"
    '[{"title":"...","summary":"one sentence, max 20 words","source":"outlet name"}]'
)


# ── RSS helpers ───────────────────────────────────────────────────────────────

def _text(el: Optional[ET.Element]) -> str:
    return (el.text or "").strip() if el is not None else ""


def _parse_date(raw: str) -> str:
    """Return ISO string; fall back to empty on parse failure."""
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
    except Exception:
        return ""


def _parse_rss(xml_text: str, source_name: str) -> list[dict]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    items = []
    for item in root.findall(".//item")[:5]:
        title = _text(item.find("title"))
        if not title:
            continue
        # Strip CDATA / HTML tags from description
        desc = re.sub(r"<[^>]+>", "", _text(item.find("description")))
        items.append({
            "title":        title,
            "summary":      desc[:160] if desc else "",
            "url":          _text(item.find("link")),
            "source":       source_name,
            "published_at": _parse_date(_text(item.find("pubDate"))),
        })
    return items


async def _fetch_rss(name: str, url: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=6, follow_redirects=True) as client:
            r = await client.get(url, headers={"User-Agent": "Vizify/1.0 NewsReader"})
            r.raise_for_status()
            return _parse_rss(r.text, name)
    except Exception as e:
        logger.warning(f"RSS fetch failed [{name}]: {e}")
        return []


# ── Gemini helper ─────────────────────────────────────────────────────────────

async def _fetch_gemini() -> list[dict]:
    if not settings.gemini_api_key:
        return []
    try:
        client = OpenAI(
            api_key=settings.gemini_api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="gemini-1.5-flash",
            max_tokens=600,
            messages=[{"role": "user", "content": GEMINI_PROMPT}],
        )
        raw = response.choices[0].message.content or ""
        # Strip markdown fences if present
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)
        items = json.loads(raw)
        return [
            {
                "title":        i.get("title", ""),
                "summary":      i.get("summary", ""),
                "url":          i.get("url", ""),
                "source":       i.get("source", "Gemini"),
                "published_at": "",
            }
            for i in items if i.get("title")
        ]
    except Exception as e:
        logger.warning(f"Gemini news fetch failed: {e}")
        return []


# ── Merge & deduplicate ───────────────────────────────────────────────────────

def _dedup(items: list[dict]) -> list[dict]:
    seen, result = set(), []
    for item in items:
        key = item["title"].lower()[:60]
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def _sort_by_date(items: list[dict]) -> list[dict]:
    def key(i):
        try:
            return datetime.fromisoformat(i["published_at"]) if i["published_at"] else datetime.min.replace(tzinfo=timezone.utc)
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)
    return sorted(items, key=key, reverse=True)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/news")
async def get_business_news():
    """
    Returns up to 8 live global business headlines.
    Sources: Reuters + BBC + FT (RSS) + Gemini (supplemental).
    """
    # Fire all sources in parallel
    results = await asyncio.gather(
        *[_fetch_rss(name, url) for name, url in RSS_FEEDS],
        _fetch_gemini(),
        return_exceptions=True,
    )

    all_items: list[dict] = []
    for r in results:
        if isinstance(r, list):
            all_items.extend(r)

    merged = _sort_by_date(_dedup(all_items))[:8]

    return {"articles": merged, "count": len(merged)}
