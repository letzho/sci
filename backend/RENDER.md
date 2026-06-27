# Render deployment (backend Web Service)

## Settings

| Field | Value |
|-------|--------|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `node server.js` |

Use `bash start.sh` only if Python is available on your Render plan (for ML premium predictor).

## Required environment variables

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
DATABASE_SSL=true
JWT_SECRET=long-random-string
CLIENT_ORIGIN=https://your-app.vercel.app
ML_SERVICE_URL=http://127.0.0.1:5001
```

If the password contains `@`, `#`, or `%`, URL-encode it in DATABASE_URL.

## ENETUNREACH / IPv6 errors on Render

If logs show `connect ENETUNREACH` with an IPv6 address (`2406:...`), Render cannot reach Supabase's direct IPv6 endpoint.

**Fix (recommended): use Supabase Session pooler instead of direct connection**

1. Supabase → **Project Settings → Database → Connection string**
2. Choose **Session pooler** (port **6543**)
3. Copy the URI — it looks like:

```
postgresql://postgres.ihujtiseiliabnprvxyj:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

Note the username is `postgres.PROJECT_REF`, not just `postgres`.

Set that as `DATABASE_URL` on Render with `DATABASE_SSL=true`, then redeploy.

The codebase also forces IPv4 DNS for `*.supabase.co` hosts when using the direct URL.

## After first successful deploy

Render Shell: `npm run seed`

## Health check

`https://YOUR-SERVICE.onrender.com/api/health`
