# brutemedia-api

Cloudflare Workers API for the [Brute Media](https://brutemedia.xyz) website audit intake.

## Endpoint

### `POST /audit`

Accepts a JSON body, validates the Instagram handle, saves a lead to Airtable, and notifies Slack.

**Request body**

```json
{
  "handle": "@yourhandle",
  "source": "website"
}
```

- `handle` (required) — Instagram handle. May be submitted with or without `@`. Validated against `^@[A-Za-z0-9._]{1,30}$`.
- `source` (optional) — defaults to `"website"`.

**Responses**

| Status | Body |
|--------|------|
| 200 | `{ "ok": true }` |
| 400 | `{ "ok": false, "error": "..." }` |
| 502 | `{ "ok": false, "error": "..." }` |

**CORS**

The endpoint allows cross-origin requests from any origin (`Access-Control-Allow-Origin: *`). To restrict to your domain, change the value of `CORS_HEADERS["Access-Control-Allow-Origin"]` in `src/index.ts` to your specific origin (e.g. `https://brutemedia.xyz`).

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v3

### 1. Install dependencies

```bash
npm install
```

### 2. Configure local dev vars

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars and fill in your real values:
#   AIRTABLE_API_KEY
#   AIRTABLE_BASE_ID
#   SLACK_WEBHOOK_URL
```

> `.dev.vars` is git-ignored and never committed.

### 3. Run locally

```bash
npm run dev
```

The worker starts at `http://localhost:8787`.

Test it:

```bash
curl -i -X POST http://localhost:8787/audit \
  -H "Content-Type: application/json" \
  -d '{"source":"website","handle":"testhandle"}'
```

Expected response:

```json
{ "ok": true }
```

---

## Deployment (Cloudflare Workers)

### 1. Log in to Cloudflare

```bash
npx wrangler login
```

### 2. Set secrets

Run each command and paste the value when prompted:

```bash
npx wrangler secret put AIRTABLE_API_KEY
npx wrangler secret put AIRTABLE_BASE_ID
npx wrangler secret put SLACK_WEBHOOK_URL
```

### 3. Deploy

```bash
npm run deploy
```

After a successful deploy you will see a URL like:

```
https://brutemedia-api.<your-subdomain>.workers.dev
```

### 4. Test the deployed endpoint

```bash
curl -i -X POST https://brutemedia-api.<your-subdomain>.workers.dev/audit \
  -H "Content-Type: application/json" \
  -d '{"source":"website","handle":"@testhandle"}'
```

Expected:
- HTTP 200 with `{ "ok": true }`
- New row in your Airtable **Leads** table
- Slack message in `#leads`

---

## Airtable setup

Create a base (e.g. **Brute Media CRM**) with a table named exactly **Leads** and the following fields:

| Field name | Field type |
|---|---|
| Instagram Handle | Single line text |
| Source | Single line text |
| Status | Single line text |
| Created At | Single line text |

Create a **Personal Access Token** at <https://airtable.com/create/tokens> with `data.records:write` scope for your base, and use it as `AIRTABLE_API_KEY`. Copy the base ID (starts with `app…`) as `AIRTABLE_BASE_ID`.

---

## Slack setup

1. Create a Slack channel `#leads`.
2. Create an **Incoming Webhook** at <https://api.slack.com/messaging/webhooks> pointed at `#leads`.
3. Use the webhook URL as `SLACK_WEBHOOK_URL`.

---

## Pointing your custom domain (optional)

If you want `https://api.brutemedia.xyz/audit` to route to this worker:

1. Add `api.brutemedia.xyz` to Cloudflare DNS (proxied).
2. In the Cloudflare dashboard → Workers & Pages → your worker → **Triggers / Custom Domains**, add `api.brutemedia.xyz`.
