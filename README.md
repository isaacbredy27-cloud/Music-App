# Waveform — AI Music Studio

A web app where users generate songs with [Suno API](https://docs.sunoapi.org/).
React + Vite frontend, with a Netlify Function that keeps your Suno API key on the server.

## Features
- **Simple mode** – describe a song + pick a genre, Suno writes the lyrics.
- **Custom mode** – title, your own lyrics (or ✨ AI-written lyrics), exclude-styles, voice gender, length (10s–6min), style adherence / weirdness / variety.
- Instrumental toggle and V6 / V6 Wild / V6 Mini model picker.
- Live progress (queued → lyrics → first take → done), streaming preview before the final MP3 is ready.
- Library saved in the browser, search, built-in player with lyrics, MP3 download.
- Remaining-credits badge.

## Deploy on Netlify
1. Import this repo in Netlify. Build settings are read from `netlify.toml` (build `npm run build`, publish `dist`).
2. In **Site configuration → Environment variables**, add:
   - `SUNO_API_KEY` = your key from https://sunoapi.org/api-key  **(required)**
   - `ACCESS_CODE` = any passphrase **(optional, recommended)** — visitors must enter it before generating, so strangers can't spend your credits.
3. Deploy (redeploy after changing env vars).

## Local development
```bash
npm install
cp .env.example .env   # fill in SUNO_API_KEY
npx netlify dev        # runs Vite + the /api function together
```

## How it works
`netlify/functions/api.mjs` serves `/api/*`:

| Route | Suno endpoint |
|---|---|
| `POST /api/generate` | `POST /api/v1/generate` |
| `GET /api/status?taskId=` | `GET /api/v1/generate/record-info` |
| `POST /api/lyrics` | `POST /api/v1/lyrics` |
| `GET /api/lyrics-status?taskId=` | `GET /api/v1/lyrics/record-info` |
| `GET /api/credits` | `GET /api/v1/generate/credit` |
| `POST /api/callback` | Suno's required `callBackUrl` (acknowledged; the app polls for status) |

Suno keeps generated files for 14 days, so download anything you want to keep.
