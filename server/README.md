# SABLOX API

Node.js + Express API for SABLOX accounts and saved worlds. PostgreSQL stores accounts and worlds.

## API endpoints

- `GET /api/health` — health and database check
- `POST /api/auth/register` — create account with `username` and `password`
- `POST /api/auth/login` — sign in
- `GET /api/me` — current account (Bearer token)
- `GET /api/worlds` — list your worlds
- `POST /api/worlds` — save a world (`name`, `data`)
- `GET /api/worlds/:id` — read a world you own
- `PUT /api/worlds/:id` — update a world you own
- `DELETE /api/worlds/:id` — delete a world you own

Passwords are hashed with bcrypt. JWT sessions expire after 30 days. World operations check ownership.

## Deploy on Render

1. Create a PostgreSQL database in the same Render region as the API and copy its **Internal Database URL**.
2. Open Render Dashboard → **New → Blueprint**, select this GitHub repository, and apply `render.yaml`.
3. When prompted, set `DATABASE_URL` to the database's Internal URL. Render generates `JWT_SECRET`.
4. Deploy and test `https://YOUR-SERVICE.onrender.com/api/health`.

GitHub Pages hosts the frontend but cannot run a persistent server. GitHub stores this source; Render runs the API. The frontend is not wired to this API yet; configure its API base URL after the service is deployed.

## Local development

From this directory, set `DATABASE_URL` and `JWT_SECRET`, then run `npm install && npm start`.
