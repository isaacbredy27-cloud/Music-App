// Single Netlify Function that proxies the browser to Suno API.
// The Suno API key lives ONLY in the SUNO_API_KEY environment variable
// (set it in Netlify → Site configuration → Environment variables).
// It is never sent to the browser.

const SUNO_BASE = (process.env.SUNO_API_BASE || "https://api.sunoapi.org").replace(/\/$/, "");
const MODELS = new Set(["V6", "V6_WILD", "V6_MINI", "V5_5", "V5", "V4_5PLUS", "V4_5ALL", "V4_5"]);

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function suno(path, init = {}) {
  const key = process.env.SUNO_API_KEY;
  if (!key) {
    return { code: 500, msg: "Server is missing SUNO_API_KEY. Add it in your Netlify environment variables." };
  }
  const res = await fetch(`${SUNO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { code: res.status || 500, msg: text.slice(0, 300) || "Unexpected response from Suno API" };
  }
}

// Suno replies with HTTP 200 + its own `code` field; surface that as the HTTP status.
const relay = (data) => json(data && data.code === 200 ? 200 : 502, data);

function callbackUrl(req) {
  const site = process.env.URL || new URL(req.url).origin;
  return `${site.replace(/\/$/, "")}/api/callback`;
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v, min, max, decimals = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const f = 10 ** decimals;
  return Math.round(Math.min(max, Math.max(min, n)) * f) / f;
};

function buildGenerateBody(input, req) {
  const customMode = !!input.customMode;
  const instrumental = !!input.instrumental;
  const model = MODELS.has(input.model) ? input.model : "V6";
  const body = { customMode, instrumental, model, callBackUrl: callbackUrl(req) };

  const style = str(input.style, 1000);
  const lyrics = instrumental ? "" : str(input.lyrics, 5000);

  if (!customMode) {
    const prompt = str(input.prompt, 3000);
    if (prompt) body.prompt = prompt;
    if (style) body.style = style;
    if (lyrics) body.lyrics = lyrics;
    if (!style && !lyrics) return { error: "Add a style/genre (or lyrics) so Suno knows what to make." };
    return { body };
  }

  const title = str(input.title, 80);
  const negativeTags = str(input.negativeTags, 1000);
  if (title) body.title = title;
  if (style) body.style = style;
  if (lyrics) body.lyrics = lyrics;
  if (negativeTags) body.negativeTags = negativeTags;
  if (!style && !lyrics && !negativeTags) return { error: "Custom mode needs a style, lyrics or exclude-styles." };

  if (input.vocalGender === "m" || input.vocalGender === "f") body.vocalGender = input.vocalGender;
  if (input.duration != null && ["V5_5", "V6", "V6_MINI", "V6_WILD"].includes(model)) {
    const d = num(input.duration, 10, 360, 0);
    if (d !== undefined) body.duration = d;
  }
  const sw = num(input.styleWeight, 0, 1);
  if (sw !== undefined && input.styleWeight !== "" && input.styleWeight != null) body.styleWeight = sw;
  const wc = num(input.weirdnessConstraint, 0, 1);
  if (wc !== undefined && input.weirdnessConstraint !== "" && input.weirdnessConstraint != null) body.weirdnessConstraint = wc;
  const v = num(input.variety, 0, 4, 0);
  if (v !== undefined && input.variety !== "" && input.variety != null) body.variety = v;
  return { body };
}

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/(\.netlify\/functions\/api|api)\/?/, "");

  // Suno posts results here; we poll for status instead, so just acknowledge.
  if (route === "callback") return json(200, { ok: true });

  // Optional shared access code so strangers can't spend your credits.
  const accessCode = process.env.ACCESS_CODE;
  if (accessCode && req.headers.get("x-access-code") !== accessCode) {
    return json(401, { code: 401, msg: "Access code required", needsAccessCode: true });
  }

  try {
    if (route === "config" && req.method === "GET") {
      return json(200, { code: 200, data: { ok: true } });
    }

    if (route === "credits" && req.method === "GET") {
      return relay(await suno("/api/v1/generate/credit"));
    }

    if (route === "generate" && req.method === "POST") {
      const input = await req.json().catch(() => ({}));
      const { body, error } = buildGenerateBody(input, req);
      if (error) return json(400, { code: 400, msg: error });
      return relay(await suno("/api/v1/generate", { method: "POST", body: JSON.stringify(body) }));
    }

    if (route === "status" && req.method === "GET") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) return json(400, { code: 400, msg: "taskId is required" });
      return relay(await suno(`/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`));
    }

    if (route === "lyrics" && req.method === "POST") {
      const input = await req.json().catch(() => ({}));
      const prompt = str(input.prompt, 200);
      if (!prompt) return json(400, { code: 400, msg: "Describe the lyrics you want (max 200 characters)." });
      return relay(
        await suno("/api/v1/lyrics", {
          method: "POST",
          body: JSON.stringify({ prompt, callBackUrl: callbackUrl(req) }),
        })
      );
    }

    if (route === "lyrics-status" && req.method === "GET") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) return json(400, { code: 400, msg: "taskId is required" });
      return relay(await suno(`/api/v1/lyrics/record-info?taskId=${encodeURIComponent(taskId)}`));
    }

    return json(404, { code: 404, msg: "Not found" });
  } catch (err) {
    return json(500, { code: 500, msg: err?.message || "Server error" });
  }
};

export const config = { path: "/api/*" };
