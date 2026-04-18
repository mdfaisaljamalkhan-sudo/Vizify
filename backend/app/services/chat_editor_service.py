import logging
import json
import uuid
from datetime import datetime
from typing import Optional
import pandas as pd
from anthropic import Anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import settings
from app.models.dashboard import Dashboard
from app.models.dashboard_version import DashboardVersion
from app.services.sandbox_executor import run_python
from app.schemas.chat_edit import ChatEditResponse

logger = logging.getLogger(__name__)


class ChatEditorService:
    """Service to handle LLM-driven dashboard edits with sandboxed code execution."""

    def __init__(self):
        self.client = Anthropic(api_key=settings.anthropic_api_key)

    async def process_edit_request(
        self,
        message: str,
        dashboard_id: str,
        user_id: str,
        extracted_text: str,
        db: AsyncSession,
    ) -> ChatEditResponse:
        """
        Process a user's edit request:
        1. Fetch current dashboard
        2. Generate edit code via LLM
        3. Execute code in sandbox
        4. Save as new version
        5. Return modified dashboard
        """
        try:
            # Fetch current dashboard
            stmt = select(Dashboard).where(
                (Dashboard.id == dashboard_id) & (Dashboard.user_id == user_id)
            )
            result = await db.execute(stmt)
            dashboard = result.scalars().first()

            if not dashboard:
                return ChatEditResponse(
                    status="error",
                    error="Dashboard not found or access denied",
                )

            # Load dashboard data
            dashboard_data = dashboard.dashboard_data
            if isinstance(dashboard_data, str):
                dashboard_data = json.loads(dashboard_data)

            # Load parquet if available, fallback to extracted_text
            dataframe = None
            if dashboard.parquet_path:
                try:
                    dataframe = pd.read_parquet(dashboard.parquet_path)
                except Exception as e:
                    logger.warning(f"Failed to load parquet: {e}, falling back to CSV parse")

            if dataframe is None:
                # Parse extracted_text as CSV fallback
                try:
                    from io import StringIO
                    dataframe = pd.read_csv(StringIO(extracted_text))
                except Exception as e:
                    logger.error(f"Failed to parse data: {e}")
                    return ChatEditResponse(
                        status="error",
                        error="Unable to load dashboard data for editing",
                    )

            # Generate edit code via LLM
            generated_code = await self._generate_edit_code(
                message=message,
                dashboard_data=dashboard_data,
                dataframe=dataframe,
                extracted_text=extracted_text,
            )

            if not generated_code:
                return ChatEditResponse(
                    status="error",
                    error="Failed to generate edit code",
                )

            # Execute generated code in sandbox
            sandbox_result = run_python(generated_code, dataframe, timeout=5)

            if sandbox_result["status"] != "success":
                return ChatEditResponse(
                    status="error",
                    error=f"Execution failed: {sandbox_result['data']}",
                    generated_code=generated_code,
                )

            # Extract modified dashboard from sandbox result
            result_data = sandbox_result["data"]
            if isinstance(result_data, dict):
                # Result is returned as {"type": "...", "data": ...}
                if result_data.get("type") == "dataframe":
                    # Dataframe was modified, update dashboard_data
                    dashboard_data = await self._update_dashboard_from_dataframe(
                        dashboard_data, result_data["data"]
                    )
                elif result_data.get("type") == "json":
                    # Direct dashboard modifications
                    dashboard_data = result_data["data"]

            # Save as new version
            new_version_number = await self._get_next_version(dashboard_id, db)
            await self._save_version(
                dashboard_id=dashboard_id,
                user_id=user_id,
                version_number=new_version_number,
                change_description=self._summarize_edit(message),
                dashboard_data=dashboard_data,
                db=db,
            )

            # Update dashboard
            dashboard.dashboard_data = dashboard_data
            dashboard.updated_at = datetime.utcnow()
            await db.commit()

            return ChatEditResponse(
                status="success",
                dashboard_data=dashboard_data,
                edit_description=self._summarize_edit(message),
                generated_code=generated_code,
                execution_log={
                    "sandbox_status": sandbox_result["status"],
                    "execution_time": sandbox_result.get("execution_time", 0),
                },
            )

        except Exception as e:
            logger.error(f"Edit request failed: {str(e)}")
            return ChatEditResponse(
                status="error",
                error=f"Edit failed: {str(e)}",
            )

    async def _generate_edit_code(
        self,
        message: str,
        dashboard_data: dict,
        dataframe: pd.DataFrame,
        extracted_text: str,
    ) -> Optional[str]:
        """Generate Python code to modify the dashboard."""
        prompt = f"""You are a Python code generator for dashboard editing.

The user has this request: "{message}"

Current dashboard structure (top-level keys):
{json.dumps(list(dashboard_data.keys()), indent=2)}

Sample data (first 5 rows):
{dataframe.head().to_string()}

Data columns: {list(dataframe.columns)}

Generate Python code that:
1. Modifies the global variable `result` (a dict representing the modified dashboard)
2. OR modifies `df` (the dataframe) and sets `result = df.to_dict('records')`

Your code must:
- Use only pandas/numpy/Python builtins
- NOT import modules, read files, or call external APIs
- Be safe and deterministic
- Include the assignment `result = ...` at the end

Generate ONLY the Python code, no explanations:
"""

        try:
            response = self.client.messages.create(
                model=settings.anthropic_model_chat,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            code = response.content[0].text.strip()
            # Clean up markdown code blocks if present
            if code.startswith("```"):
                code = code.split("```")[1]
                if code.startswith("python"):
                    code = code[6:]
            if code.endswith("```"):
                code = code.rsplit("```", 1)[0]
            return code.strip()
        except Exception as e:
            logger.error(f"Code generation failed: {e}")
            return None

    async def _update_dashboard_from_dataframe(
        self, dashboard_data: dict, modified_records: list
    ) -> dict:
        """Update dashboard data when dataframe is modified."""
        # Store modified data records in dashboard
        if "data" not in dashboard_data:
            dashboard_data["data"] = {}
        dashboard_data["data"]["modified_records"] = modified_records
        dashboard_data["updated_at"] = datetime.utcnow().isoformat()
        return dashboard_data

    async def _get_next_version(self, dashboard_id: str, db: AsyncSession) -> int:
        """Get next version number for a dashboard."""
        stmt = select(DashboardVersion).where(
            DashboardVersion.dashboard_id == dashboard_id
        ).order_by(DashboardVersion.version_number.desc())
        result = await db.execute(stmt)
        latest = result.scalars().first()
        return (latest.version_number + 1) if latest else 1

    async def _save_version(
        self,
        dashboard_id: str,
        user_id: str,
        version_number: int,
        change_description: str,
        dashboard_data: dict,
        db: AsyncSession,
    ) -> None:
        """Save a new version of the dashboard."""
        version = DashboardVersion(
            id=str(uuid.uuid4()),
            dashboard_id=dashboard_id,
            user_id=user_id,
            version_number=version_number,
            change_description=change_description,
            dashboard_data=dashboard_data,
        )
        db.add(version)
        await db.commit()

    def _summarize_edit(self, message: str) -> str:
        """Create a short summary of the edit."""
        if len(message) > 100:
            return message[:97] + "..."
        return message

    async def get_edit_history(
        self, dashboard_id: str, user_id: str, db: AsyncSession
    ) -> list:
        """Get version history for a dashboard."""
        stmt = (
            select(DashboardVersion)
            .where(
                (DashboardVersion.dashboard_id == dashboard_id)
                & (DashboardVersion.user_id == user_id)
            )
            .order_by(DashboardVersion.version_number.desc())
        )
        result = await db.execute(stmt)
        versions = result.scalars().all()
        return [
            {
                "version_number": v.version_number,
                "change_description": v.change_description,
                "created_at": v.created_at.isoformat(),
            }
            for v in versions
        ]

    async def undo_to_version(
        self, dashboard_id: str, user_id: str, target_version: int, db: AsyncSession
    ) -> ChatEditResponse:
        """Revert dashboard to a previous version."""
        try:
            stmt = select(DashboardVersion).where(
                (DashboardVersion.dashboard_id == dashboard_id)
                & (DashboardVersion.version_number == target_version)
            )
            result = await db.execute(stmt)
            version = result.scalars().first()

            if not version:
                return ChatEditResponse(
                    status="error",
                    error=f"Version {target_version} not found",
                )

            # Fetch and update dashboard
            stmt = select(Dashboard).where(Dashboard.id == dashboard_id)
            result = await db.execute(stmt)
            dashboard = result.scalars().first()

            if not dashboard:
                return ChatEditResponse(
                    status="error",
                    error="Dashboard not found",
                )

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
            return ChatEditResponse(
                status="error",
                error=f"Undo failed: {str(e)}",
            )
