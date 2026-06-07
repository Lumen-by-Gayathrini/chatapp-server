# Deployment Runbook — ChatApp Server (Vercel + Atlas + Blob)

> **Scope:** Phase 9 of [Implementation-Plan-ChatApp-Server.md](Implementation-Plan-ChatApp-Server.md).
> Executes [TDD §14](TDD-ChatApp-Server.md). The codebase is already deploy-ready:
> `vercel.json` (the `/api/(.*)` rewrite), `api/index.ts` (serverless entry), the cached
> Mongoose connection (`src/lib/db.ts`), and the production env guards (`src/config/env.ts`).
> Run these steps when you have the cloud accounts; **none of this can be done from CI/offline.**

---

## 0. Prerequisites

- A [Vercel](https://vercel.com) account and the CLI: `npm i -g vercel` (then `vercel login`).
- A [MongoDB Atlas](https://cloud.mongodb.com) account (free M0 tier is fine for the study).
- `git` remote for `chatapp-server` (or deploy from the local dir with `vercel`).
- `node` ≥ 20 locally (matches the Vercel runtime; pinned via `engines` in `package.json`).
- For the smoke test: `curl` + [`jq`](https://jqlang.github.io/jq/) (bash), or PowerShell 5.1+ (Windows).

---

## 1. MongoDB Atlas

1. **Create a cluster** → *Create* → **M0** (shared/free) → pick a region near your users.
2. **Database user** → *Database Access* → *Add New Database User* → username/password auth.
   Save the password; you'll embed it in the URI.
3. **Network access** → *Network Access* → *Add IP Address* → **`0.0.0.0/0`**
   (Vercel's serverless egress IPs are dynamic; for a lab study allow-all is acceptable).
4. **Connection string** → *Clusters* → *Connect* → *Drivers* → copy the URI and fill in the
   password and a database name, e.g.:

   ```
   mongodb+srv://chatapp:<PASSWORD>@cluster0.xxxxx.mongodb.net/chatapp?retryWrites=true&w=majority
   ```

   This is your **`MONGODB_URI`**.

---

## 2. Vercel Blob (media storage)

1. In the Vercel dashboard → *Storage* → *Create* → **Blob** → create a store.
2. Connect it to the `chatapp-server` project (or copy the token from the store's settings).
3. Copy the **`BLOB_READ_WRITE_TOKEN`** (`vercel_blob_rw_…`).

> The storage adapter (`src/lib/storage.ts`) auto-selects Vercel Blob when this token is
> present, and falls back to the local fake otherwise — so leaving it unset keeps dev/tests
> offline.

---

## 3. Generate strong JWT secrets

The server **refuses to boot in production** with the dev-default secrets. Generate two:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_REFRESH_SECRET
```

---

## 4. Import the project + set environment variables

**Import:** Vercel dashboard → *Add New… → Project* → import the `chatapp-server` repo.
Framework preset: **Other**. Build/Output settings can stay default (the `/api/(.*)` rewrite in
`vercel.json` routes every request to `api/index.ts`; no build output dir is required).

**Environment variables** (*Project → Settings → Environment Variables*) — set for **Production**
(and Preview if you use it). Full list per TDD §12.5:

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | enables the secret guard + HSTS |
| `MONGODB_URI` | *(Step 1)* | **required in prod** |
| `JWT_ACCESS_SECRET` | *(Step 3)* | must not be the dev default |
| `JWT_REFRESH_SECRET` | *(Step 3)* | must not be the dev default |
| `ACCESS_TTL` | `15m` | access-token lifetime |
| `REFRESH_TTL` | `30d` | refresh-token lifetime |
| `BLOB_READ_WRITE_TOKEN` | *(Step 2)* | enables real media uploads |
| `MAX_UPLOAD_BYTES` | `5242880` | 5 MB media cap |
| `CORS_PORTAL_ORIGIN` | e.g. `https://portal.example.com` | the web-portal origin |
| `LOG_LEVEL` | `info` | pino level |
| `UPSTASH_REDIS_URL` | *(optional)* | shared rate-limit store (multi-instance) |

> **Secrets hygiene (TDD §16):** never commit these; use separate values for Preview vs
> Production; rotate the JWT secrets if leaked (invalidates all live tokens).

---

## 5. Deploy

From the project directory (or let the Git integration deploy on push):

```bash
vercel --prod
```

Confirm the function is live (no DB needed for liveness):

```bash
curl -s https://<your-deployment>.vercel.app/api/v1/healthz
# → {"status":"ok","time":"…"}
```

---

## 6. Seed the first researcher account

`seed:admin` is idempotent and reads `MONGODB_URI` + optional `SEED_ADMIN_*`. Run it **locally,
pointed at the production DB** (one-off):

```bash
# bash
MONGODB_URI="<your Atlas URI>" \
SEED_ADMIN_EMAIL="researcher@yourlab.org" \
SEED_ADMIN_PASSWORD="<a strong password>" \
SEED_ADMIN_NAME="Researcher" \
npm run seed:admin
```

```powershell
# PowerShell
$env:MONGODB_URI="<your Atlas URI>"
$env:SEED_ADMIN_EMAIL="researcher@yourlab.org"
$env:SEED_ADMIN_PASSWORD="<a strong password>"
$env:SEED_ADMIN_NAME="Researcher"
npm run seed:admin
```

Expected: `Created admin: researcher@yourlab.org` (or `Already exists: …` on re-run).

---

## 7. Smoke test (against the live URL)

Exercises the full study path: participant auth → conversation → **researcher simulation** →
participant poll receives it. Set `BASE` to your deployment and the admin creds from Step 6.

### bash (`curl` + `jq`)

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="https://<your-deployment>.vercel.app/api/v1"
ADMIN_EMAIL="researcher@yourlab.org"
ADMIN_PASSWORD="<a strong password>"
SUFFIX="$(date +%s)"

echo "1. healthz";      curl -fs "$BASE/healthz" | jq -e '.status=="ok"' >/dev/null

echo "2. register Mary"
MARY=$(curl -fs -X POST "$BASE/auth/register" -H 'content-type: application/json' \
  -d "{\"username\":\"mary_$SUFFIX\",\"password\":\"secret1\",\"displayName\":\"Mary\"}")
MARY_TOKEN=$(echo "$MARY" | jq -r .accessToken); MARY_ID=$(echo "$MARY" | jq -r .user.id)

echo "3. register John"
JOHN=$(curl -fs -X POST "$BASE/auth/register" -H 'content-type: application/json' \
  -d "{\"username\":\"john_$SUFFIX\",\"password\":\"secret1\",\"displayName\":\"John\"}")
JOHN_ID=$(echo "$JOHN" | jq -r .user.id)

echo "4. Mary creates a conversation with John"
CONV=$(curl -fs -X POST "$BASE/conversations" -H "authorization: Bearer $MARY_TOKEN" \
  -H 'content-type: application/json' -d "{\"peerUserId\":\"$JOHN_ID\"}")
CONV_ID=$(echo "$CONV" | jq -r .id)

echo "5. admin login"
ADMIN=$(curl -fs -X POST "$BASE/admin/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo "$ADMIN" | jq -r .accessToken)

echo "6. researcher simulates a message AS John"
curl -fs -X POST "$BASE/admin/conversations/$CONV_ID/messages" \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d "{\"asUserId\":\"$JOHN_ID\",\"type\":\"TEXT\",\"text\":\"Hello Mary\"}" \
  | jq -e '.senderId=="'"$JOHN_ID"'"' >/dev/null

echo "7. Mary polls and receives it"
curl -fs "$BASE/conversations/$CONV_ID/messages?since=1970-01-01T00:00:00.000Z" \
  -H "authorization: Bearer $MARY_TOKEN" \
  | jq -e '.messages[0].text=="Hello Mary"' >/dev/null

echo "8. Mary sends her own message"
curl -fs -X POST "$BASE/conversations/$CONV_ID/messages" \
  -H "authorization: Bearer $MARY_TOKEN" -H 'content-type: application/json' \
  -d "{\"clientId\":\"smoke-$SUFFIX\",\"type\":\"TEXT\",\"text\":\"Hi John\"}" >/dev/null

echo "9. sync reflects the thread"
curl -fs "$BASE/sync" -H "authorization: Bearer $MARY_TOKEN" \
  | jq -e '.conversations|length>=1' >/dev/null

echo "✅ Smoke test passed"
```

### PowerShell (`Invoke-RestMethod`)

```powershell
$BASE = "https://<your-deployment>.vercel.app/api/v1"
$ADMIN_EMAIL = "researcher@yourlab.org"
$ADMIN_PASSWORD = "<a strong password>"
$S = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Invoke-RestMethod "$BASE/healthz" | Out-Null
$mary = Invoke-RestMethod "$BASE/auth/register" -Method Post -ContentType application/json `
  -Body (@{ username="mary_$S"; password="secret1"; displayName="Mary" } | ConvertTo-Json)
$john = Invoke-RestMethod "$BASE/auth/register" -Method Post -ContentType application/json `
  -Body (@{ username="john_$S"; password="secret1"; displayName="John" } | ConvertTo-Json)
$mh = @{ authorization = "Bearer $($mary.accessToken)" }

$conv = Invoke-RestMethod "$BASE/conversations" -Method Post -Headers $mh -ContentType application/json `
  -Body (@{ peerUserId = $john.user.id } | ConvertTo-Json)

$admin = Invoke-RestMethod "$BASE/admin/auth/login" -Method Post -ContentType application/json `
  -Body (@{ email=$ADMIN_EMAIL; password=$ADMIN_PASSWORD } | ConvertTo-Json)
$ah = @{ authorization = "Bearer $($admin.accessToken)" }

$sim = Invoke-RestMethod "$BASE/admin/conversations/$($conv.id)/messages" -Method Post -Headers $ah `
  -ContentType application/json -Body (@{ asUserId=$john.user.id; type="TEXT"; text="Hello Mary" } | ConvertTo-Json)
if ($sim.senderId -ne $john.user.id) { throw "simulation senderId mismatch" }

$poll = Invoke-RestMethod "$BASE/conversations/$($conv.id)/messages?since=1970-01-01T00:00:00.000Z" -Headers $mh
if ($poll.messages[0].text -ne "Hello Mary") { throw "poll did not receive simulated message" }

Write-Host "✅ Smoke test passed"
```

---

## 8. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Boot error: *"Refusing to start … default JWT secrets"* | Set real `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (Step 3). |
| Boot error: *"MONGODB_URI is required in production"* | Set `MONGODB_URI`; ensure `NODE_ENV=production`. |
| `500` on first DB-backed call, `healthz` OK | Atlas network access not open to `0.0.0.0/0`, or wrong password in the URI. |
| Intermittent timeouts after idle | Serverless **cold start** (TDD §16) — acceptable for the study; optional warm-up ping during sessions. |
| Media upload `500`/missing `url` | `BLOB_READ_WRITE_TOKEN` not set or store not connected. |
| Rate limiting feels off across requests | In-memory limiter is per warm instance; set `UPSTASH_REDIS_URL` for a shared store (TDD §9.3). |
| CORS errors from the portal | `CORS_PORTAL_ORIGIN` must exactly match the portal's scheme+host (+port). |

---

## 9. Post-deploy checklist

- [ ] `GET /api/v1/healthz` → `200`.
- [ ] All §12.5 env vars set for Production (and Preview if used).
- [ ] `seed:admin` run against the prod DB; admin can log in.
- [ ] Smoke test (Step 7) passes end-to-end, **including simulation → participant poll**.
- [ ] Atlas IP access + DB user verified; connection string secret not committed.
- [ ] Vercel Blob store connected; an `IMAGE` message returns a working `mediaUrl`.
- [ ] Point the mobile app's `API_BASE_URL` at `https://<deployment>/api/v1/` (app Phase 9).
