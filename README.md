# NEPCO FieldOps

Field Operation Management System for the National Electric Power Company (NEPCO).

**Priority order:** Security first · Cost second · Cross-platform (PC + Android + iOS) throughout  
**Methodology:** Agile — phased delivery, each phase is a sprint

---

## Overview

FieldOps manages the full lifecycle of field operations on critical power grid infrastructure:

1. **Work permit creation** — engineers issue time-bounded permits for HV towers, substations, and switchgear
2. **NFC-based physical proof-of-presence** — vehicle and asset tags verify the right team is in the right place
3. **GPS tracking** — continuous route recording during active trips
4. **Asset inspection** — technicians submit field observations; engineers approve changes
5. **Tamper-evident reporting** — three-copy report pipeline with SHA-256 integrity verification

---

## Repository Structure

```
nepco-fieldops/                     ← Turborepo monorepo root
├── apps/
│   ├── web/                        ← React + Vite + TypeScript — PC dashboard (engineers, admins)
│   ├── mobile/                     ← Expo (React Native) + TypeScript — Android + iOS (field team)
│   └── api/                        ← Hono + TypeScript — API server
├── packages/
│   ├── shared/                     ← Zod schemas + TypeScript types shared by all apps
│   └── api-client/                 ← Typed API client (generated from OpenAPI spec)
├── infra/
│   ├── migrations/                 ← Ordered PostgreSQL migration files (001–018)
│   └── docker-compose.yml          ← Local development infrastructure
├── docs/
│   ├── threat-model.md             ← OWASP/STRIDE threat analysis (living document)
│   └── runbook.md                  ← Operational runbook for incidents
├── .env.example                    ← Environment variable template (copy → .env.local)
├── turbo.json                      ← Turborepo task pipeline
├── tsconfig.base.json              ← Shared TypeScript configuration
└── CLAUDE.md                       ← Guidance for AI-assisted development
```

---

## Tech Stack

| Concern | Technology | Why |
|---|---|---|
| Monorepo | **Turborepo** | Shared types/schemas between web, mobile, API |
| Web app | **React 18 + Vite** | Fast dev server, PC-optimised dashboard |
| Mobile app | **Expo 51 (React Native)** | OTA updates, NFC module, managed push notifications |
| API server | **Hono** | TypeScript-first, edge-compatible, small attack surface |
| Database | **Supabase Pro (PostgreSQL 15 + PostGIS)** | Built-in RLS, realtime, backups |
| Auth | **Supabase Auth** | Email+password, MFA for admin/engineer, JWT role claims |
| Validation | **Zod** | Single schema used on client AND server |
| Mobile offline | **WatermelonDB** | Conflict resolution, observable queries, offline-first |
| Job queue | **BullMQ + Upstash Redis** | Report generation, push notification delivery |
| Push notifications | **Expo Notifications** | FCM (Android) + APNs (iOS) from one API |
| Maps | **Mapbox GL JS** (web) | Asset picker map, GPS track rendering |
| Photo storage | **Cloudflare R2** | EXIF-embedded photos, pre-signed PUT |
| PDF generation | **Puppeteer** | Self-contained reports (no external URLs) |
| Email | **Resend** | Delivery tracking, webhooks, free tier |
| SMS fallback | **Twilio** | Push delivery failure fallback only |
| Secrets | **Infisical** | Never in `.env` files, automatic rotation |
| Error tracking | **Sentry** | Web + React Native SDK |
| Uptime | **Better Uptime** | API health + BullMQ queue depth monitoring |
| Logging | **Logtail** (Better Stack) | Structured JSON logs, privacy-preserving |
| CI/CD | **GitHub Actions** | lint → type-check → test → OWASP ZAP → deploy |
| Web deploy | **Cloudflare Pages** | Global CDN, automatic HTTPS |
| API deploy | **Railway** | Zero-downtime deployments |
| Mobile builds | **EAS Build + EAS Update** | APK/IPA in CI, OTA JS bundle updates |

---

## Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** ≥ 10.0.0
- **Expo CLI**: `npm install -g expo-cli eas-cli`
- External accounts required: Supabase Pro, Upstash, Mapbox, Cloudflare R2, Resend, Infisical

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
# Fill in all values — see .env.example for descriptions
```

The web app uses `VITE_` prefixed variables.  
The mobile app uses `EXPO_PUBLIC_` prefixed variables.  
The API uses server-side environment variables (never exposed to clients).

### 3. Run database migrations

Connect to your Supabase project and apply migrations in order:

```bash
# Using Supabase CLI
supabase db push --db-url $SUPABASE_DB_URL infra/migrations/
```

Or apply each file manually via the Supabase SQL editor in order from `001_` to `018_`.

### 4. Register the Auth hook

In the Supabase dashboard: **Authentication → Hooks → Custom Access Token Hook**  
Set the function to `public.inject_role_claim` (created by migration 018).

---

## Development Commands

All commands run from the repo root using Turborepo.

| Command | Description |
|---|---|
| `npm run dev` | Start all apps in development mode (parallel) |
| `npm run build` | Build all workspaces |
| `npm run test` | Run all test suites |
| `npm run test:coverage` | Run tests with coverage reports |
| `npm run type-check` | TypeScript type-check all workspaces |
| `npm run lint` | ESLint all workspaces |
| `npm run format` | Prettier format all files |

### Per-workspace commands

```bash
# Run only the API in dev mode
cd apps/api && npm run dev

