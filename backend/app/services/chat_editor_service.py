import asyncio
import logging
import json
import re
import uuid
import tempfile
import os
from datetime import datetime
from typing import Optional
import pandas as pd
from anthropic import Anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import settings
from app.models.dashboard import Dashboard
from app.models.dashboard_version import DashboardVersion
from app.schemas.chat_edit import ChatEditResponse
from app.services.realtime import broadcast

logger = logging.getLogger(__name__)

# ── System prompt ─────────────────────────────────────────────────────────────
EDIT_SYSTEM = """You are a dashboard editor. The user wants to modify a business dashboard.
You receive the current dashboard JSON and a user request. Return ONLY the modified dashboard JSON.

Rules:
- Return valid JSON matching the same schema (same top-level keys)
- Preserve all fields you are not asked to change
- Do NOT add markdown, explanation, or backticks — return raw JSON only
- dashboard_type must stay one of: pl_statement, bcg_matrix, swot, kpi_summary, market_analysis, general
- trend must stay one of: up, down, flat
- chart_type must stay one of: bar, line, pie, scatter, waterfall, quadrant"""


class ChatEditorService:

    def __init__(self):
        self.client = Anthropic(api_key=settings.anthropic_api_key)

    # ── Public entry point ────────────────────────────────────────────────────

    async def process_edit_request(
        self,
        message: str,
        dashboard_id: str,
        user_id: str,
        extracted_text: str,
        db: AsyncSession,
    ) -> ChatEditResponse:
        try:
            # Load dashboard
            result = await db.execute(
                select(Dashboard).where(
                    (Dashboard.id == dashboard_id) & (Dashboard.user_id == user_id)
                )
            )
            dashboard = result.scalars().first()
            if not dashboard:
                return ChatEditResponse(status="error", error="Dashboard not found")

            dashboard_data = dashboard.dashboard_data
            if isinstance(dashboard_data, str):
                dashboard_data = json.loads(dashboard_data)

            # What-if scenario path
            if self._is_what_if(message):
                return await self._handle_what_if(message, dashboard_data, dashboard, db)

            # ── Main path: ask LLM to return modified dashboard JSON ──────────
            modified = await self._llm_edit_dashboard(message, dashboard_data, extracted_text)

            if modified is None:
                return ChatEditResponse(
                    status="error",
                    error="Could not generate edit. Try rephrasing your request.",
                )

            # Persist version + update dashboard
            version_num = await self._next_version(dashboard_id, db)
            await self._save_version(dashboard_id, user_id, version_num,
                                     self._summarize(message), modified, db)
            dashboard.dashboard_data = modified
            dashboard.updated_at = datetime.utcnow()
            await db.commit()

            # Push live update to all SSE viewers (owner channel + share channel)
            broadcast(dashboard_id, "dashboard_updated", modified)
            if dashboard.share_token and dashboard.is_public:
                broadcast(f"share:{dashboard.share_token}", "dashboard_updated", modified)

            return ChatEditResponse(
                status="success",
                dashboard_data=modified,
                edit_description=self._summarize(message),
            )

        except Exception as e:
            logger.error(f"Edit request failed: {e}", exc_info=True)
            return ChatEditResponse(status="error", error=f"Edit failed: {str(e)}")

    # ── LLM dashboard editor ──────────────────────────────────────────────────

    async def _llm_edit_dashboard(
        self, message: str, dashboard_data: dict, extracted_text: str
    ) -> Optional[dict]:
        """Ask the LLM to return a modified dashboard_data dict as JSON."""
        # Keep payload small: strip chart data arrays for large datasets
        compact = self._compact_dashboard(dashboard_data)

        prompt = f"""User request: "{message}"

Current dashboard JSON:
{json.dumps(compact, indent=2)}

Data context (first 500 chars): {extracted_text[:500]}

Return the complete modified dashboard JSON matching the exact same schema."""

        try:
            # Use asyncio.to_thread to avoid blocking the event loop
            response = await asyncio.to_thread(
                self.client.messages.create,
                model=settings.anthropic_model_chat,
                max_tokens=4096,
                system=EDIT_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            return self._extract_json(raw, dashboard_data)
        except Exception as e:
            logger.error(f"LLM edit failed: {e}")
            return None

    def _compact_dashboard(self, data: dict) -> dict:
        """Trim chart data arrays to max 5 rows so the prompt stays small."""
        import copy
        d = copy.deepcopy(data)
        for chart in d.get("charts", []):
            if isinstance(chart.get("data"), list) and len(chart["data"]) > 5:
                chart["data"] = chart["data"][:5]
                chart["_note"] = f"(data truncated to 5 rows for edit context)"
        return d

    def _extract_json(self, raw: str, fallback: dict) -> Optional[dict]:
        """Extract JSON from LLM response, validate it has required keys."""
        # Strip markdown fences
        raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
        raw = re.sub(r'```\s*$', '', raw, flags=re.MULTILINE).strip()

        # Try direct parse
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and "title" in parsed:
                return parsed
        except json.JSONDecodeError:
            pass

        # Try to find JSON object in the response
        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            try:
                parsed = json.loads(match.group())
                if isinstance(parsed, dict) and "title" in parsed:
                    return parsed
            except json.JSONDecodeError:
                pass

        logger.error(f"Could not extract valid JSON from LLM response: {raw[:200]}")
        return None

    # ── What-if scenario ──────────────────────────────────────────────────────

    def _is_what_if(self, message: str) -> bool:
        triggers = ["what if", "what happens if", "scenario", "if we", "if revenue",
                    "if cost", "suppose", "assuming"]
        return any(t in message.lower() for t in triggers)

    async def _handle_what_if(
        self, message: str, dashboard_data: dict, dashboard, db: AsyncSession
    ) -> ChatEditResponse:
        kpis = dashboard_data.get("kpis", [])
        prompt = f"""The user asks: "{message}"
Current KPIs: {json.dumps([{{"label": k["label"], "value": k["value"]}} for k in kpis])}

Return ONLY a JSON object:
{{
  "name": "Scenario name",
  "description": "What changes in 1-2 sentences",
  "kpi_deltas": [
    {{"label": "KPI Label", "base_value": "current value", "scenario_value": "new value", "delta_pct": 10.0}}
  ]
}}"""
        try:
            response = await asyncio.to_thread(
                self.client.messages.create,
                model=settings.anthropic_model_chat,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            match = re.search(r'\{[\s\S]*\}', text)
            if match:
                scenario = json.loads(match.group())
                scenarios = dashboard_data.get("scenarios", [])
                scenarios = [s for s in scenarios if s.get("name") != scenario.get("name")]
                scenarios.append(scenario)
                updated = {**dashboard_data, "scenarios": scenarios}
                dashboard.dashboard_data = updated
                dashboard.updated_at = datetime.utcnow()
                await db.commit()
                return ChatEditResponse(
                    status="success",
                    dashboard_data=updated,
                    edit_description=f"What-if: {scenario.get('name', message)}",
                )
        except Exception as e:
            logger.error(f"What-if failed: {e}")

        return ChatEditResponse(status="error", error="Could not generate scenario")

    # ── Version management ────────────────────────────────────────────────────

    async def _next_version(self, dashboard_id: str, db: AsyncSession) -> int:
        result = await db.execute(
            select(DashboardVersion)
            .where(DashboardVersion.dashboard_id == dashboard_id)
            .order_by(DashboardVersion.version_number.desc())
        )
        latest = result.scalars().first()
        return (latest.version_number + 1) if latest else 1

    async def _save_version(
        self, dashboard_id: str, user_id: str, version_number: int,
        change_description: str, dashboard_data: dict, db: AsyncSession
    ) -> None:
        db.add(DashboardVersion(
            id=str(uuid.uuid4()),
            dashboard_id=dashboard_id,
            user_id=user_id,
            version_number=version_number,
            change_description=change_description,
            dashboard_data=dashboard_data,
        ))
        await db.commit()

    def _summarize(self, message: str) -> str:
        return message[:97] + "..." if len(message) > 100 else message

    async def get_edit_history(
        self, dashboard_id: str, user_id: str, db: AsyncSession
    ) -> list:
        result = await db.execute(
            select(DashboardVersion)
            .where(
                (DashboardVersion.dashboard_id == dashboard_id) &
                (DashboardVersion.user_id == user_id)
            )
            .order_by(DashboardVersion.version_number.desc())
        )
        return [
            {
                "version_number": v.version_number,
                "change_description": v.change_description,
                "created_at": v.created_at.isoformat(),
            }
            for v in result.scalars().all()
        ]

    async def undo_to_version(
        self, dashboard_id: str, user_id: str, target_version: int, db: AsyncSession
    ) -> ChatEditResponse:
        try:
            result = await db.execute(
                select(DashboardVersion).where(
                    (DashboardVersion.dashboard_id == dashboard_id) &
                    (DashboardVersion.version_number == target_version)
                )
            )
            version = result.scalars().first()
            if not version:
                return ChatEditResponse(status="error",
                                        error=f"Version {target_version} not found")

            result2 = await db.execute(
                select(Dashboard).where(Dashboard.id == dashboard_id)
            )
            dashboard = result2.scalars().first()
            if not dashboard:
                return ChatEditResponse(status="error", error="Dashboard not found")

            dashboard.dashboard_data = version.dashboard_data
            dashboard.updated_at = datetime.utcnow()
            await db.commit()

            return ChatEditResponse(
                status="success",
                dashboard_data=version.dashboard_data,
                edit_description=f"Reverted to version {target_version}",
            )
        except Exception as e:
            logger.error(f"Undo failed: {e}")
            return ChatEditResponse(status="error", error=f"Undo failed: {str(e)}")
