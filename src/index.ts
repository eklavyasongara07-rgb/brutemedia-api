export interface Env {
  AIRTABLE_API_KEY: string;
  AIRTABLE_BASE_ID: string;
  SLACK_WEBHOOK_URL: string;
}

interface AuditRequestBody {
  handle?: string;
  source?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function normalizeHandle(raw: string): { handle: string } | { error: string } {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { error: "handle is required" };
  }

  if (/\s/.test(trimmed)) {
    return { error: "handle must not contain whitespace" };
  }

  if (trimmed.includes("/") || trimmed.includes("http") || trimmed.includes("://")) {
    return { error: "handle must not be a URL" };
  }

  const withAt = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;

  // Conservative regex as specified: allows letters, digits, dots, underscores (1–30 chars after @)
  if (!/^@[A-Za-z0-9._]{1,30}$/.test(withAt)) {
    return { error: "handle must be a valid Instagram handle (letters, numbers, . and _ only, max 30 chars)" };
  }

  return { handle: withAt };
}

async function postToAirtable(env: Env, handle: string, source: string, timestamp: string): Promise<void> {
  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Leads`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        "Instagram Handle": handle,
        Source: source,
        Status: "Audit Requested",
        "Created At": timestamp,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtable error ${response.status}: ${text}`);
  }
}

async function postToSlack(env: Env, handle: string, source: string, timestamp: string): Promise<void> {
  const text = `New audit request: ${handle} (source: ${source}) — ${timestamp}`;
  const response = await fetch(env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Slack error ${response.status}: ${responseText}`);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/audit" && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/audit" && request.method === "POST") {
      let body: AuditRequestBody;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "invalid JSON body" }, 400);
      }

      const rawHandle = typeof body.handle === "string" ? body.handle : "";
      const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "website";

      const result = normalizeHandle(rawHandle);
      if ("error" in result) {
        return json({ ok: false, error: result.error }, 400);
      }

      const { handle } = result;
      const timestamp = new Date().toISOString();

      try {
        await postToAirtable(env, handle, source, timestamp);
      } catch (err) {
        console.error("Airtable error:", err);
        return json({ ok: false, error: "failed to save audit request" }, 502);
      }

      try {
        await postToSlack(env, handle, source, timestamp);
      } catch (err) {
        console.error("Slack error:", err);
        // Non-fatal: audit was saved, just log Slack failure
      }

      return json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  },
};
