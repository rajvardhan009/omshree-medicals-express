# Omshree Medicals — local Express frontend

This is the complete frontend wired to the matching Express + PostgreSQL backend, not Lovable Cloud. It retains TanStack Start and all billing screens. Use the backend v2 ZIP delivered with it; the older server ZIP lacks endpoints this frontend needs.

## Requirements
- Node.js 22.12+ and npm
- PostgreSQL 14+ (for the backend)
- Two terminal windows

## 1. Start the backend
Extract `omshree-medicals-express_v2.zip` and open a terminal inside its `backend` folder.

1. Run `npm install`.
2. Copy `.env.example` to `.env` (Windows: `copy .env.example .env`; macOS/Linux: `cp .env.example .env`).
3. Set `DATABASE_URL` to your local PostgreSQL database connection. Create the database first, for example `CREATE DATABASE omshree;` in your PostgreSQL tool.
4. Replace `JWT_SECRET=change-me` with your own random secret; keep it private. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
5. Run `npm run db:init` to create tables.
6. Run `npm run dev`. Leave this terminal open. API: http://localhost:4000/api; health: http://localhost:4000/health.

## 2. Start the frontend
In another terminal, inside this `frontend` folder:

1. Run `npm install`.
2. Copy `.env.example` to `.env` using the same command above.
3. Leave `VITE_API_URL=http://localhost:4000/api` unless you change the backend port.
4. Run `npm run dev`.
5. Open http://localhost:3000 and choose **New here? Create an account**. Local accounts are separate from your online app; existing online passwords and records are not copied.

## Production-style local frontend
Run `npm run build`, then `npm start`. Keep the Express server running separately. The frontend needs its `.output` folder created by the build. Default port: 3000. `VITE_API_URL` is read at build time, so rebuild after changing it.

## Bill photo reading (optional)
Local photo import uses the Express backend's own AI configuration, not Lovable credits.
- Default Ollama: install Ollama, run `ollama pull llama3.2-vision`, keep Ollama running at http://localhost:11434.
- Or set `AI_PROVIDER=openai` and your own `OPENAI_API_KEY` in the backend `.env` (never in the frontend). OpenAI charges apply.
- JPG, PNG and WebP up to 10 MB are accepted. Review extracted values before saving. Core billing works without an AI service.

## Offline and security
OPD changes queue in this browser while offline and replay using the bill UUID. Non-network server failures remain queued for retry. Do not switch users while changes are pending; sync first. This is a local-development package; before internet hosting, configure HTTPS, allowed CORS origins, secure token handling and backups.

## Verification
The local production frontend was built and run against a real isolated PostgreSQL/Express instance. Browser checks passed account creation, OPD creation and edit/read-back, indoor admission, medicine addition, invoice creation/finalization/read-back, profile save/read-back and sign-out. Seven frontend tests and four backend integration tests passed, including login, account separation, UUID replay and patient soft deletion. AI extraction was not tested because no local AI service or user API key was configured.
