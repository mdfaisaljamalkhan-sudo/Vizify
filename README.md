---
title: Vizify API
emoji: 📊
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Vizify: Data-to-Dashboard Application

A full-stack MBA business dashboard generator that converts Excel, Word, CSV, PDF, and JSON files into interactive, visually stunning dashboards powered by Claude AI.

**Target:** Desktop app (Windows PWA), Web SaaS, and Google Play Store

---

## Quick Start

### Backend (Python FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Backend runs at:** http://localhost:8000
**API Docs:** http://localhost:8000/docs

### Frontend (React PWA)

```bash
cd frontend
npm install
npm run dev
```

**Frontend runs at:** http://localhost:5173

---

## Architecture

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Charts:** Recharts + Plotly.js
- **Animations:** Framer Motion
- **Backend:** Python FastAPI + SQLAlchemy
- **Database:** SQLite (local) → PostgreSQL (production)
- **AI:** Claude API with `tool_use` for structured JSON
- **Auth:** JWT (python-jose + passlib)
- **Payments:** Stripe
- **File Parsing:** pandas, openpyxl, python-docx, pdfplumber

---

## Key Features

### MVP (Phase 1)
- CSV/Excel file upload with drag-and-drop
- Claude AI data analysis → structured dashboard JSON
- KPI cards + bar/line/pie charts
- PNG export

### Phase 2
- Word + PDF parsing
- MBA-specific templates (P&L, BCG, SWOT, Porter's)
- PDF export (jsPDF client-side, WeasyPrint server-side for Pro)
- Dashboard save to SQLite

### Phase 3
- User authentication (JWT)
- Share links + public dashboards
- `/shared/:token` public viewing

### Phase 4
- Stripe Checkout integration
- Tier-based feature gating (Free/Pro/Business)
- Usage limits per tier

### Phase 5
- Deploy to Railway (backend) + Vercel (frontend)
- Custom domain setup
- Google Play Store via Bubblewrap CLI

---

## File Structure

```
Vizify/
├── frontend/           # React PWA application
├── backend/            # Python FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── routers/    # API endpoints
│   │   ├── services/   # Business logic
│   │   ├── models/     # SQLAlchemy models
│   │   └── schemas/    # Pydantic schemas
│   └── requirements.txt
├── .env                # Local secrets (gitignored)
└── README.md
```

---

## Environment Variables

Create a `.env` file in the root:

```
DATABASE_URL=sqlite+aiosqlite:///./vizify.db
JWT_SECRET=your-secret-key-change-this
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
```

---

## Development Commands

### Backend

```bash
cd backend

# Install dependencies
python -m pip install -r requirements.txt

# Run dev server
uvicorn app.main:app --reload --port 8000

# Database migrations (when models change)
alembic upgrade head
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run dev server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

---

## Testing the Connection

The frontend proxies `/api/*` requests to `http://localhost:8000` via Vite config.

Try in browser console:

```javascript
fetch('/api/health').then(r => r.json()).then(console.log)
// Should return: { status: "ok", message: "Vizify API is running" }
```

---

## Next Steps

1. **Implement file upload endpoint** (`POST /api/upload`)
   - Extract file content → text + schema
   - Store temporary file

2. **Implement Claude analyzer** (`POST /api/analyze`)
   - Call Claude with `tool_use`
   - Return structured dashboard JSON

3. **Build React components**
   - `Upload.tsx` - drag-drop file
   - `DashboardCanvas.tsx` - renders chart components
   - `ExportModal.tsx` - PDF/PNG/Share options

4. **Add user authentication**
   - `/api/auth/register` and `/api/auth/login`
   - Protect endpoints with `@require_auth` decorator

5. **Implement Stripe payments**
   - `/api/billing/checkout`
   - `/api/billing/webhook` for subscription updates

---

## Deployment

### Vercel (Frontend)

```bash
# Push frontend/ to GitHub
# Connect to Vercel via GitHub integration
# Set VITE_API_URL environment variable
```

### Railway (Backend)

```bash
# Push backend/ to GitHub
# Connect to Railway
# Add PostgreSQL and Redis add-ons
# Set environment variables
```

### Google Play Store

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://yourdomain.com/manifest.json
bubblewrap build
# Upload .aab file to Google Play Console
```

---

## Notes

- All React components use Tailwind CSS with shadcn/ui components
- Backend returns JSON, frontend is responsible for rendering
- PDF/PNG exports use client-side libraries for MVP speed
- Database models are SQLAlchemy — same code works with SQLite and PostgreSQL
- No Redux — using Zustand for lightweight state management

---

## Resources

- [Vite Docs](https://vite.dev)
- [React Docs](https://react.dev)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Claude API](https://anthropic.com)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)

---

**Built with ❤️ for MBA business analysis**
