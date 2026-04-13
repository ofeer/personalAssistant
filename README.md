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
