# Deploy checklist (do in this order)

Deadline: **Sun 22 Nov, 11:59 PM IST**. Aim to be live with real players by Sat evening.

## 1. Accounts you create yourself (free, no card)
- [ ] Nexconn Console app → copy **App Key** + **App Secret** (Key Management) and note the **data center**.
- [ ] Upstash Redis (free) → copy REST URL + token. Needed so state survives on Vercel.
- [ ] Anthropic API key (optional, enables the real AI designer + "Catch me up").
- [ ] Vercel account + GitHub repo.

## 2. Local verification (5 minutes)
```bash
cp .env.example .env.local      # fill in the values; NEVER commit this file
npm run verify:nexconn          # must print all green ticks
npm test                        # 9 tests
npm run build
npm run dev                     # open NEON DISTRICT in two windows, chat between them
```
If `verify:nexconn` fails, the usual cause is the wrong data center: set `NEXCONN_API_HOST` and `NEXT_PUBLIC_NEXCONN_AREA` to match the region you picked in the console (SG/NA).

## 3. Vercel
1. Import the GitHub repo.
2. Add env vars: `NEXT_PUBLIC_NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`, `NEXT_PUBLIC_NEXCONN_AREA`, `NEXCONN_API_HOST`, `IDENTITY_SECRET` (long random string, keep it stable; `openssl rand -base64 32`), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ANTHROPIC_API_KEY`.
3. Deploy, then open `/api/health`: `nexconn` must be `true` and `persistence` must be `redis`.
4. Open the live URL in two browsers and complete NEON DISTRICT stage 1 end to end.

## 4. Never commit secrets
`.env*` is git-ignored (except `.env.example`). The App Secret is only used in `src/lib/nexconn-server.ts` on the server. The App Key is public by design and goes in the write-up.
