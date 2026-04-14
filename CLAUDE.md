# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

NEPCO FieldOps is a field operation management system for critical power grid infrastructure. It is a Turborepo monorepo containing:

- `apps/web` — React + Vite PC dashboard (engineers, admins)
- `apps/mobile` — Expo React Native app (Android + iOS field team)
- `apps/api` — Hono API server (the only entry point to the database)
- `packages/shared` — Zod schemas + TypeScript types shared across all apps
- `packages/api-client` — typed API client generated from OpenAPI spec
- `infra/migrations/` — 18 ordered PostgreSQL migration files

---

## Development Commands

All commands run from the repo root:

```bash
npm install              # install all workspaces
npm run dev              # start all apps in parallel
npm run build            # build all workspaces
npm run test             # run all test suites
npm run test:coverage    # run tests + generate coverage reports
npm run type-check       # TypeScript type-check all workspaces
npm run lint             # ESLint all workspaces
npm run format           # Prettier all files
```

Per-workspace (from workspace directory):

```bash
npm run dev              # dev server for this workspace only
npm run test             # tests for this workspace only
npx vitest run src/__tests__/foo.test.ts   # single test file (packages/shared, apps/api, apps/web)
npm test -- --testPathPattern=foo          # single test file (apps/mobile)
npm run test:coverage    # coverage report
```

Mobile only:

```bash
cd apps/mobile
npm run dev              # Expo dev server
npm run android          # Android emulator
npm run ios              # iOS simulator (macOS only)
npm run build:android    # EAS production build
npm run build:ios        # EAS production build
```

Local infra:

```bash
docker-compose -f infra/docker-compose.yml up -d    # start Postgres + Redis locally
```

---

## Architecture Principles

### Schema-first, single source of truth

All data shapes are defined **once** in `packages/shared` as Zod schemas. The same schema object validates:
- Server-side (API middleware)
- Client-side forms (React Hook Form + `@hookform/resolvers`)
- TypeScript types (`z.infer<typeof Schema>`)

Never duplicate a validation rule. If the shape changes, change it in `packages/shared` only.

### Three-layer security enforcement

Every privileged action is blocked at three independent layers:
1. **JWT role claim** — extracted from token, checked in API middleware (`requireRole()`)
2. **Hono route handler** — business logic validates ownership and state
3. **Supabase RLS policy** — enforced at the database layer (cannot be bypassed by the API)

This means a bug in the API cannot bypass database-level access control.

### Offline-first on mobile (Phase 3+)

The mobile app uses WatermelonDB for local storage. All writes (GPS points, NFC events, inspection submissions) are queued locally first, then flushed on reconnect. The server uses `INSERT ... ON CONFLICT (client_id) DO NOTHING` for idempotent upserts. Never assume network availability in mobile code.

### Append-only audit tables

`nfc_events` and `asset_history` have PostgreSQL triggers that raise exceptions on any `UPDATE` or `DELETE`. These tables are permanently immutable — do not attempt to modify them from any code path, including admin utilities.

### Completed permits are immutable

`work_permits` has a trigger that raises an exception on any `UPDATE` when `status = 'completed'`. An RLS policy also enforces this. No code path should attempt to modify a completed permit.

---

## Styling Rules (MANDATORY)

### Web (`apps/web`)
- **All CSS goes in `.css` files** — no inline `style` attributes, no `style={{}}` props, ever.
- Use **CSS Modules** for component-scoped styles (`ComponentName.module.css` in the same directory as the component).
- Global design tokens are CSS custom properties in `src/styles/variables.css`.
- Global reset: `src/styles/reset.css`. Global body styles: `src/styles/global.css`.
- Never add a `style` prop to a JSX element. Use class names only.

### Mobile (`apps/mobile`)
- **All styles go in `StyleSheet.create()` objects in separate files** — no inline style objects ever.
- The style files live in `src/styles/` (for global tokens) or alongside the component as `ComponentName.styles.ts`.
- Design tokens: `src/styles/colors.ts`, `src/styles/typography.ts`, `src/styles/spacing.ts`.
- Import these tokens; never hardcode colours or font sizes in a component file.

---

## Testing Requirements

Every feature must have tests. Minimum coverage thresholds are enforced by CI and will fail the build:

| Workspace | Lines | Branches | Functions |
|---|---|---|---|
| `packages/shared` | 90% | 85% | 90% |
| `apps/api` | 85% | 80% | 85% |
| `apps/web` | 80% | 75% | 80% |
| `apps/mobile` | 80% | 75% | 80% |

