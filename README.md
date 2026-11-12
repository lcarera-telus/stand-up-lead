# EWW Standup Wheel

A spin wheel that picks who leads the EWW ASCENSUS daily standup (Monday to Thursday).

The app runs on [Gizmos](https://gizmos.run) at <https://eww-standup-wheel.telus.gizmos.run>. You must sign in with TELUS SSO to open it.

## How the wheel picks a leader

The wheel gives everyone a slice sized by how far behind the top leader they are:

```
weight = ((max led count - your led count) + 1)^3
slice  = your weight / sum of all weights
```

1. The people with the most leads have weight 1. One lead fewer gives weight 8, two fewer give 27, three fewer give 64.
2. On day 0 everyone has the same weight, so the slices are equal.
3. When someone leads, their slice shrinks and everyone else's slice grows.
4. Each person has a color. Click the color next to a name in the Team list to change it; the database keeps it. A new person gets a random color that nobody else uses. The Team list also shows the chance on the next spin. A slice too thin for its name shows no label, so use the color to find it.
5. The previous leader is left off the wheel for the next spin. Nobody leads two standups in a row.
6. A re-spin for a date that already has a leader does not count that leader's lead for that date.
7. The draw uses `crypto.getRandomValues`, weighted by slice size.

Uncheck a person in the Team list to leave them off the wheel for that day. Their count does not change.

The logic is in `entries()` in `page.js`.

## Project structure

| File | Purpose |
|---|---|
| `worker.js` | The Worker. It serves the page and the JSON API. |
| `page.js` | The full HTML page as one string. The Worker serves it at `/` (wheel and team list) and `/history` (history). |
| `favicon.ico` | The logo icon (16, 32 and 48 px). Gizmos also uses it as the app avatar. |
| `icons.js` | The Ewok wheel logo SVG, `favicon.ico` and a 180 px `apple-touch-icon.png` as base64. The Worker serves them at `/logo.svg`, `/favicon.ico` and `/apple-touch-icon.png`. The page uses `/logo.svg` as the header logo and the main favicon. |
| `migrations/` | D1 schema and seed data. Gizmos applies them on each deploy. |
| `wrangler.toml` | The app name and the `DB` D1 binding. |

There is no build step and there are no dependencies.

### API

| Method and path | Purpose |
|---|---|
| `GET /api/members` | Active members, with `led_count`, `last_led`, and `slack_user_id` |
| `POST /api/members` | Add a member. Body: `{ "name": "..." }` |
| `PATCH /api/members/:id` | Change a member's wheel color or Slack user ID. Body: `{ "color": "#a1b2c3" }` or `{ "slack_user_id": "U12345ABC" }` |
| `DELETE /api/members/:id` | Remove a member (soft delete, the history stays) |
| `GET /api/standups?limit=30` | Latest standup records |
| `POST /api/standups` | Save the leader for a date. Body: `{ "date": "YYYY-MM-DD", "member_id": 1 }` |
| `DELETE /api/standups/:date` | Delete the record for a date |

### Database

- `members`: `id`, `name`, `active`, `created_at`, `color` (hex, for example `#e8380d`), `slack_user_id` (optional, for @mentions in Slack)
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

## Slack Integration

When configured, the wheel automatically posts a message to Slack whenever a new leader is selected. The message includes the member's name, the date they're selected for, and @mentions them if their Slack user ID is mapped.

### Setup

#### 1. Create a Slack App

1. Go to <https://api.slack.com/apps>
2. Click **Create New App** → **From scratch**
3. App name: `Standup Wheel` (or your preferred name)
4. Select your workspace
5. Click **Create App**

#### 2. Enable Incoming Webhooks

1. In your app settings, go to **Incoming Webhooks**
2. Toggle **Activate Incoming Webhooks** to **On**
3. Click **Add New Webhook to Workspace**
4. Select the channel where you want standup notifications (e.g., `#standups` or `#engineering`)
5. Click **Allow**
6. Copy the **Webhook URL** (it looks like `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`)

#### 3. Configure the Webhook URL

Add the webhook URL to your deployment environment:

**For Gizmos:**

- In the Gizmos hub, go to the `eww-standup-wheel` app settings
- Add an environment variable: `SLACK_WEBHOOK_URL` with your webhook URL
- Redeploy the app

**For local development:**

- Create a `.env.local` file in the project root. It's already git-ignored.

```sh
SLACK_WEBHOOK_URL="your-webhook-url-here"
```

- Run `npx wrangler dev`. Wrangler loads `.env.local` automatically. If your Wrangler version doesn't, name the file `.dev.vars` instead (also git-ignored).

**Important:** Never put the webhook URL in `wrangler.toml` or any other committed file. Anyone with the URL can post to the channel. Use `.env.local` locally and the Gizmos environment variable in production.

#### 4. (Optional) Map Slack User IDs for @mentions

To have team members @mentioned in Slack when selected:

1. Find each member's Slack user ID:
   - Right-click their name in Slack → **View member details** → copy the User ID (looks like `U12345ABC`)
   - Or ask your Slack admin for the ID

2. Set the `slack_user_id` for each member via the API:

```bash
curl -X PATCH https://eww-standup-wheel.telus.gizmos.run/api/members/1 \
  -H "Content-Type: application/json" \
  -d '{ "slack_user_id": "U12345ABC" }'
```

Replace `1` with the member's ID from `GET /api/members` and `U12345ABC` with their actual Slack user ID.

3. Members without a `slack_user_id` will still be mentioned by name in the Slack message.

### Message Format

- **With Slack user ID:** `🎯 <@U12345ABC> leads standup on Mon, Nov 10`
- **Without Slack user ID:** `🎯 John Doe leads standup on Mon, Nov 10`

If the webhook URL is not configured, the wheel works normally with no Slack notifications.
