# AI Sales Roleplay

## Overview

A generative-AI sales training system. Users practice realistic text or voice conversations with an expressive AI customer and receive real-time coaching and a structured post-session report.

## Features

- AI customer conversations powered by a configurable DeepSeek-compatible API
- VRM 3D avatars with lip sync, expressions, and gestures
- Streaming speech recognition with faster-whisper
- Text-to-speech with edge-tts
- Real-time anger, trust, and deal-progress metrics
- AI-generated reply suggestions
- 17 built-in Chinese scenarios and AI-assisted scenario creation
- 12-dimension session reports and searchable session history
- Chinese, English, and Japanese UI

## Technology Stack

**Frontend**

- React 19 + TypeScript
- Material UI 7 and Vite
- three.js + @pixiv/three-vrm
- i18next, Chart.js, Jest, and Playwright

**Local backend**

- FastAPI + Uvicorn
- SQLite
- Configurable DeepSeek-compatible chat and reasoning models
- edge-tts + faster-whisper
- Invite-code authentication with JWT

The `cdk/` directory contains the retired AWS reference implementation. It is not part of the default local runtime.

## Run Locally

### Backend

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Configure DEEPSEEK_API_KEY, LLM_CHAT_MODEL, and LLM_REASONER_MODEL.
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:5173`. For production-oriented Docker deployment, see [部署手册.md](./部署手册.md).

## Project Structure

```text
├── server/       # Active FastAPI + SQLite backend
├── frontend/     # React application
├── cdk/          # Retired AWS reference implementation
├── docs/         # Supporting documentation
├── 部署手册.md    # Local and Docker deployment guide
└── 方案A改造计划.md # Localisation decisions and migration plan
```

## Known Limitations

- Local guardrails currently return a compatibility response rather than using a cloud safety service.
- Local PDF/slide upload and conversion endpoints are not implemented.
- Production deployments must configure a strong `JWT_SECRET` and restrict CORS to the frontend origin.

## License

This project is licensed under the MIT-0 License. See [LICENSE](./LICENSE).
