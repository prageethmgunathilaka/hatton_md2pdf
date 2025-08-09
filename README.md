# Markdown to PDF Service

A small Fastify service that converts Markdown (file upload or pasted text) to PDF using Puppeteer. Includes a minimal frontend.

## Prerequisites
- Node.js 18+ (recommended 20+)

## Setup

```powershell
cd server
npm install
```

This will also download a compatible Chromium for Puppeteer.

## Run

```powershell
npm run dev
```

Open `http://localhost:3000` and use the UI to upload a `.md` file or paste Markdown text, then download the generated PDF.

### API
- `POST /convert`
  - Content-Types:
    - `multipart/form-data` with fields:
      - `file`: Markdown file (.md, .txt, ...)
      - or `text`: Markdown string
      - optional `filename`: output file base name
      - optional `format`: one of `A4`, `Letter`, `Legal`, `A3`
    - `application/json` with body `{ "markdown": "...", "filename": "...", "format": "A4" }`
  - Response: `application/pdf` (download)

- `GET /health` → `{ status: "ok" }`

## Notes
- Max upload/body size is 100MB by default. You can adjust in `src/index.js`.
- The server launches a single headless Chromium instance and reuses it for conversions.
- The frontend is served from `server/public` by the same server (no CORS hassle). 

## License

This project is licensed under the GPL-3.0-or-later license.
See the `LICENSE` file for full text or visit https://www.gnu.org/licenses/gpl-3.0.en.html. 