Test conventions:
- Test files live in `src/__tests__/` subdirectories (or `__tests__/` adjacent to the source)
- Name test files `*.test.ts` or `*.test.tsx`
- Mock all external services (Supabase, Redis, Expo modules) — never make real network calls in tests
- Use `vi.mock()` (Vitest) or `jest.mock()` (Jest/mobile) at the top of test files
- Test both valid and invalid inputs for every Zod schema
- Test both allowed and denied roles for every protected route

---

## Cross-Platform Requirements

The app must work on:
- **Windows** (web app via Cloudflare Pages, Expo via EAS Build)
- **macOS** (web app + Expo dev/build environment)
- **iOS** (Expo managed workflow, NFC entitlement required)
- **Android** (Expo managed workflow, NFC permission required)

NFC:
- iOS: requires `NFCReaderUsageDescription` in `app.json` + NFC entitlement in EAS profile
- Android: requires `NFC` permission in `app.json`
- Both handled by `expo-nfc`

GPS background tracking:
- iOS: requires `NSLocationAlwaysAndWhenInUseUsageDescription` + background location entitlement
- Android: requires `ACCESS_BACKGROUND_LOCATION` permission
- Both handled by `expo-location`

---

## Environment Variables

All secrets live in Infisical (production). For local development, copy `.env.example` → `.env.local`.

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | `apps/api` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `apps/api` | Public anon key (validates user JWTs) |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/api` | **Secret** — bypasses RLS, never expose to clients |
| `UPSTASH_REDIS_REST_URL` | `apps/api` | Rate limiting + BullMQ |
| `UPSTASH_REDIS_REST_TOKEN` | `apps/api` | Rate limiting + BullMQ |
| `VITE_SUPABASE_URL` | `apps/web` | Supabase URL (public) |
| `VITE_SUPABASE_ANON_KEY` | `apps/web` | Supabase anon key (public) |
| `VITE_MAPBOX_TOKEN` | `apps/web` | Mapbox map picker |
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile` | Supabase URL (public) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile` | Supabase anon key (public) |
| `R2_*` | `apps/api` | Cloudflare R2 photo + report storage |
| `RESEND_API_KEY` | `apps/api` | Email delivery |
| `TWILIO_*` | `apps/api` | SMS fallback |

**Never** commit any real secret. The `.gitignore` blocks `.env.*` files (except `.env.example`).

---

## Database Migration Rules

- All schema changes are migrations — never manually edit a production table
- Migrations are numbered sequentially: `NNN_description.sql`
- Run migrations via `supabase db push` or in order via the Supabase SQL editor
- After adding a migration, update the sprint log in `README.md`
- RLS policies must be updated if a new table is added

---

## API Route Conventions

```
GET    /resource           list (paginated with ?page=&per_page=)
POST   /resource           create
GET    /resource/:id       fetch single
PATCH  /resource/:id       partial update
DELETE /resource/:id       soft delete (set is_active = false) or hard if appropriate
POST   /resource/:id/action  state transitions (e.g., /work-permits/:id/withdraw)
```

All responses follow:
```json
{ "success": true, "data": {...} }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

---

## Build Plan Phases

| Phase | Status | Description |
|---|---|---|
| **0** | ✅ Sprint 0 | Foundation & Security Baseline |
| **1** | 🔜 Next | Core Data & Identity (users, assets, vehicles, NFC provisioning) |
| **2** | Pending | Permit Workflow (create, notifications, withdrawal) |
| **3** | Pending | Field Operations: NFC + GPS |
| **4** | Pending | Inspection Submission & Engineer Approval |
| **5** | Pending | Trip Closure & Data Sealing |
| **6** | Pending | Reporting Engine & Three-Copy Fallback |
| **7** | Parallel | Security Hardening & Audit |
| **8** | Parallel | Deployment & Operations |

Full build plan: see `plan.pdf` (provided by project owner).

---

## Key Files Reference

| File | Purpose |
|---|---|
| `packages/shared/src/index.ts` | All exported schemas and types |
| `packages/shared/src/constants.ts` | Security constants (TTLs, limits, thresholds) |
| `apps/api/src/app.ts` | Hono app factory (middleware, routes, error handler) |
| `apps/api/src/middleware/auth.middleware.ts` | JWT validation + `requireRole()` guard |
| `apps/api/src/middleware/error.middleware.ts` | Global error → structured response |
| `apps/web/src/styles/variables.css` | CSS design tokens |
| `apps/mobile/src/styles/colors.ts` | Mobile colour palette |
| `docs/threat-model.md` | OWASP/STRIDE threat analysis — review before major features |
| `infra/migrations/017_create_rls_policies.sql` | Row-Level Security policies |
| `infra/migrations/013_create_asset_history.sql` | Append-only trigger + approval automation |
