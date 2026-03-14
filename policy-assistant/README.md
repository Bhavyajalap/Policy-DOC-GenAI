# Policy Assistant

An AI-powered assistant for reading and querying government & legal policy documents. Upload PDFs and ask questions in plain language — powered by Claude.

---

## 🚀 Deploy in 5 minutes (Free)

### Step 1 — Get your free Anthropic API key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up (free — includes $5 in credits)
3. Go to **API Keys** → **Create Key**
4. Copy your key

### Step 2 — Deploy to Vercel (free hosting)

**Option A — One-click deploy:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. During setup, add an **Environment Variable**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (your key from Step 1)
4. Click **Deploy** — done! 🎉

**Option B — Vercel CLI:**
```bash
npm i -g vercel
vercel
# Follow prompts, then add env variable:
vercel env add ANTHROPIC_API_KEY
```

---

## 🛠 Run locally

```bash
# Install dependencies
npm install

# Create your local env file
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# Start dev server
npm run dev
# Open http://localhost:3000
```

---

## 💡 How it works

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | Next.js (React) | Free |
| Hosting | Vercel free tier | Free |
| API proxy | Vercel serverless functions | Free |
| AI model | Claude via Anthropic API | ~$0.003 per query |

**Your API key is never exposed to the browser** — all Claude calls happen server-side via the `/api/chat` route.

---

## 📁 Project structure

```
policy-assistant/
├── pages/
│   ├── index.js          # Main UI
│   └── api/
│       └── chat.js       # Secure Claude API proxy
├── styles/
│   └── globals.css       # Global styles
├── .env.example          # Copy to .env.local for local dev
└── package.json
```

---

## ⚙️ Customising

- **System prompt** — edit `pages/api/chat.js` to change how Claude responds
- **Model** — change `claude-sonnet-4-20250514` to `claude-haiku-4-5-20251001` for faster/cheaper responses
- **Max tokens** — adjust `max_tokens` in `pages/api/chat.js`
- **Branding** — update the title/description in `pages/index.js`
