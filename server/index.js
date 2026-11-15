import express from "express";
import helmet from "helmet";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const { Pool } = pg;
const required = ["DATABASE_URL", "JWT_SECRET"];
for (const key of required) if (!process.env[key]) {
  console.error(`Missing required environment variable: ${key}`);
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map(x => x.trim()) : true }));
app.use(express.json({ limit: "256kb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Требуется вход в аккаунт" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Сессия недействительна. Войдите снова." });
  }
}
const sign = user => jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "30d" });

app.get("/api/health", asyncRoute(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, service: "SABLOX API", database: "connected" });
}));

app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username))
    return res.status(400).json({ error: "Имя: 3–24 символа, латиница, цифры и _" });
  if (password.length < 8 || password.length > 72)
    return res.status(400).json({ error: "Пароль должен содержать от 8 до 72 символов" });
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await pool.query(
      "INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id,username,created_at",
      [username, hash]
    );
    const user = result.rows[0];
    res.status(201).json({ token: sign(user), user: { id: user.id, username: user.username } });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Это имя уже занято" });
    throw e;
  }
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const result = await pool.query("SELECT id,username,password_hash FROM users WHERE username=$1", [username]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "Неверное имя пользователя или пароль" });
  res.json({ token: sign(user), user: { id: user.id, username: user.username } });
}));

app.get("/api/me", auth, asyncRoute(async (req, res) => {
  const r = await pool.query("SELECT id,username,created_at FROM users WHERE id=$1", [req.user.id]);
  if (!r.rows[0]) return res.status(404).json({ error: "Аккаунт не найден" });
  res.json({ user: r.rows[0] });
}));

app.get("/api/worlds", auth, asyncRoute(async (req, res) => {
  const r = await pool.query(
    "SELECT id,name,data,created_at,updated_at FROM worlds WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 100",
    [req.user.id]
  );
  res.json({ worlds: r.rows });
}));

app.post("/api/worlds", auth, asyncRoute(async (req, res) => {
  const name = String(req.body.name || "Мой мир").trim().slice(0, 48);
  const data = req.body.data ?? {};
  if (!data || typeof data !== "object" || Array.isArray(data) || JSON.stringify(data).length > 200000)
    return res.status(400).json({ error: "Некорректные данные мира (лимит 200 КБ)" });
  const id = randomUUID();
  const r = await pool.query(
    "INSERT INTO worlds(id,owner_id,name,data) VALUES($1,$2,$3,$4) RETURNING id,name,data,created_at,updated_at",
    [id, req.user.id, name || "Мой мир", data]
  );
  res.status(201).json({ world: r.rows[0] });
}));

app.get("/api/worlds/:id", auth, asyncRoute(async (req, res) => {
  const r = await pool.query(
    "SELECT id,name,data,created_at,updated_at FROM worlds WHERE id=$1 AND owner_id=$2",
    [req.params.id, req.user.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "Мир не найден" });
  res.json({ world: r.rows[0] });
}));

app.put("/api/worlds/:id", auth, asyncRoute(async (req, res) => {
  const data = req.body.data ?? {};
  if (!data || typeof data !== "object" || Array.isArray(data) || JSON.stringify(data).length > 200000)
    return res.status(400).json({ error: "Некорректные данные мира (лимит 200 КБ)" });
  const name = String(req.body.name || "Мой мир").trim().slice(0, 48) || "Мой мир";
  const r = await pool.query(
    "UPDATE worlds SET name=$1,data=$2,updated_at=NOW() WHERE id=$3 AND owner_id=$4 RETURNING id,name,data,created_at,updated_at",
    [name, data, req.params.id, req.user.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "Мир не найден" });
  res.json({ world: r.rows[0] });
}));

app.delete("/api/worlds/:id", auth, asyncRoute(async (req, res) => {
  const r = await pool.query("DELETE FROM worlds WHERE id=$1 AND owner_id=$2 RETURNING id", [req.params.id, req.user.id]);
  if (!r.rowCount) return res.status(404).json({ error: "Мир не найден" });
  res.json({ ok: true });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

const port = Number(process.env.PORT || 10000);
const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
await pool.query(schema);
app.listen(port, "0.0.0.0", () => console.log(`SABLOX API listening on ${port}`));
