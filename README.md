# DialectWeb — 方言對話 · Dialect Dialogue

A bilingual dialect chatbot web app. Speak to it in your dialect (Cantonese,
Mandarin, Hakka, Teochew, Hokkien, or English); it transcribes your speech with
Tencent Cloud ASR, answers with **your own AI model** (DeepSeek, OpenAI, OpenRouter,
or any OpenAI-compatible service), and reads the reply aloud with Tencent Cloud TTS.

Built **elder-first**: large fonts, high contrast, big touch targets, a dark
theme, and a simple single-screen interface.

## Features

- 🎙 **Real-time speech recognition** (Tencent Cloud real-time ASR v2, WebSocket)
  with per-dialect Tencent engines. The multilingual `16k_zh_en_2.0` engine
  can be selected for Hakka, Teochew, Hokkien, and broader dialect detection.
- 💬 **Chat with your own AI model** — paste your API key in Settings (DeepSeek,
  OpenAI, OpenRouter, or any OpenAI-compatible service). No built-in LLM server.
- 🔊 **Text-to-speech** with Tencent Cloud TTS (Cantonese voice `101019`).
- 🌙 **Light / dark theme** toggle (persisted).
- 🔠 **Adjustable font size**; on phones the smallest size is the default.
- 💾 **Multiple conversation histories** (sidebar).
- 🌐 **UI in 繁體中文 / English**.
- 🔗 **Easy temporary public sharing** via Tailscale Funnel.

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite 5, Zustand (state) |
| Backend  | Node.js (built-in `http` + `ws`), no framework |
| ASR      | Tencent Cloud real-time ASR (WebSocket v2) |
| TTS      | Tencent Cloud `TextToVoice` HTTP API |
| LLM      | **User-provided** OpenAI-compatible API (DeepSeek, OpenAI, OpenRouter, etc.) |

## Prerequisites

- **Node.js 18+**
- A **Tencent Cloud** account with **ASR** and **TTS** enabled, and API
  credentials (`SecretId` / `SecretKey` / `AppId`) from the CAM console.
- **Your own AI API key** (DeepSeek, OpenAI, OpenRouter, or any OpenAI-compatible service).
  Enter it in the app's Settings panel.

## Getting Started

```bash
git clone <your-repo-url>
cd DialectWeb
npm install
cp .env.example .env      # then edit .env and fill in your Tencent credentials
npm run dev:full          # starts the Node backend (:3001) + Vite dev server (:5173)
```

Open <http://localhost:5173> in your browser.

> `npm run dev:full` runs both the backend and the frontend. You can also run
> them separately: `npm run server` (backend) and `npm run dev` (frontend).

### Production run

Build the frontend, then let the Node server serve the generated `dist/` files
and API on one port:

```bash
npm run build
npm run server
```

Open <http://localhost:3001>. Set the production environment variables on your
hosting provider instead of uploading `.env`.

## Configuration

