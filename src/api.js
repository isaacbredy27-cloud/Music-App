const ACCESS_KEY = "waveform.accessCode";

export const getAccessCode = () => {
  try { return localStorage.getItem(ACCESS_KEY) || ""; } catch { return ""; }
};
export const setAccessCode = (code) => {
  try { localStorage.setItem(ACCESS_KEY, code); } catch {}
};

export class ApiError extends Error {
  constructor(msg, code, extra = {}) {
    super(msg);
    this.code = code;
    Object.assign(this, extra);
  }
}

const FRIENDLY = {
  401: "Unauthorized — check the API key / access code.",
  405: "Rate limit exceeded. Try again in a moment.",
  413: "Prompt or lyrics are too long.",
  429: "Out of Suno credits. Top up your sunoapi.org account.",
  430: "Too many requests — slow down and try again shortly.",
  455: "Suno API is under maintenance. Try again later.",
};

async function request(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-access-code": getAccessCode(),
      ...(options.headers || {}),
    },
  });
  let data;
  try { data = await res.json(); } catch { data = { code: res.status, msg: "Unexpected server response" }; }
  if (!res.ok || data.code !== 200) {
    const code = data.code || res.status;
    throw new ApiError(data.msg && data.msg !== "success" ? data.msg : FRIENDLY[code] || "Request failed", code, {
      needsAccessCode: !!data.needsAccessCode,
    });
  }
  return data.data;
}

export const api = {
  ping: () => request("config"),
  credits: () => request("credits"),
  generate: (body) => request("generate", { method: "POST", body: JSON.stringify(body) }),
  status: (taskId) => request(`status?taskId=${encodeURIComponent(taskId)}`),
  lyrics: (prompt) => request("lyrics", { method: "POST", body: JSON.stringify({ prompt }) }),
  lyricsStatus: (taskId) => request(`lyrics-status?taskId=${encodeURIComponent(taskId)}`),
};

// Normalise a Suno track (record-info uses snake_case, callbacks use camelCase).
export function normaliseTrack(t, taskId) {
  return {
    id: t.id,
    taskId,
    title: t.title || "Untitled",
    tags: t.tags || "",
    image: t.image_url || t.imageUrl || t.source_image_url || t.sourceImageUrl || "",
    audio: t.audio_url || t.audioUrl || t.source_audio_url || t.sourceAudioUrl || "",
    stream: t.stream_audio_url || t.streamAudioUrl || t.source_stream_audio_url || t.sourceStreamAudioUrl || "",
    duration: t.duration || 0,
    lyrics: t.prompt || "",
    model: t.model_name || t.modelName || "",
    createdAt: t.createTime || "",
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
