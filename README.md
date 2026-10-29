# EWW Standup Wheel

A spin wheel that picks who leads the EWW ASCENSUS daily standup (Monday to Thursday).

The app runs on [Gizmos](https://gizmos.run) at <https://eww-standup-wheel.telus.gizmos.run>. You must sign in with TELUS SSO to open it.

## How the wheel picks a leader

The wheel uses a strict rotation:

1. The wheel shows only the people who have led the fewest standups.
2. Everyone leads once before anyone leads again.
3. When a new round starts, the wheel leaves out the previous leader. Nobody leads two standups in a row.
4. A re-spin for a date that already has a leader does not count that leader's lead for that date.
5. The draw uses `crypto.getRandomValues`.

Uncheck a person in the Team list to leave them off the wheel for that day. Their count does not change, so they stay in the round.

The logic is in `entries()` in `page.js`.

## Project structure

| File | Purpose |
|---|---|
| `worker.js` | The Worker. It serves the page and the JSON API. |
| `page.js` | The full HTML page (wheel, team list, history) as one string. |
| `migrations/` | D1 schema and seed data. Gizmos applies them on each deploy. |
| `wrangler.toml` | The app name and the `DB` D1 binding. |

There is no build step and there are no dependencies.

### API

| Method and path | Purpose |
|---|---|
| `GET /api/members` | Active members, with `led_count` and `last_led` |
| `POST /api/members` | Add a member. Body: `{ "name": "..." }` |
| `DELETE /api/members/:id` | Remove a member (soft delete, the history stays) |
| `GET /api/standups?limit=30` | Latest standup records |
| `POST /api/standups` | Save the leader for a date. Body: `{ "date": "YYYY-MM-DD", "member_id": 1 }` |
| `DELETE /api/standups/:date` | Delete the record for a date |

### Database

- `members`: `id`, `name`, `active`, `created_at`
- `standups`: one row for each date (`date` is the primary key), with `member_id`

## Run it locally

You need Node.js and [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

```bash
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```

Open <http://localhost:8787>. The local database is in `.wrangler/` (git ignores it).

## Deploy to Gizmos

### 1. Install the Gizmos CLI

macOS / Linux:

```bash
curl -fsSL https://gizmos.run/skills/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://gizmos.run/skills/install.ps1 | iex
```

Or use npm: `npm i -g gizmos-cli`.

### 2. Sign in

```bash
gizmos login
gizmos whoami
```

`gizmos login` opens a page in your browser. Check that the code matches, then click **Approve**.

To deploy, you must have editor (or higher) access to the `eww-standup-wheel` gizmo. Ask the app owner to share it with you in the Gizmos hub.

### 3. Preview the deploy

```bash
gizmos push --dry-run .
```

This shows the files and the app name. It does not send anything.

### 4. Deploy

```bash
gizmos push -m "short description of the change" .
```

The deploy goes live immediately. The `-m` text names the version in the hub's Versions tab. To go back to an older version, use the Versions tab.

### Change the database schema

1. Add a new numbered file to `migrations/`, for example `0003_add_column.sql`.
2. Deploy. Gizmos applies the new migrations before the first request.

Do not edit a migration that Gizmos already applied. Gizmos does not run it again.

### Useful commands

```bash
gizmos db migrate eww-standup-wheel --status              # show applied and pending migrations
gizmos db export eww-standup-wheel --binding DB --output backup.sql   # full backup (owner/admin only)
gizmos db pull eww-standup-wheel --binding DB              # schema only
gizmos logs eww-standup-wheel --since 1h --level error     # server logs
```

Make a backup with `gizmos db export` before you change data by hand.
