# SubaDash — Free Deployment + Interactive Chat-Driven Dashboard Editor

> **Handoff for Claude Code in VS Code.** Drafted in Cowork after a conversation with Faisal. Two goals: (1) deploy SubaDash at **zero recurring cost** while keeping a path to real-user scale, (2) add an **interactive chat editor** where the user types a natural-language request and an LLM-generated Python script runs in a sandbox to iteratively modify the dashboard.

---

## 0. Current state (from repo scan)

**Backend:** FastAPI on `127.0.0.1:8002`. Entry: `backend/run_server.py`. Routers: `auth`, `upload`, `analyze`, `dashboards`, `shared`, `chat`. Services: `analyzer_service.py` (pluggable LLM factory — Claude/OpenAI/Deepseek/Ollama), `file_parser.py` (CSV, XLSX, DOCX, PDF, JSON; pandas + openpyxl + python-docx + pdfplumber). SQLAlchemy async + SQLite (`subadash.db`). Pydantic `DashboardSchema` with typed `KPIData` and `ChartData` (bar/line/pie/scatter/waterfall/quadrant). Alembic is in deps but not wired up. Stripe deps present but unused.

**Frontend:** React 19 + Vite + TS + Tailwind. Recharts for rendering, Zustand for state, React Query for data, Framer Motion for animation. Pages: Login, Upload, Dashboard, Shared. Existing components in `components/charts/`, `components/dashboard/`, `components/chat/ChatWindow.tsx`, `components/upload/FileDropzone.tsx`. Export via html2canvas + jspdf.

**Existing chat:** `POST /api/chat` already calls Anthropic (`claude-opus-4-6` hardcoded) with `extracted_text + dashboard_context`. Single-turn, read-only — it describes the dashboard but can't modify it. That's what we're upgrading.

**Not yet present:** no Dockerfile, no cloud deploy config, no code-execution sandbox, no object storage, no prod-grade database story, no auth session hardening beyond JWT basics.

---

## 1. Target architecture (final)

```
Recruiter/User
     │
     ▼
┌────────────────────┐          ┌───────────────────────────┐
│ Vercel / CF Pages  │  HTTPS   │ Render Web Service (Docker)│
│ React + Vite build │◄────────►│ FastAPI + Sandbox Executor │
└────────────────────┘          │  ├─ /api/upload            │
                                │  ├─ /api/analyze           │
                                │  ├─ /api/chat (upgraded)   │
                                │  └─ /api/sandbox (new)     │
                                └────────────┬───────────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                  ┌──────────────┐   ┌──────────────┐    ┌──────────────┐
                  │ Supabase     │   │ Cloudflare R2│    │ Anthropic API│
                  │ Postgres free│   │ (files, free)│    │ (pay, $5 cap)│
                  └──────────────┘   └──────────────┘    └──────────────┘
```

### Why this stack for "Both" (portfolio now, real users later)

