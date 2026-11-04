import { PAGE } from "./page.js";
import { LOGO_SVG, FAVICON_ICO, APPLE_TOUCH_PNG } from "./icons.js";

const ICONS = {
  "/logo.svg": { b64: LOGO_SVG, type: "image/svg+xml" },
  "/favicon.ico": { b64: FAVICON_ICO, type: "image/x-icon" },
  "/apple-touch-icon.png": { b64: APPLE_TOUCH_PNG, type: "image/png" },
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/;

// Same palette as migrations/0003_member_color.sql.
const PALETTE = ["#e8380d", "#f6a93b", "#f5dc5a", "#8bc34a", "#26a69a", "#29b6f6",
  "#3f6fd8", "#7e57c2", "#d81b9a", "#ff8a80", "#8d6e63", "#b0bec5"];

// A random palette color nobody on the team uses yet, or any random color when all are taken.
async function randomColor(db) {
  const { results } = await db.prepare("SELECT color FROM members WHERE active = 1").all();
  const used = new Set(results.map((r) => r.color));
  const free = PALETTE.filter((c) => !used.has(c));
  const n = crypto.getRandomValues(new Uint32Array(1))[0];
  if (free.length) return free[n % free.length];
  return "#" + (n & 0xffffff).toString(16).padStart(6, "0");
}

async function listMembers(db) {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.name, m.color, m.starting_leads,
              COUNT(s.date) AS led_count,
              MAX(s.date)   AS last_led
         FROM members m
         LEFT JOIN standups s ON s.member_id = m.id
        WHERE m.active = 1
        GROUP BY m.id
        ORDER BY m.name COLLATE NOCASE`
    )
    .all();
  return results;
}

// Average of starting_leads + led_count across the active team, or 0 when nobody is on it.
async function averageLeads(db) {
  const row = await db
    .prepare(
      `SELECT AVG(m.starting_leads + (SELECT COUNT(*) FROM standups s WHERE s.member_id = m.id)) AS avg
         FROM members m
        WHERE m.active = 1`
    )
    .first();
  return row?.avg ?? 0;
}

async function listStandups(db, limit) {
  const { results } = await db
    .prepare(
      `SELECT s.date, s.member_id, m.name
         FROM standups s JOIN members m ON m.id = s.member_id
        ORDER BY s.date DESC
        LIMIT ?`
    )
    .bind(limit)
    .all();
  return results;
}

async function handleApi(req, env, url) {
  const db = env.DB;
  const parts = url.pathname.split("/").filter(Boolean); // ["api", resource, id?]
  const [, resource, id] = parts;

  if (resource === "members") {
    if (req.method === "GET" && !id) return json(await listMembers(db));

    if (req.method === "POST" && !id) {
      const body = await req.json().catch(() => ({}));
      const name = String(body.name ?? "").trim().slice(0, 80);
      if (!name) return json({ error: "Name is required" }, 400);
      const dup = await db
        .prepare("SELECT id FROM members WHERE active = 1 AND name = ? COLLATE NOCASE")
        .bind(name)
        .first();
      if (dup) return json({ error: "That person is already on the team" }, 409);
      // Someone who was removed and comes back gets their old row (and history) again.
      const old = await db
        .prepare("SELECT id, color FROM members WHERE active = 0 AND name = ? COLLATE NOCASE ORDER BY id DESC")
        .bind(name)
        .first();
      if (old) {
        const taken = await db
          .prepare("SELECT 1 FROM members WHERE active = 1 AND color = ?")
          .bind(old.color)
          .first();
        await db
          .prepare("UPDATE members SET active = 1, color = ? WHERE id = ?")
          .bind(taken || !old.color ? await randomColor(db) : old.color, old.id)
          .run();
        return json(await listMembers(db), 201);
      }
      await db
        .prepare("INSERT INTO members (name, color, starting_leads) VALUES (?, ?, ?)")
        .bind(name, await randomColor(db), await averageLeads(db))
        .run();
      return json(await listMembers(db), 201);
    }

    if (req.method === "PATCH" && id) {
      const body = await req.json().catch(() => ({}));
      const color = String(body.color ?? "").toLowerCase();
      if (!COLOR_RE.test(color)) return json({ error: "Color must look like #a1b2c3" }, 400);
      const { meta } = await db
        .prepare("UPDATE members SET color = ? WHERE id = ? AND active = 1")
        .bind(color, Number(id))
        .run();
      if (!meta.changes) return json({ error: "Member not found" }, 404);
      return json(await listMembers(db));
    }

    if (req.method === "DELETE" && id) {
      // Soft delete: keep the history of standups this person led.
      await db.prepare("UPDATE members SET active = 0 WHERE id = ?").bind(Number(id)).run();
      return json(await listMembers(db));
    }
  }

  if (resource === "standups") {
    if (req.method === "GET" && !id) {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 30, 365);
      return json(await listStandups(db, limit));
    }

    if (req.method === "POST" && !id) {
      const body = await req.json().catch(() => ({}));
      const date = String(body.date ?? "");
      const memberId = Number(body.member_id);
      if (!DATE_RE.test(date)) return json({ error: "Invalid date" }, 400);
      const member = await db
        .prepare("SELECT id FROM members WHERE id = ? AND active = 1")
        .bind(memberId)
        .first();
      if (!member) return json({ error: "Member not found" }, 404);
      await db
        .prepare(
          `INSERT INTO standups (date, member_id) VALUES (?, ?)
           ON CONFLICT(date) DO UPDATE SET member_id = excluded.member_id,
                                           created_at = datetime('now')`
        )
        .bind(date, memberId)
        .run();
      return json({ ok: true }, 201);
    }

    if (req.method === "DELETE" && id) {
      if (!DATE_RE.test(id)) return json({ error: "Invalid date" }, 400);
      await db.prepare("DELETE FROM standups WHERE date = ?").bind(id).run();
      return json({ ok: true });
    }
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(req, env, url);
      } catch (err) {
        console.error("api error", err?.message ?? err);
        return json({ error: "Internal error" }, 500);
      }
    }
    const icon = ICONS[url.pathname];
    if (icon) {
      const bytes = Uint8Array.from(atob(icon.b64), (c) => c.charCodeAt(0));
      return new Response(bytes, {
        headers: { "content-type": icon.type, "cache-control": "public, max-age=86400" },
      });
    }
    if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/history") {
      return new Response(PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};
