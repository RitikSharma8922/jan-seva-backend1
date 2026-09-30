# Jan Seva — Backend API

A small Express + PostgreSQL API that the Jan Seva frontend talks to instead
of `localStorage`. It exposes the same operations the frontend's
`AppContext.jsx` used to do locally: citizen/officer login & registration,
complaint creation & status updates, user blocking, and notifications.

## 1. Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to your Postgres connection string, e.g.

```
DATABASE_URL=postgresql://postgres:password@helium/heliumdb?sslmode=disable
```

Create the tables and demo data (safe to re-run — uses `ON CONFLICT DO NOTHING`):

```bash
npm run db:setup
```

Start the API:

```bash
npm run dev
```

It listens on `http://localhost:4000` by default (`PORT` in `.env`).
Visit `http://localhost:4000/api/health` — you should see `{"ok":true}`.

## 2. API reference

| Method | Route                           | Body / Query                                              | Notes |
|--------|----------------------------------|-------------------------------------------------------------|-------|
| POST   | `/api/auth/citizen/login`        | `{ emailOrPhone, password }`                                 | |
| POST   | `/api/auth/citizen/register`     | `{ name, email, phone, password }`                            | |
| POST   | `/api/auth/government/login`     | `{ id, password }`                                            | |
| GET    | `/api/complaints`                | —                                                              | all complaints, newest first |
| GET    | `/api/complaints/:id`            | —                                                              | one complaint with timeline |
| POST   | `/api/complaints`                | `{ category, title, description, location, lat, lng, photo, citizenEmail }` | generates the `JS-YYYY-NNN` id |
| PATCH  | `/api/complaints/:id/status`     | `{ status, govRemarks?, resolutionRemarks?, resolutionPhoto? }` | advances the timeline & notifies the citizen |
| GET    | `/api/users`                     | —                                                              | includes each user's complaint count |
| PATCH  | `/api/users/:id/status`          | `{ status: "active" \| "blocked" }`                           | |
| GET    | `/api/notifications`             | `?role=citizen&email=...` or `?role=government`               | |

All responses are JSON and use the same field names the frontend already
expects (`camelCase`), so `AppContext.jsx` can call these directly.

## 3. Connecting the frontend

See `frontend/.env.example` — set `VITE_API_URL=http://localhost:4000/api`
and the already-updated `AppContext.jsx` will use this API instead of
`localStorage` for complaints, users and notifications (the current logged-in
user is still cached in `localStorage` for convenience, but all real data
lives in Postgres now).

## 4. Still worth doing before this is production-ready

- Hash passwords (bcrypt/argon2) instead of storing them in plain text.
- Replace the "pass the logged-in user's email with every request" pattern
  with real sessions or JWTs — right now any client can claim to be any
  citizen email.
- Move photo uploads to object storage (S3, etc.) instead of storing base64
  image data directly in Postgres.
- Add rate limiting and input validation (e.g. `zod`) on all routes.
