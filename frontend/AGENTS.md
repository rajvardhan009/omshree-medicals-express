# Local frontend architecture
- Keep TanStack Start routing, React Query and existing billing UI.
- Use src/lib/express-api.ts for browser REST requests and Express JWT session events; do not connect this local variant to Cloud clients.
- Compute authoritative totals and numbers in the backend; the frontend formats and previews amounts only.
