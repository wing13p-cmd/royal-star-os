# RSOS Hosted Operations (Phase 2)

## 1) Build and startup

1. Build frontend: `npm run build`
2. Export production env from `deploy/.env.production.template`
3. Start secure gateway: `npm run deploy:secure`

The secure gateway serves frontend over HTTPS and proxies `/api` internally to the backend bound on loopback only.

## 2) Backup creation

Run server-side only:

`npm run backup`

Backups are written to `RSOS_BACKUP_DIR` with timestamped names.

## 3) Secure backup retrieval

Retrieve backups through your hosting provider's secure operator channel (SSH/SFTP/control-plane artifact download). Do not expose backup files through public web routes.

## 4) Restore

1. Stop running RSOS processes.
2. Restore from a known backup:

`npm run restore -- <backup-file>`

3. Restart RSOS and validate operator health.

## 5) Data import/migration

For initial migration to hosted persistent storage:

`npm run import:data -- <backup-file>`

The importer creates a pre-import backup, preserves IDs, validates counts, validates deal-property links, and refuses duplicate re-imports.

## 6) Operator health verification

Public readiness:

`curl -s https://your-rsos-domain.example/health`

Operator detail:

`curl -s -H "X-RSOS-Operator-Token: <token>" https://your-rsos-domain.example/api/operator/health`

## 7) Deployment rollback

1. Stop secure gateway.
2. Restore data from last known-good backup.
3. Redeploy last known-good build artifacts.
4. Start secure gateway and verify `health` + `api/operator/health`.
