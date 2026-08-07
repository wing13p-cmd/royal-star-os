# RSOS Live Data Platform - Phase 10 Enterprise Control Layer

## Provider Registry
- Canonical provider registry is managed by `createEnterpriseProviderRegistry`.
- Providers remain disabled until credentials, licensing, and administrator authorization are complete.

## Adapter Contract
- Universal adapter methods: `searchProperty`, `searchComps`, `searchRent`, `searchMarket`, `searchOwner`, `searchParcel`, `searchPermits`, `searchTax`, `searchMedia`.
- Production adapters implemented for county property, county recorder, permits, FEMA, census, and Google Maps references.

## Credential Configuration
- Credentials are stored in encrypted local vault files.
- Supported auth: API key, OAuth, bearer token, basic auth, and environment variables.
- Empty credentials preserve manual mode.

## Provider Activation
- Activation requires administrator authorization and successful authenticated provider evidence.
- Providers cannot be classified as connected without authenticated success.

## Provider Deactivation
- Deactivation returns provider to disabled/manual-safe status without deleting historical records.

## Sync Operations
- Sync manager supports manual, single provider, selected provider, all active providers, subject-property, comp-set, and portfolio scopes.
- Sync operations capture operation metadata, counts, warnings, errors, and audit references.

## Scheduled Jobs
- Jobs are disabled by default.
- Jobs require administrator authorization, enforce locks, and support pause/resume/cancel/retry.

## Review-First Workflow
- Imported records are queued for review.
- No automatic approvals are allowed.
- Review decisions are audited with reasons.

## Data-Quality Scoring
- Data-quality service scores authority, recency, completeness, consistency, rights clarity, duplicate/conflict risk, and cross-source agreement.
- Quality score does not equal approval.

## Duplicate Review
- Deterministic evidence includes normalized address, parcel, provider IDs, listing keys, county identifiers, coordinates, legal description, sale signals, and document references.

## Conflict Resolution
- Conflict workflow is administrator-only and reason-required.
- Material value changes produce versioned outcomes and exactly one re-underwriting trigger per entity.

## Merge Governance
- No silent overwrites.
- No automatic merge of material conflicts.
- Alternate evidence can be retained without changing approved values.

## Rate Limits
- Usage monitor tracks request totals, failures, cached hits, latency, retry-after, and provider-reported quota when available.
- Invalid credentials are not auto-retried.

## Caching
- Cache entries store metadata, checksums, rights limitations, stale markers, and invalidation reasons.
- Credential-bearing URLs and prohibited media are blocked from cache.

## Provider Outage
- Outages are isolated and audited.
- Failover is restricted to authorized active providers.

## Backup
- Backup automation includes registry, nonsecret config, sync history, review queue, conflicts, quality records, audit, and documentation references.

## Restore
- Restore is dry-run governed for control-layer snapshots.
- Restore verification checks checksum, manifest, and integrity markers.

## Disaster Recovery
- Non-destructive DR verification simulates outage, corrupted cache, failed sync, duplicates/conflicts, and restore rehearsal.

## Manual-Mode Operation
- Platform remains usable with zero configured credentials.
- Unknown values remain UNKNOWN.

## Licensing and Media-Rights Controls
- Licensing and media rights are review-gated.
- Copyright-restricted imagery is reference-only and never auto-stored.

## Security Limitations
- No secrets are logged in audit records.
- No sensitive local filesystem paths are exposed in diagnostics payloads.

## Adding a Future Provider Safely
1. Register provider metadata and licensing requirements.
2. Add adapter contract implementation with review-first placeholders.
3. Add credential-vault mapping with empty-default behavior.
4. Add quality, duplicate, and conflict policies.
5. Add tests for manual mode, rights controls, and audit coverage.
6. Require administrator authorization before any live activation.