| Layer | Free-tier choice | Scales to real users because… |
|---|---|---|
| Frontend | **Cloudflare Pages** (or Vercel) | Global CDN, no cold starts, scales to unlimited static traffic on free tier. |
| Backend | **Render free web service (Docker)** | Supports FastAPI + persistent disk, can be upgraded to paid tier with no code changes. HF Spaces was considered but is really meant for ML demos, not multi-user SaaS. |
| Database | **Supabase Postgres free** (500 MB, 2 GB bandwidth/mo) | Proper Postgres with auth + row-level security; SubaDash's existing SQLAlchemy async works with `asyncpg`. |
| File storage | **Cloudflare R2 free** (10 GB, no egress cost) | Raw uploads go to R2; backend only holds references. Enables stateless backend containers. |
| LLM | **Anthropic API** (Faisal's $5 credit) | Default to Claude Haiku for chat edits, escalate to Sonnet only when structured output quality matters. |
| Code sandbox | **Restricted subprocess + AST allowlist** (Phase 1) → **E2B free tier** (Phase 2) | Start cheap & simple; swap to E2B/Modal when real users arrive. Interface stays the same. |

### Honest tradeoffs

- **Render free** sleeps after 15 min idle (~30 s cold start). Mitigate with a `cron-job.org` pinger every 10 min (free, same trick as the portfolio project).
- **Supabase free** has a 1-week pause if nobody queries the DB. Same pinger covers this.
- **SQLite** is simpler for Phase 1 demo; we'll start there and migrate to Supabase in Phase 2 before any real-user launch. Both paths are covered below.

---

## 2. Feature 1 — Deployment (free, scalable)

### 2.1 New files to create

- `backend/Dockerfile` — Python 3.11-slim, copy `app/`, install `requirements.txt`, `CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Expose the `$PORT` env var Render injects (don't hardcode 8002).
- `backend/.dockerignore` — exclude `.venv/`, `__pycache__/`, `*.db`, `.env`.
- `render.yaml` (repo root) — blueprint for Render Web Service so redeploys are reproducible.
- `.env.example` (repo root) — document every env var (see §2.3).
- `frontend/.env.example` — `VITE_API_BASE_URL=http://localhost:8002`.

### 2.2 Code changes

- **`backend/app/main.py`** — tighten CORS: read `FRONTEND_ORIGIN` from env, allow only that origin (keep a localhost dev fallback). Currently permissive.
- **`backend/app/database.py`** — switch the DB URL from hardcoded SQLite to env-driven: `DATABASE_URL=sqlite+aiosqlite:///./subadash.db` for local, `postgresql+asyncpg://…` for Supabase. Add `asyncpg` to requirements.
- **`backend/app/routers/upload.py`** — add S3-compatible upload path using `boto3` pointed at Cloudflare R2 (feature-flagged; local dev keeps filesystem writes). Store only the R2 key in DB, not the bytes.
- **`backend/run_server.py`** — honor `PORT` env var (Render injects this), fallback to 8002 for local.
- **`backend/app/services/analyzer_service.py`** — un-hardcode `claude-opus-4-6`. Read `ANTHROPIC_MODEL_ANALYZE` (default Haiku) and `ANTHROPIC_MODEL_CHAT` (default Haiku) from env. Cost control for the $5 budget.
- **`frontend/src/lib/api.ts`** (or equivalent) — read `import.meta.env.VITE_API_BASE_URL`, strip any `localhost:8002` hardcodes.

### 2.3 Environment variables (document in `.env.example`)

```
# Backend
DATABASE_URL=                     # sqlite+aiosqlite:///./subadash.db OR postgresql+asyncpg://...
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL_ANALYZE=claude-haiku-4-5-20251001
ANTHROPIC_MODEL_CHAT=claude-haiku-4-5-20251001
JWT_SECRET=
FRONTEND_ORIGIN=https://subadash.pages.dev
MAX_UPLOAD_MB=25
# R2 / S3 (Phase 2, optional in Phase 1)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=subadash-uploads
# Sandbox
SANDBOX_MODE=subprocess           # subprocess | e2b
SANDBOX_TIMEOUT_SECONDS=10
SANDBOX_MEMORY_MB=256

# Frontend
VITE_API_BASE_URL=https://subadash-api.onrender.com
```

### 2.4 Deployment sequence

**Phase 1 — Portfolio demo (no real users, SQLite is fine)**
1. Prep code per §2.1/2.2/2.3. Test locally with the new env-driven config.
2. Push repo to GitHub.
3. Render → New Web Service → connect repo → pick `backend/` as root → Docker → add env vars from §2.3 → deploy. Persistent disk mount at `/var/data` for SQLite file.
4. Cloudflare Pages → connect repo → build cmd `npm run build` (in `frontend/`) → output `frontend/dist` → add `VITE_API_BASE_URL` → deploy.
5. Update `FRONTEND_ORIGIN` on Render to the Pages URL. Restart.
6. Set up `cron-job.org` ping to `/api/health` every 10 min.

**Phase 2 — Migrate to Supabase + R2 (before announcing to real users)**
1. Create Supabase project (free). Enable `pgvector` if we ever add semantic search over uploads.
2. Run `alembic init` + generate initial migration from current models + apply.
3. Swap `DATABASE_URL` to Supabase connection string on Render.
4. Create R2 bucket, set R2 env vars on Render, flip upload path to R2.
5. No frontend changes needed.

---

## 3. Feature 2 — Chat-Driven Dashboard Editor

### 3.1 User experience

```
User: "Change the revenue chart to a bar chart and sort it descending"
Bot:  [runs sandboxed Python, updates dashboard]
      "Done — the revenue chart is now a bar chart sorted high to low."
      [dashboard re-renders with the new chart]
```

```
User: "Add a chart showing month-over-month growth for each product"
Bot:  [generates Python that computes MoM % and appends a new ChartData]
      [dashboard canvas adds the new card]
```

```
User: "Make it look like a BCG matrix instead"
Bot:  [converts dashboard_type to bcg_matrix, remaps charts]
```

### 3.2 Data flow (new)

```
ChatWindow (React)
  │  POST /api/chat/edit { dashboardId, message }
  ▼
chat router
  │
  │ 1. Load dashboard JSON + stored dataframe (parquet/CSV on disk or R2)
  │ 2. Build prompt with:
  │     - current DashboardSchema JSON (source of truth)
  │     - dataframe schema + 5-row sample
  │     - allowed functions / imports
  │     - user message
  │     - few-shot examples of valid edits
  │ 3. Call Anthropic (Haiku by default) with a tool-use spec OR
  │    structured output → get a Python script string
  │
  ▼
SandboxExecutor (new service)
  │ 4. Parse script with `ast.parse`, validate against allowlist
  │    (allowed imports: pandas, numpy; denied: os, sys, subprocess, etc.)
  │ 5. Write script to temp file, run via subprocess:
  │      - unprivileged user
  │      - no network (block via env / seccomp in Phase 2)
  │      - RLIMIT_CPU, RLIMIT_AS, timeout
  │      - pass input via stdin as JSON { dashboard, df_parquet_path }
  │      - expect stdout JSON { dashboard: NEW_DASHBOARD_SCHEMA, explanation: str }
  │ 6. Validate stdout against DashboardSchema (pydantic)
  │ 7. Persist new dashboard version (keep old as audit history)
  │ 8. Return { dashboard, explanation, diff } to frontend
  │
  ▼
ChatWindow
  │ 9. React Query invalidates dashboard cache → canvas re-renders
  │ 10. Appends assistant message with explanation + "Undo" button
```

### 3.3 The "agent contract" (system prompt, abbreviated)

The LLM must emit a Python script with this exact signature:

```python
# BEGIN_SCRIPT
import pandas as pd
import json
import sys

def edit_dashboard(dashboard: dict, df: pd.DataFrame) -> dict:
    # ...transformations...
    return dashboard  # must conform to DashboardSchema

if __name__ == "__main__":
    payload = json.loads(sys.stdin.read())
    df = pd.read_parquet(payload["df_parquet_path"])
    new_dashboard = edit_dashboard(payload["dashboard"], df)
    print(json.dumps({"dashboard": new_dashboard, "explanation": "..."}))
# END_SCRIPT
```

Anything outside the `BEGIN_SCRIPT`/`END_SCRIPT` markers is stripped. The AST validator rejects scripts that don't match this shape.

### 3.4 New files to create

- `backend/app/services/sandbox_executor.py` — the restricted subprocess runner. Key functions: `validate_ast(src)`, `run(script, input_payload, timeout, memory_mb)`. Use `resource.setrlimit` on Linux for CPU/memory caps. Windows fallback for dev.
- `backend/app/services/chat_editor_service.py` — orchestrates: load context → build prompt → call Anthropic → extract script → call sandbox → validate output → persist version.
- `backend/app/routers/chat.py` — add `POST /api/chat/edit` endpoint. Keep existing `/api/chat` for Q&A.
- `backend/app/models/dashboard_version.py` — new table `dashboard_versions (id, dashboard_id, version_num, snapshot_json, created_at, prompt, script)` for undo/history.
- `backend/app/schemas/chat_edit.py` — request/response Pydantic models.
- `backend/tests/test_sandbox_ast.py` — unit tests for the AST allowlist. This is security-critical; test with known malicious scripts (imports of `os`, `subprocess`, `eval`, `__import__`, dunder access, file I/O, sockets).
- `frontend/src/components/chat/ChatEditPanel.tsx` — new chat UI variant that sits alongside the dashboard, submits edits, and shows the assistant's explanation + an "Undo" button.
- `frontend/src/hooks/useDashboardEdit.ts` — React Query mutation wrapping `POST /api/chat/edit`, invalidates the dashboard query on success.

### 3.5 Code changes to existing files

- `backend/app/models/dashboard.py` — add `current_version_id` FK to `dashboard_versions` + relationship.
- `backend/app/routers/upload.py` — after parsing, also **save the dataframe as Parquet** (`pd.DataFrame.to_parquet`) to disk/R2 and record the path. The sandbox needs this file to load into pandas.
- `backend/app/schemas/dashboard.py` — add a `version` int field so the frontend can detect stale state.
- `backend/requirements.txt` — add `pyarrow` (for parquet), `RestrictedPython` (optional, second line of defense), nothing else exotic.
- `frontend/src/pages/DashboardPage.tsx` — embed `<ChatEditPanel />` as a side drawer. Add a version badge + history list (powered by new `GET /api/dashboards/:id/versions`).

### 3.6 Security — this is the sharp edge

Running LLM-generated Python is dangerous. Defenses, layered:

1. **AST allowlist** — reject any script that:
   - imports anything outside `{pandas, numpy, json, math, statistics, datetime}`
   - uses `exec`, `eval`, `compile`, `__import__`, `open`, `globals`, `locals`, dunder attribute access (`x.__class__`), `getattr`/`setattr` with non-literal names.
2. **Subprocess isolation** — run as unprivileged user, no network (Render free doesn't let us configure iptables, so we drop it via `http_proxy=` sinks + remove urllib from allowlist), `RLIMIT_CPU=10s`, `RLIMIT_AS=256MB`, `RLIMIT_NOFILE=16`, timeout via `signal.SIGKILL`.
3. **Filesystem confinement** — pass only the parquet path; executor cwd is a tempdir that's deleted after.
4. **Output validation** — must be JSON, must parse as `DashboardSchema`, chart data arrays capped at 10k rows.
5. **Rate limit** — max 10 edit requests per user per 5 min (new middleware).
6. **Phase 2 upgrade path** — when real users arrive, swap `SANDBOX_MODE=e2b`. E2B gives proper Firecracker microVM isolation with network control. Same executor interface, different backend. E2B's free tier is ~100 hours/mo, plenty for portfolio traffic + small user base.

### 3.7 Prompting strategy (to keep LLM cost + quality predictable)

- Use **Claude Haiku** as default. Sonnet only if Haiku returns an invalid script twice (auto-retry with escalation).
- Provide the DashboardSchema as a compact JSON Schema in the system prompt, plus 3 few-shot examples (swap chart type, add derived column, change aggregation).
- Cap the prompt by sending only the **schema + 5-row sample** of the dataframe, never the whole extracted_text. For Word/PDF sources where schema is fuzzy, we send the first 2 KB of extracted text.
- Stream the response so the UI can show "thinking…" instead of a silent pause.

---

## 4. Open questions for Faisal (confirm before executing)

1. **Priority order** — should Claude Code tackle *deployment* first (Phase 1) and *chat editor* second, or build the chat editor locally first and deploy at the end? Recommendation: deployment first so there's a shareable URL throughout iteration.
2. **Auth posture** — the portfolio site has no auth; SubaDash does. For the free-tier demo, should uploads require login, or allow anonymous with rate limits? (Anonymous is friendlier for recruiter evaluation; login is friendlier for real-user Phase 2.) Recommendation: allow anonymous with heavier rate limits; keep login for saving dashboards.
3. **Versioning UI** — should users see a full version history sidebar (with revert-to-any), or just an Undo/Redo button? Recommendation: Undo/Redo first, history panel later.
4. **Chart library** — Recharts is current. The sandbox outputs `DashboardSchema` JSON which Recharts renders. If an edit needs a chart type Recharts can't do (e.g., sankey), do we (a) reject the edit, (b) add react-plotly.js and let sandbox output Plotly figures, or (c) pre-render in sandbox via matplotlib and return a PNG? Recommendation: start with (a) — reject unsupported types with a clear message; add react-plotly.js in Phase 2 if demand shows up.
5. **Model choice for the chat editor** — Haiku default + Sonnet escalation as proposed, or Sonnet always? Haiku is ~12× cheaper and usually fine for structured JSON tasks. Recommendation: Haiku default.

---

## 5. Files to create / modify (checklist for Claude Code)

### Create

- `backend/Dockerfile`
- `backend/.dockerignore`
- `render.yaml`
- `.env.example` (root)
- `frontend/.env.example`
- `backend/app/services/sandbox_executor.py`
- `backend/app/services/chat_editor_service.py`
- `backend/app/models/dashboard_version.py`
- `backend/app/schemas/chat_edit.py`
- `backend/tests/test_sandbox_ast.py`
- `frontend/src/components/chat/ChatEditPanel.tsx`
- `frontend/src/hooks/useDashboardEdit.ts`

### Modify

- `backend/app/main.py` (CORS env-driven)
- `backend/app/database.py` (DATABASE_URL env)
- `backend/app/routers/upload.py` (save parquet, R2 flag)
- `backend/app/routers/chat.py` (new `/api/chat/edit` endpoint)
- `backend/app/services/analyzer_service.py` (env-driven model names)
- `backend/app/models/dashboard.py` (current_version_id FK)
- `backend/app/schemas/dashboard.py` (version field)
- `backend/run_server.py` (honor `$PORT`)
- `backend/requirements.txt` (+ pyarrow, asyncpg, boto3, RestrictedPython)
- `frontend/src/lib/api.ts` (use `VITE_API_BASE_URL`)
- `frontend/src/pages/DashboardPage.tsx` (embed ChatEditPanel + version badge)

### Leave alone

- Existing chart components in `frontend/src/components/charts/` — the sandbox preserves the DashboardSchema contract, so rendering stays the same.
- `components/upload/FileDropzone.tsx` — no changes needed for either feature.
- Stripe deps — unused; remove in a cleanup PR if desired.

---

## 6. Suggested execution order

Work is now broken into **three tracks** — deploy once, then ship features in waves. Features are spec'd in §7. Cost reality check is in §8.

### Track A — Infrastructure (do first, once)

1. **Deployment Phase 1** (§2.1–2.4 phase 1): Dockerfile, CORS, env-driven config, Render + Cloudflare Pages, cron pinger. ~1 working session.
2. **Parquet persistence** (§3.5 upload changes only): every upload now also writes parquet. Prerequisite for the editor AND for F4 scenarios. ~30 min.
3. **Multi-provider LLM fallback** (§8.2): extend `analyzer_service.py` factory to chain Anthropic → Groq → Gemini with automatic failover when credits run out. ~1 session. **Critical for true zero-cost operation.**

### Track B — Chat editor core (do second)

4. **Sandbox executor + AST tests** (§3.4 + §3.6 defenses 1–4): build and test in isolation with hostile inputs before wiring to any LLM. ~1 working session.
5. **Chat editor service + endpoint** (§3.2–3.3): wire sandbox to LLM chain + new `/api/chat/edit`. ~1 session.
6. **Frontend ChatEditPanel + undo** (§3.4 frontend): ~1 session.

### Track C — Feature waves (ship iteratively)

7. **Wave 1 (§7 F3, F7, F8)** — Auto Period Comparison, Data Quality Preflight, Show-the-Math panel. All small-to-medium, no new deps, big UX payoff. ~1–2 sessions total.
8. **Wave 2 (§7 F1, F5, F9)** — Framework Templates, Executive Brief PDF, PowerPoint Export. The "this looks like a real product" wave. ~3 sessions.
9. **Wave 3 (§7 F2, F4, F6)** — Multi-file Joining, What-If Scenarios, Drill-down/Cross-filter. UX-heavy, higher complexity. ~4–5 sessions.
10. **Wave 4 (§7 F10)** — Shareable link with comments (collaboration layer). ~1 session.

### Track D — Scale-up (only when real users arrive)

11. **Deployment Phase 2** (§2.4 phase 2): Supabase migration, R2 uploads, swap sandbox to E2B. No code rewrites — just env var flips.

---

## 7. Feature expansion — top 10 (added after persona brainstorm)

Each feature is spec'd for Claude Code: files touched, approach, complexity (S/M/L), and whether it needs the LLM. All features respect the free-tier posture.

### F1. Framework Templates Library — **M, LLM**
**Personas:** business analyst, student, case prep. **Wave 2.**

Expand beyond the current `dashboard_type` enum (`pl_statement, bcg_matrix, swot, kpi_summary, market_analysis, general`) to a polished library: add `porters_five_forces`, `pestel`, `ansoff_matrix`, `marketing_funnel`, `4ps_marketing_mix`, `value_chain`. Each framework gets:
- A framework-specific system prompt (`backend/app/prompts/frameworks/<name>.md`) that instructs the analyzer how to map raw data into that framework's structure.
- A preview image + description for the template picker.
- A validator that checks the output DashboardSchema actually matches the framework's shape (e.g., BCG must have a 2x2 quadrant chart; SWOT must have four text blocks).

**Create:** `backend/app/services/framework_mapper.py`, `backend/app/prompts/frameworks/*.md`, `frontend/src/components/upload/TemplatePicker.tsx`.
**Modify:** `backend/app/schemas/dashboard.py` (extend enum), `backend/app/routers/analyze.py` (accept `template` param), upload page to show picker.

### F2. Multi-file Joining with Smart Key Inference — **L, optional LLM**
**Personas:** analyst, student. **Wave 3.**

Accept multiple files in one upload session. Infer join keys by:
1. Column-name fuzzy matching (`thefuzz` library — add to reqs).
2. Value overlap sampling (what fraction of values in column A also appear in column B).
3. Dtype compatibility.
4. Cardinality heuristics (primary key candidates have unique values).

Show the user a proposed join graph; let them confirm/edit. Produce a unified DataFrame passed downstream to analysis.

**Create:** `backend/app/services/join_engine.py`, `backend/app/routers/joins.py`, `frontend/src/components/upload/JoinProposer.tsx`, `frontend/src/hooks/useJoinProposal.ts`.
**Modify:** `backend/app/routers/upload.py` (accept `List[UploadFile]`), `frontend/src/components/upload/FileDropzone.tsx` (multi-file mode).
**Deps:** `thefuzz` (MIT, tiny).

### F3. Auto Period Comparison — **S, narrative via LLM only**
**Personas:** CEO, analyst. **Wave 1.**

During analyze phase, detect date/datetime columns (dtype + regex on object columns). If found, auto-compute MoM / QoQ / YoY deltas for every numeric column. Attach to KPIs as `trend` + `delta` fields (already in `KPIData` schema — just wire it up). Generate a one-line narrative per KPI via LLM ("Revenue up 12% QoQ, driven by APAC").

**Create:** `backend/app/services/period_analyzer.py`.
**Modify:** `backend/app/services/analyzer_service.py` (call period_analyzer when dates detected), `frontend/src/components/dashboard/KPICard.tsx` (show delta arrow + narrative tooltip).
**Deps:** none.

### F4. What-If Scenario Modeling via Chat — **M, LLM (chat editor)**
**Personas:** CEO, business analyst, case prep. **Wave 3.**

Extends the chat editor. User says "what if revenue grew 15%" — the sandboxed script doesn't *replace* the dashboard data, it appends a `ScenarioData` object containing the delta. Charts render base + scenario as overlay (line charts get dashed scenario lines; bar charts get grouped bars).

**Create:** new `ScenarioData` model in `backend/app/schemas/dashboard.py`, scenario toggle UI in `frontend/src/components/charts/*`.
**Modify:** chat editor system prompt (new few-shot for scenarios), `ChatEditPanel.tsx` (scenario chip display + toggle).
**Deps:** none.

### F5. Executive Brief Generator — **M, LLM**
**Personas:** CEO, student, case prep. **Wave 2.**

`POST /api/dashboards/:id/brief` generates a polished one-page PDF. Flow: LLM reads dashboard JSON → writes a structured narrative (headline, top 3 insights, top 3 risks, 3 recommended actions) → WeasyPrint (already in deps) renders an HTML template to PDF. Template lives at `backend/app/templates/executive_brief.html` with CSS for print.

**Create:** `backend/app/services/brief_generator.py`, `backend/app/templates/executive_brief.html` + css, `frontend/src/components/dashboard/BriefButton.tsx`.
**Modify:** `backend/app/routers/dashboards.py` (new endpoint), `DashboardPage.tsx` (button + preview modal).
**Deps:** none (WeasyPrint already present).

### F6. Drill-down + Cross-filter — **M, pure frontend**
**Personas:** analyst, CEO. **Wave 3.**

Click a bar/slice/point in any chart → all other charts on the canvas filter to that value. Implementation: new `useFilterStore` Zustand slice holding active filters; every chart component reads filters from store and applies before rendering; every chart component emits filter events on interaction.

**Create:** `frontend/src/stores/filterStore.ts`, `frontend/src/hooks/useFilteredData.ts`, `frontend/src/components/dashboard/ActiveFiltersBar.tsx`.
**Modify:** all chart components in `frontend/src/components/charts/` (add `onSegmentClick` + read filters).
**Deps:** none.

### F7. Data Quality Preflight — **M, pure code**
**Personas:** analyst, student. **Wave 1.**

Between upload and analyze, insert a "Data Check" step. Service runs: null counts per column, duplicate row detection, outlier detection (IQR method), type inconsistency detection, suspicious value flags (strings that should be numbers, dates outside sane ranges). UI shows findings; user can apply suggested fixes (fill nulls with median, drop dups, coerce types) before analysis.

**Create:** `backend/app/services/data_quality.py`, `backend/app/routers/quality.py` (`GET /api/uploads/:id/quality`, `POST /api/uploads/:id/fix`), `frontend/src/pages/DataQualityPage.tsx`.
**Modify:** upload flow in frontend to route through quality check (skippable).
**Deps:** none (scipy for IQR — already pulled by pandas).

### F8. "Show the Math" Methodology Panel — **S, pure code**
**Personas:** analyst, student. **Wave 1.**

Every `KPIData` and `ChartData` gets an optional `source_code: str | None` field. For auto-generated analyses, the analyzer stores the pandas expression. For chat-editor outputs, the sandbox captures the generated script. UI reveals a collapsible code block per card with syntax highlighting.

**Create:** none (reuses existing structures).
**Modify:** `backend/app/schemas/dashboard.py` (add `source_code` field), `backend/app/services/analyzer_service.py` (capture code when generating), `backend/app/services/chat_editor_service.py` (capture script), `KPICard.tsx` + `ChartCard.tsx` (add expandable code section).
**Deps:** `react-syntax-highlighter` (frontend).

### F9. PowerPoint Export with Speaker Notes — **L, pure code**
**Personas:** business analyst, case prep. **Wave 2.**

`POST /api/dashboards/:id/export/pptx` generates a `.pptx` where each KPI group / chart becomes a slide, with auto-generated speaker notes from the insights. Charts are rendered server-side to PNG (matplotlib from the stored data; keeps frontend out of export path). Slide master matches the brand.

**Create:** `backend/app/services/pptx_exporter.py`, `backend/app/templates/subadash_slide_master.pptx`, route in `dashboards.py`.
**Modify:** `ExportButton.tsx` (add PowerPoint option).
**Deps:** `python-pptx`, `matplotlib` (or `kaleido` if we move to Plotly server-side in Phase 2).

### F10. Shareable Read-only Link with Inline Comments — **M, pure code**
**Personas:** all. **Wave 4.**

`DashboardShare` already exists — extend. New `DashboardComment` model (id, dashboard_id, chart_ref, author_name, text, created_at). Public endpoints `GET/POST /api/shared/:token/comments`. Frontend pins comment threads to specific charts on the shared page. No auth on comments; rate limit by IP; profanity filter (tiny library, optional).

**Create:** `backend/app/models/dashboard_comment.py`, `backend/app/routers/shared.py` updates, `frontend/src/components/shared/CommentThread.tsx`, `frontend/src/pages/SharedPage.tsx` enhancements.
**Modify:** `DashboardShare` model (`allow_comments: bool`).
**Deps:** none (optional `better_profanity`).

---

## 8. Cost reality check — honest answer

Faisal asked: *"the deployment won't cost me anything right?"* Answer: **hosting is free; LLM usage is metered against your prepaid Anthropic credit**. Here's the breakdown and the plan to make operation genuinely $0 once credits run out.

### 8.1 Monthly infrastructure cost: $0 (as long as we stay on free tiers)

| Component | Free tier | Would cost if we exceeded |
|---|---|---|
| Cloudflare Pages | Unlimited static requests, 500 builds/mo | Effectively never exceeded at portfolio scale |
| Render Web Service | 750 hours/mo single instance, 512 MB RAM | $7/mo for always-on |
| Supabase (Phase 2) | 500 MB DB, 2 GB bandwidth | $25/mo Pro |
| Cloudflare R2 (Phase 2) | 10 GB storage, zero egress cost | $0.015/GB beyond 10 GB |
| Cron pinger | free forever | — |
| Anthropic credits | **Faisal's $5 prepaid** | ~$0.80 per 1M input tokens on Haiku; ~$4 per 1M output tokens |

At portfolio traffic, none of these caps will be hit. At real-user scale (Phase 2), the first thing to blow is the Render RAM limit or the Supabase DB size — both signal that it's time to move off free tiers anyway.

### 8.2 LLM usage — the real variable cost, and how to zero it out

Every chat edit, analyze call, period-comparison narrative, and executive brief makes LLM calls. To keep operation free even after $5 runs dry, extend `analyzer_service.py` with a **provider chain**:

1. **Primary: Anthropic Claude Haiku** — used while credit remains. Highest quality structured output.
2. **Fallback 1: Groq (Llama 3.1 70B)** — free tier, very generous (~14k req/day on Llama 3 70B), sub-second latency. Good enough for chat edits and narratives.
3. **Fallback 2: Google Gemini 1.5 Flash** — free tier (15 req/min, 1M tokens/day). Strong structured output.
4. **Fallback 3: Hugging Face Inference API** — free tier for open models; slower, last resort.

Implementation: add a credit-balance check (either parse Anthropic error responses for quota exhaustion, or manually flip an env var `PRIMARY_LLM=groq` when you top up / run out). The factory already supports this pattern — we're just extending providers and adding a chain config.

### 8.3 How long does $5 actually last?

Rough math, assuming Haiku defaults:
- **Chat edit:** ~3–5k input tokens (schema + sample + conversation) + ~500 output tokens ≈ **$0.005 per edit**. $5 = **~1,000 edits**.
- **Executive brief:** ~2k input + ~1.5k output ≈ **$0.01 per brief**. $5 = **~500 briefs**.
- **Analyze on upload:** ~4k input + ~1k output ≈ **$0.008 per analyze**. $5 = **~600 analyses**.

For a portfolio demo where recruiters evaluate the tool occasionally, this is enormous headroom — months to a year of demo traffic. For real-user Phase 2, you'd either top up or lean more on the Groq/Gemini fallbacks.

### 8.4 The one cost I can't zero out

**Your time and electricity** while developing locally. Nothing to do about that one.

---

## 9. Updated open questions (supersedes §4 where overlapping)

Carry over from §4 plus new ones raised by §7/§8:

6. **Free-LLM fallback priority** — should the provider chain prefer Groq (faster, generous free tier) or Gemini (better structured output) as the first fallback? Recommendation: Groq first for speed, Gemini second as structured-output escape hatch.
7. **Feature wave signoff** — is the Wave 1/2/3/4 ordering in §6 Track C correct, or do you want to reshuffle (e.g., pull F5 Executive Brief into Wave 1 because it's the most impressive recruiter-facing feature)?
8. **Cost ceiling alerts** — should we add a simple in-app banner when estimated monthly LLM spend exceeds a configurable threshold, so you never get a surprise bill if you top up Anthropic? Recommendation: yes, trivial to add.

---

*End of plan. Claude Code: confirm §4 + §9 questions with Faisal, then execute §6 tracks A → B → C → D. Track A must complete before Track B; Track C waves can ship in any order once B is done.*