Copy `.env.example` to `.env` and set the following variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TENCENT_APPID` | yes (ASR) | — | Tencent Cloud AppId. |
| `TENCENT_SECRET_ID` | yes | — | CAM SecretId (used for **both** ASR and TTS). |
| `TENCENT_SECRET_KEY` | yes | — | CAM SecretKey (used for **both** ASR and TTS). |
| `TENCENT_ENGINE` | no | `16k_zh_en_2.0` | ASR engine model type. Overrides the per-dialect default for all dialects. |
| `TENCENT_HOTWORDS` | no | — | Temporary hotword list to improve dialect accuracy (`詞|權重,詞|權重`). |
| `TENCENT_SENTENCE_STRATEGY` | no | `0` | `0` = finalize each sentence as it settles; `1` = paragraph segmentation. |
| `TENCENT_DOMAIN` | no | — | Domain optimization (`1` tech / `2` movie / `3` song). |
| `TENCENT_TTS_REGION` | no | `ap-hongkong` | Region for the TTS API. |
| `TENCENT_ASR_HOST` | no | `asr.cloud.tencent.com` | Host for ASR. Both the WebSocket URL and the request signature use this host. Tencent has no regional ASR host, so this stays global. |
| `PORT` | no | `3001` | Backend HTTP/WebSocket port. |

> ⚠️ Never commit your real `.env`. It is git-ignored.

## How it works

```
Browser ──► Vite dev server (:5173) ──► proxies /api/* ──► Node backend (:3001)
                │                                  │
                │                                  ├── ASR  ──► Tencent Cloud (WebSocket)
                │                                  ├── LLM  ──► Your API (DeepSeek, OpenAI, etc.)
                │                                  └── TTS  ──► Tencent Cloud (HTTPS)
```

- The browser records audio and streams it to the Node backend, which relays it
  to Tencent's real-time ASR WebSocket and streams recognized text back.
- Chat messages are sent to **your API key** (configured in Settings).
- When you tap 🔊 on an assistant message, the backend calls Tencent TTS and
  returns a `data:audio/mp3;base64,...` URL that the browser plays.

## ASR engine

Unless `TENCENT_ENGINE` is set, the backend selects an engine by the requested
dialect: `16k_yue` for Cantonese, `16k_zh` for Mandarin, and
`16k_zh_en_2.0` for Hakka, Teochew, and Hokkien. You can force one engine for
all dialects with `TENCENT_ENGINE`—for example, set `16k_zh_en_2.0` for broader
dialect detection, `16k_yue` for Cantonese-only, or `16k_zh` for Mandarin.

> Note: `16k_zh_en_2.0` must be enabled / supported for your Tencent account.
> If ASR fails with an engine error, switch `TENCENT_ENGINE` to a supported
> engine.

## Text-to-speech

TTS uses the **Cantonese** voice (`VoiceType 101019`). Until dedicated voices
are configured, replies in other dialects use this Cantonese voice as a
fallback. The same Tencent credentials (`TENCENT_SECRET_ID` /
`TENCENT_SECRET_KEY`) are reused for TTS.

## Bring your own AI model (required)

**There is no built-in LLM server.** You must provide your own API key:

1. Open **Settings** (⚙️ in the toolbar).
2. In the **Bring your own AI model** section, enter:
   - **API Key** (required) — e.g. a DeepSeek, OpenAI, OpenRouter, or any
     OpenAI-compatible key.
   - **Base URL** (optional) — defaults to `https://api.openai.com/v1`. Set
     this for providers like DeepSeek (`https://api.deepseek.com/v1`) or
     OpenRouter (`https://openrouter.ai/api/v1`).
   - **Model name** (optional) — defaults to `gpt-4o-mini`; required for
     non-OpenAI providers (e.g. `deepseek-chat`).
3. Send a message — the chat is routed through your key.

> 🔒 **Privacy**: the key is stored only in the browser's `localStorage` (per
> device) and sent to the backend with each chat request; the backend forwards
> it to the provider and does not log it. It is **not** shared with the server's
> `.env` or with other users.

### Quick examples

| Provider | Base URL | Model |
|----------|----------|-------|
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` (or any) |
| **OpenAI** | (leave empty) | `gpt-4o-mini` |

## Dark mode & accessibility

- 🌙 A light/dark theme toggle is in the top toolbar; the choice is persisted.
- 🔠 Font size is adjustable; on phones the **smallest** size is the default.
- The UI uses large touch targets (≥48px) and high-contrast colors.

## Sharing publicly (Tailscale Funnel)

To temporarily expose the site over HTTPS to anyone:

```bash
npm run dev:full                 # or: npm run dev (frontend) + npm run server (backend)
tailscale funnel --bg 5173      # exposes https://<your-machine>.<tailnet>.ts.net/
```

- `vite.config.js` already sets `server.host: true` and `allowedHosts: true`,
  so the Funnel hostname is accepted.
- If you run Vite on a different port, use that port (e.g. `tailscale funnel --bg 5174`).
- Stop sharing with `tailscale funnel --off`.

> Funnel makes the site publicly reachable by anyone with the link — turn it off
> when you're done.

## Project structure

```
DialectWeb/
├── index.html
├── vite.config.js
├── .env.example
├── server/                 # Node backend
│   ├── index.mjs           # HTTP + WebSocket relay, /api routes
│   ├── asr.mjs             # Tencent real-time ASR client (TC3 signing)
│   ├── tts.mjs             # Tencent TTS client (TC3 signing)
│   ├── llm.mjs             # OpenAI-compatible LLM client (no built-in server)
│   └── env.mjs             # loads .env
└── src/                    # React frontend
    ├── main.jsx
    ├── index.css           # design system + dark theme
    ├── store.js            # Zustand store (dialect, theme, font, conversations, user API key)
    ├── i18n.js             # 繁體中文 / English strings
    ├── services/api.js     # frontend API calls
    ├── audio/              # recorder, stream, speaker
    └── components/         # App, ChatWindow, Composer, Sidebar, SettingsModal, ...
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server only (frontend, :5173). |
| `npm run server` | Node backend only (:3001). |
| `npm run dev:full` | Backend + frontend together. |
| `npm run build` | Production build (Vite). |
| `npm run preview` | Preview the production build. |
| `npm run test:asr` | Run `server/test-asr.mjs` ASR test. |

## Notes & caveats

- The UI currently **defaults to Cantonese** (the in-app dialect selector was
  intentionally removed); the LLM prompt and TTS voice follow that default
  dialect. The ASR engine still auto-detects whatever dialect is spoken.
- **Chat requires a user-supplied API key** (set in Settings → "Bring your own AI model").
  Without it, sending a message falls back to a demo reply. ASR and TTS still work if Tencent
  credentials are set.
- TTS region defaults to `ap-hongkong` (`TENCENT_TTS_REGION`). ASR has **no**
  regional endpoint, so it uses the global host `asr.cloud.tencent.com`
  (`TENCENT_ASR_HOST`); both are configurable via `.env`.

## License

MIT. Add a `LICENSE` file when you publish.
