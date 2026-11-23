# AI in the Admin: two modes

Every AI button in the Admin (Culture fill, CSV import, questions, character design) calls one function, `sample.json(prompt)`. Which "sample" the page gets decides the mode:

```js
sample = ME.isAdmin ? (ME.ai ? sampleBridge : manualBridge) : null
```

`ME.ai` is true when the server has `ANTHROPIC_API_KEY` set (see `app/api/me`).

| | Mode A: Claude API (paid) | Mode B: copy / paste (free, current) |
|---|---|---|
| When | `ANTHROPIC_API_KEY` is set on Vercel | no key |
| Bridge | `sampleBridge` → `POST /api/admin/ai` → Claude (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`) | `manualBridge`: dialog → admin copies the prompt into ChatGPT / Claude / Gemini → pastes the answer |
| Admin effort | one click | copy, ask, paste (per call) |
| Cost | pay per use, about $0.01 per Culture fill, about $0.05 per character (estimate) | free |

Both modes use the same prompts and the same answer checks, so results look the same.

## Going back to the API (Mode A)

The API code was never removed. To switch:

1. console.anthropic.com → Billing (add credit) → Limits (set a monthly spend limit, e.g. $5) → API Keys → Create Key.
2. Vercel → project `smileculturetest-app` → Settings → Environment Variables → add `ANTHROPIC_API_KEY` (Production and Preview). Optional: `ANTHROPIC_MODEL`.
3. Redeploy (`npx vercel@latest --prod --yes`).

The buttons switch to one-click on their own. Removing the key switches back to Mode B.

## History

- `e548810` (tag `ai-api-only`): last version with API-only AI. Without a key every AI button was hidden.
- `f184dfc`: added Mode B (copy / paste) as the fallback when there is no key. After a Culture fill, a "go to step 2" link leads to the Characters tab, where its AI buttons design the character.
