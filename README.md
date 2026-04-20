# Personal App

A personal productivity app with shopping lists, task management, project management, AI chatbot, and Telegram integration.

## Tech Stack

- **Frontend**: React + Vite + TypeScript, shadcn/ui + Tailwind CSS
- **Backend**: Python FastAPI
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email/password)

## Project Structure

```
/frontend    - React SPA
/backend     - FastAPI server
/supabase    - Database migrations
```

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Database

Run the SQL files in `/supabase/migrations/` against your Supabase project in order.

## Railway Deployment (Frontend + Backend)

Deploy this repo as two separate Railway services:

1. `personalassistant-backend`
   - Root Directory: `backend`
   - Start Command: use `backend/Procfile` (auto-detected) or:
     `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Required variables:
     - `SUPABASE_URL`
     - `SUPABASE_KEY`
     - `SUPABASE_JWT_SECRET`
     - `OPENAI_API_KEY` (if chat enabled)
     - `FRONTEND_URL` = frontend Railway URL

2. `personalassistant-frontend`
   - Root Directory: `frontend`
   - Start Command: use `frontend/Procfile` (auto-detected) or:
     `npm run preview -- --host 0.0.0.0 --port $PORT`
   - Required variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_API_BASE_URL` = backend URL + `/api/v1`

Example:
- `VITE_API_BASE_URL=https://personalassistant-backend.up.railway.app/api/v1`
