import { PAGE } from "./page.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function listMembers(db) {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.name,
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
      await db.prepare("INSERT INTO members (name) VALUES (?)").bind(name).run();
      return json(await listMembers(db), 201);
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
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};
