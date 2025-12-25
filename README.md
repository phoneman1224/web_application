# Reseller Ops

Production-ready Cloudflare-first app for reseller inventory, sales, expenses, pricing drafts, and tax prep.

## One-time setup (only required manual steps)

1. Create a Cloudflare API token with permissions for Workers, D1, and R2.
2. Add the following GitHub repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Authorize GitHub ↔ Cloudflare when prompted by the workflow.
4. Configure Zero Trust access:
   - In Cloudflare Zero Trust, create an Access Application for the worker hostname.
   - Ensure Access policies require identity (fail closed).
   - The worker enforces `cf-access-jwt-assertion` + `cf-access-authenticated-user-email` headers.

## Local development

```bash
npm install
npm test
```

Cloudflare integration tests (auto-skip if secrets missing):

```bash
npm run test:cf
```

## Repository layout

- `public/` — Vanilla HTML/CSS/JS front end.
- `src/worker.ts` — Cloudflare Worker API + auth enforcement.
- `src/lib/finance.ts` — Profit, fees, promotions, tax calculations.
- `migrations/` — D1 schema.
- `tests/unit/` — Unit tests (no Cloudflare needed).
- `tests/integration/` — Cloudflare integration tests.
- `scripts/` — Provisioning + CI helpers.

## CI/CD overview

- Pull requests: install, run unit tests, run integration tests when secrets exist.
- Main branch: unit tests → provision TEST D1/R2 → apply TEST migrations → deploy TEST worker → integration tests → provision PROD D1/R2 → apply PROD migrations → deploy PROD worker.

## Definition of Done checklist

- [ ] CI passes unit tests.
- [ ] CI provisions TEST D1 and runs migrations.
- [ ] CI uploads & deletes TEST R2 object.
- [ ] CI provisions PROD D1, migrates, deploys.
- [ ] App enforces auth (fail closed).
- [ ] CSV export works.
- [ ] Reports drilldown works.

## Phase B completion notes

- Added IMAGES + RECEIPTS bindings with separate R2 usage paths.
- Implemented API endpoints for inventory, expenses, sales, lots, reports, and settings.
- Wired UI to live API calls for dashboard KPIs, inventory, expenses, and CSV exports.
