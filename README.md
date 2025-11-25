# IdeaLink Voice Assistant – Frontend

React + Vite UI that captures microphone audio, visualises live volume, and streams chunks to the backend WebSocket bridge.

## Requirements

- Bun (preferred) or Node.js 18+
- Modern browser with microphone permission

## Setup

```bash
cd frontend
bun install
cp env.example .env
```

Update `.env` (or `.env.local`) with:

- `VITE_BACKEND_URL` – HTTP origin of the backend (default `http://localhost:4000`)
- `VITE_BACKEND_WS_URL` – WebSocket endpoint (default `ws://localhost:4000`)

## Scripts

| Command | Description |
| ------- | ----------- |
| `bun run dev` | Start Vite dev server with HMR |
| `bun run build` | Production build to `dist/` |
| `bun run preview` | Serve the built assets locally |
| `bun run lint` | Type-check the codebase |

## Notes

- The app now depends on the backend WebSocket instead of hitting Gemini directly in the browser.
- Microphone access prompts when connecting; handle permission denials gracefully in the UI.

test2
