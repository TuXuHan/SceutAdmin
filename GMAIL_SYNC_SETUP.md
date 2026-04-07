# Gmail Payment Sync Setup

## Required env vars

Add these to `Admin/.env.local` or your production env:

```env
GOOGLE_GMAIL_CLIENT_ID=
GOOGLE_GMAIL_CLIENT_SECRET=
GOOGLE_GMAIL_REDIRECT_URI=
GMAIL_SYNC_STORAGE_SECRET=
GMAIL_SYNC_CRON_SECRET=
```

Optional:

```env
GMAIL_SYNC_QUERY=from:info@newebpay.com subject:"藍新金流定期定額信用卡刷卡結果通知信" newer_than:30d
GMAIL_SYNC_MAX_RESULTS=20
GMAIL_REFRESH_TOKEN=
```

## OAuth setup

1. In Google Cloud Console, enable Gmail API.
2. Create a Web OAuth client.
3. Add your callback URL to Authorized redirect URIs:
   - local: `http://localhost:3001/api/gmail/oauth/callback`
   - production: your Admin domain `/api/gmail/oauth/callback`
4. Start OAuth:
   - `GET /api/gmail/oauth/start`
5. Complete consent using `sceut.tw@gmail.com`.
6. Local development stores the token in `Admin/.runtime/gmail-sync.json`.
7. For Vercel/production, create the Supabase table from `Admin/gmail_sync_state.sql`.

## Polling

Run manually:

```bash
curl -H "Authorization: Bearer $GMAIL_SYNC_CRON_SECRET" \
  "https://your-admin-domain/api/cron/gmail-payment-sync?dryRun=true"
```

Browser test:

```text
https://your-admin-domain/api/cron/gmail-payment-sync?dryRun=true&secret=YOUR_GMAIL_SYNC_CRON_SECRET
```

Real run:

```bash
curl -H "Authorization: Bearer $GMAIL_SYNC_CRON_SECRET" \
  "https://your-admin-domain/api/cron/gmail-payment-sync"
```

Bootstrap mode for first sync:

```bash
curl -H "Authorization: Bearer $GMAIL_SYNC_CRON_SECRET" \
  "https://your-admin-domain/api/cron/gmail-payment-sync?bootstrap=true&dryRun=true"
```

Browser bootstrap test:

```text
https://your-admin-domain/api/cron/gmail-payment-sync?bootstrap=true&dryRun=true&secret=YOUR_GMAIL_SYNC_CRON_SECRET
```

## What gets updated

- `subscribers`
  - `last_payment_date`
  - `next_payment_date`
  - `payment_status`
  - `subscription_status`
  - `payment_data.gmail_events`
- `orders`
  - match by `merchantOrderNo + periodNo` in `notes`
  - success: `created -> confirmed`
  - failure: keep order status, but update payment metadata in `notes`

## Storage notes

- Local development stores OAuth refresh token and polling state in `Admin/.runtime/gmail-sync.json`.
- Vercel/production stores OAuth refresh token and polling state in Supabase table `gmail_sync_state`.
- The refresh token is encrypted with `GMAIL_SYNC_STORAGE_SECRET`.
- If `GMAIL_SYNC_STORAGE_SECRET` changes, previously stored tokens can no longer be decrypted. Re-run `/api/gmail/oauth/start` or set a fresh `GMAIL_REFRESH_TOKEN`.
- Run `Admin/gmail_sync_state.sql` once in Supabase SQL Editor before using production OAuth or cron polling.
