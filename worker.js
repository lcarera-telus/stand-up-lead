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
      `SELECT m.id, m.name, m.color, m.slack_user_id,
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

function parseISO(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateForSlack(isoDate) {
  const dateObj = parseISO(isoDate);
  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${dayName}, ${monthDay}`;
}

async function notifySlack(webhookUrl, member, date) {
  if (!webhookUrl) return;
  try {
    const dateStr = formatDateForSlack(date);
    const mention = member.slack_user_id ? `<@${member.slack_user_id}>` : member.name;
    const text = `🎯 ${mention} leads standup on ${dateStr}`;
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      console.error("Slack notification failed", { status: resp.status, date, memberId: member.id });
    }
  } catch (err) {
    console.error("Slack notification error", { error: err?.message ?? err, date, memberId: member.id });
  }
}

async function handleApi(req, env, url, ctx) {
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
      await db
        .prepare("INSERT INTO members (name, color) VALUES (?, ?)")
        .bind(name, await randomColor(db))
        .run();
      return json(await listMembers(db), 201);
    }

    if (req.method === "PATCH" && id) {
      const body = await req.json().catch(() => ({}));
      const updates = [];
      const values = [];

      if (body.color !== undefined) {
        const color = String(body.color).toLowerCase();
        if (!COLOR_RE.test(color)) return json({ error: "Color must look like #a1b2c3" }, 400);
        updates.push("color = ?");
        values.push(color);
      }

      if (body.slack_user_id !== undefined) {
        const slackUserId = String(body.slack_user_id ?? "").trim() || null;
        updates.push("slack_user_id = ?");
        values.push(slackUserId);
      }

      if (!updates.length) return json({ error: "No fields to update" }, 400);

      values.push(Number(id));
      const { meta } = await db
        .prepare(`UPDATE members SET ${updates.join(", ")} WHERE id = ? AND active = 1`)
        .bind(...values)
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
        .prepare("SELECT id, name, slack_user_id FROM members WHERE id = ? AND active = 1")
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
      ctx.waitUntil(notifySlack(env.SLACK_WEBHOOK_URL, member, date));
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
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(req, env, url, ctx);
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