# Run only web app tests
cd apps/web && npm run test

# Run a single test file
cd packages/shared && npx vitest run src/__tests__/user.schema.test.ts

# Run mobile tests
cd apps/mobile && npm test

# Run coverage for a specific workspace
cd packages/shared && npm run test:coverage
```

### Local infrastructure (Docker)

```bash
# Start Postgres + Redis locally
docker-compose -f infra/docker-compose.yml up -d

# Stop
docker-compose -f infra/docker-compose.yml down
```

### Mobile development

```bash
cd apps/mobile

# Start Expo dev server
npm run dev

# Run on Android emulator
npm run android

# Run on iOS simulator (macOS only)
npm run ios

# Build for production (requires EAS CLI and project ID)
npm run build:android
npm run build:ios
```

---

## User Roles

| Role | Platform | Permissions |
|---|---|---|
| `admin` | Web | Create users, provision NFC tags, revoke sessions, all data |
| `engineer` | Web (primary) | Create/issue permits, approve asset changes, view reports |
| `team_leader` | Mobile | Accept permits, lead site operations |
| `technician` | Mobile | Accept permits, submit inspections |
| `driver` | Mobile | Accept permits, initiate/end trips via NFC scan |

Role boundaries are enforced at three layers: JWT claim → API middleware → Supabase RLS.

---

## Operational Workflow

```
1. Admin creates user accounts
2. Admin provisions NFC tags to vehicles and assets
3. Engineer creates a work permit (asset selection, team, schedule)
4. Permit issued → team receives push notification
5. Each member accepts via biometric confirmation (Face ID / fingerprint)
6. Driver scans vehicle NFC tag → trip starts, GPS tracking begins
7. Team arrives at site → technician scans asset NFC tag → inspection form loads
8. Technician submits inspection (form diff computed, asset_changes created)
9. Engineer approves/rejects changes from the PC dashboard
10. All inspections submitted → driver scans vehicle tag again → trip ends
11. Permit moves to 'completed' → report pipeline triggered
```

---

## Security Architecture

See [docs/threat-model.md](docs/threat-model.md) for the full OWASP/STRIDE analysis.

Key points:
- **MFA mandatory** for `admin` and `engineer` roles (TOTP)
- **JWT access tokens** expire in 15 minutes; refresh tokens rotate on every use
- **Web tokens** stored in memory only; refresh token in `httpOnly` cookie
- **Mobile tokens** stored in Expo SecureStore (iOS Keychain / Android Keystore)
- **NFC tag passwords** stored in Supabase Vault; never in application logs
- **RLS policies** enforce data isolation at the database layer
- **`asset_history`** and **`nfc_events`** are append-only (DB triggers prevent modification)
- **Certificate pinning** on mobile (`expo-ssl-pinning`)
- **SHA-256 hashing** on all generated reports for tamper detection

---

## Database Schema

18 ordered migrations in `infra/migrations/`:

```
001 Extensions (uuid-ossp, postgis, pgcrypto)
002 Enums (user_role, asset_type, work_permit_status, etc.)
003 users
004 assets (with PostGIS geometry column)
005 vehicles
006 nfc_tags (with Vault reference for write password)
007 work_permits + permit_assets
008 permit_members
009 trips + trip_locations
010 nfc_events (append-only)
011 asset_inspections
012 asset_changes
013 asset_history (append-only) + approval trigger
014 safety_reports
015 follow_up_tasks
016 reports + integrity_alerts + report_recipients
017 RLS policies
018 Supabase Auth hook (inject_role_claim)
```

---

## Testing

Each workspace has its own test runner and coverage requirements:

| Workspace | Runner | Coverage target |
|---|---|---|
| `packages/shared` | Vitest | ≥ 90% lines |
| `apps/api` | Vitest | ≥ 85% lines |
| `apps/web` | Vitest + jsdom | ≥ 80% lines |
| `apps/mobile` | Jest + jest-expo | ≥ 80% lines |

Coverage reports are generated in each workspace's `coverage/` directory.

---

## Sprint Log

### Sprint 0 — Phase 0: Foundation & Security Baseline ✅ (2026-04-14)

- [x] **0.1** Threat model (OWASP/STRIDE) → `docs/threat-model.md`
- [x] **0.2** Turborepo monorepo: `apps/web`, `apps/mobile`, `apps/api`, `packages/shared`, `packages/api-client`
- [x] **0.3** Database migrations 001–018 (all tables, RLS policies, triggers, auth hook)
- [x] **0.4** Auth middleware (JWT validation, role extraction, `requireRole` guard)
- [x] **0.5** Hono API skeleton: all route stubs with Zod validation, rate limiting, structured logging, error handling

**Next sprint: Phase 1 — Core Data & Identity**
- 1.1 Admin panel: user management UI
- 1.2 Asset registry: bulk CSV import, Mapbox map view
- 1.3 Vehicle registry
- 1.4 NFC tag provisioning workflow
