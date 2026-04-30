# Threat Model — NEPCO FieldOps

**Methodology:** OWASP Threat Modelling + STRIDE framework  
**Status:** Living document — revisit before every major feature addition  
**Last reviewed:** 2026-04-30 (Phase 7 hardening)

---

## 1. System Overview

NEPCO FieldOps is a field operation management system for critical power grid infrastructure. It manages:

- Work permits authorising field teams to operate on HV towers, substations, and switchgear
- NFC-based physical proof-of-presence at vehicles and assets
- Continuous GPS tracking during active field operations
- Asset inspection data collection and engineer approval workflow
- Tamper-evident reporting pipeline with three-copy redundancy

**Clients:**
- `apps/web` — React/Vite PC dashboard (engineers, admins)
- `apps/mobile` — Expo React Native app (drivers, team leaders, technicians)
- `apps/api` — Hono API server (the only entry point to the database)

---

## 2. Assets to Protect

| Asset | Classification | Impact if compromised |
|---|---|---|
| Asset metadata (location, condition, history) | Confidential | Enables targeted physical attacks on grid infrastructure |
| Team location (GPS tracks) | Personal/Operational | Exposes field personnel movements |
| Work permit records | Operational | Falsified permits could authorise unauthorised access to live equipment |
| Inspection reports | Regulatory | Report tampering could mask safety defects |
| NFC tag write passwords | Secret | Tag cloning enables physical impersonation of vehicles/assets |
| User credentials + session tokens | Secret | Account takeover; privilege escalation |
| API service role key | Secret | Full database access if exposed |

---

## 3. User Roles and Trust Levels

| Role | Platform | Trust | Key capabilities |
|---|---|---|---|
| `admin` | Web only | High | Create users, provision NFC tags, revoke sessions, view all data |
| `engineer` | Web primary | High | Create/issue permits, approve asset changes, view all reports |
| `team_leader` | Mobile | Medium | Accept permits, lead site operations |
| `technician` | Mobile | Medium | Accept permits, submit inspections |
| `driver` | Mobile | Lower | Accept permits, initiate/end trips via NFC scan |

**Role enforcement is applied at three layers:**
1. JWT `role` custom claim (set at sign-in via Supabase Auth hook)
2. Hono API middleware (validates role before routing)
3. Supabase RLS policies (enforced at the database layer — survives a compromised API)

---

## 4. STRIDE Threat Analysis

### 4.1 Spoofing

| Threat | Mitigation |
|---|---|
| Attacker impersonates a team member using a stolen session token | Short access token TTL (15 min); refresh token rotation on every use; Expo SecureStore (hardware-backed) on mobile |
| Driver clones vehicle NFC tag to falsify a trip start | NTAG password-lock: 4-byte write password stored only in Supabase Vault, fetched server-side at validation time. Client never sees the password. |
| Attacker submits NFC scan event without a physical tag | Server-side validation: `tag_id` must match the permit's assigned vehicle in `nfc_tags` table. A modified client cannot manufacture a valid tag ID. |
| JWT forgery | Supabase signs JWTs with RS256; public key verified by the API on every request |

### 4.2 Tampering

| Threat | Mitigation |
|---|---|
| Attacker modifies an inspection report after generation | SHA-256 hash of report payload stored in `reports.sha256`; weekly integrity job re-hashes and compares. Mismatch triggers `integrity_alerts` and admin email. |
| Database row modification (asset history, NFC events) | `asset_history` and `nfc_events` tables have `BEFORE UPDATE / BEFORE DELETE` triggers that raise an exception — modification is impossible from any role including service role. |
| Client sends modified form data to inflate/deflate inspection values | All form data validated server-side against Zod schemas (defined once in `packages/shared`). The client schema and server schema are the same object. |
| Permit record altered after completion | `work_permits` has a trigger that raises an exception on any UPDATE when `status = 'completed'`. RLS UPDATE policy additionally enforces this. |

### 4.3 Repudiation

| Threat | Mitigation |
|---|---|
| Team member denies accepting a permit | `permit_members.accepted_at` timestamp set on biometric confirmation (Face ID / fingerprint via `expo-local-authentication`). Biometric ties acceptance to the authenticated session. |
| Driver denies initiating a trip | `trips` row creation + `nfc_events` row with `event_type: vehicle_start` created atomically on NFC scan. Both have `client_timestamp` and GPS coordinates. |
| Engineer denies approving an asset change | `asset_changes.reviewed_by` + `reviewed_at` set at approval time; `asset_history` record created atomically in the same transaction. |

### 4.4 Information Disclosure

| Threat | Mitigation |
|---|---|
| Token theft via XSS on web app | Access token stored in memory only (never `localStorage`). Refresh token in `httpOnly` cookie (inaccessible to JavaScript). |
| Token theft from mobile device | Tokens stored in Expo SecureStore — backed by iOS Keychain and Android Keystore. Never in `AsyncStorage` (plaintext). |
| GPS coordinates in application logs | Structured logger explicitly excludes GPS coordinates, permit contents, and inspection form data. Logs contain IDs and action codes only. |
| NFC tag password exposure | `nfc_tags.vault_secret_id` stores a Vault reference, not the password itself. Password is fetched server-side on demand and never logged or returned to the client. |
| API service role key exposure | Service role key is never sent to any client. Used only by background jobs running server-side. Stored in Infisical; rotated every 90 days. |
| Man-in-the-middle on mobile | Certificate pinning via `expo-ssl-pinning`. Mobile app refuses connections to servers not matching the pinned public key. |

### 4.5 Denial of Service

| Threat | Mitigation |
|---|---|
| Brute-force authentication | Upstash Redis sliding-window rate limiter: 5 attempts per minute per IP on `/auth/*` endpoints, then lockout. |
| API endpoint flooding | Rate limiter on all endpoints. Cloudflare proxy layer provides additional DDoS protection. |
| Report generation abuse | Report endpoints require engineer/admin role; BullMQ job queue prevents simultaneous unbounded generation. |
| Offline queue flood (mobile) | WatermelonDB write queue is bounded; sync is throttled on reconnect. Idempotency keys prevent duplicate server-side insertions. |

### 4.6 Elevation of Privilege

| Threat | Mitigation |
|---|---|
| Driver attempts to approve an asset change | Three-layer enforcement: JWT role claim checked in middleware, RLS policy on `asset_changes` denies UPDATE for non-engineer/admin roles, permit `engineer_id` checked in application logic. |
| Technician attempts to access another permit they are not assigned to | RLS on `work_permits`: team members can only SELECT permits where their `user_id` appears in `permit_members`. Enforced at DB level. |
| Insider threat: engineer modifies their own permit after completion | Trigger on `work_permits` prevents any UPDATE when `status = 'completed'`. Cannot be bypassed via the application API. |
| Privilege escalation via JWT claim manipulation | JWT `role` claim is injected server-side at sign-in by a Supabase Auth hook. Clients cannot set or modify claims. The claim is verified against the `users.role` column on first use. |
| Compromised admin account approves unauthorised access | MFA (TOTP) is mandatory for `admin` and `engineer` roles. Session invalidation endpoint allows Admin to revoke all sessions immediately (e.g., lost device). |

---

## 5. Physical Threats

| Threat | Mitigation |
|---|---|
| NFC tag cloning (attacker copies tag_id to own hardware) | NTAG password-lock: the physical tag requires a 4-byte password to respond to write commands. Read-only clones cannot be used because the server validates the tag belongs to the specific assigned vehicle AND the scan was performed by the permit's driver. |
| Lost/stolen field device | Tokens in Expo SecureStore (hardware-encrypted). Admin can revoke the session via the session invalidation endpoint. Remote wipe via MDM if deployed. |
| Physical access to a substation using a copied permit | Permit requires a valid vehicle NFC scan + GPS coordinates within expected range. Permit is time-bounded (scheduled_start / scheduled_end). |

---

## 6. Data Flow Diagram (Simplified)

```
[Mobile App] ──HTTPS+pinning──▶ [Hono API] ──SSL verify-full──▶ [Supabase DB + RLS]
                                     │
                                     ├──▶ [Supabase Auth]  (JWT validation)
                                     ├──▶ [Upstash Redis]  (rate limiting)
                                     ├──▶ [Cloudflare R2]  (photo upload, reports)
                                     └──▶ [BullMQ]         (async jobs)
                                              │
                                              ├──▶ [Expo Push / FCM / APNs]
                                              ├──▶ [Resend]  (email reports)
                                              └──▶ [Twilio]  (SMS fallback)

[Web App]    ──HTTPS──────────▶ [Hono API]  (same path, no cert pinning needed)
```

---

## 7. Security Decisions Log

| Decision | Rationale |
|---|---|
| No social login | Internal enterprise tool; SSO/SAML deferred to Supabase Team plan if needed |
| MFA mandatory for engineer + admin only | Drivers and technicians operate in the field with mobile hardware; forced TOTP would create operational friction with no threat reduction |
| Refresh token rotation on every use | Prevents replay attacks if a refresh token is intercepted |
| `httpOnly` cookie for refresh token (web) | Prevents JavaScript (including XSS payloads) from reading the token |
| RLS as final enforcement layer | Application logic can have bugs; RLS cannot be bypassed by the application |
| Append-only `asset_history` and `nfc_events` | Regulatory and legal requirement; tampering must be physically impossible, not just policy-prohibited |
| SHA-256 on reports | Silent corruption detection; meets regulatory audit requirements |

---

## 8. Out of Scope (v1)

- SSO/SAML/LDAP integration (supported by Supabase Team plan when needed)
- NTAG 424 DNA cryptographic challenge-response (upgrade path: add `mac` parameter to scan endpoint; no schema change needed)
- AI-assisted anomaly detection on inspection values (post-submission hook, no flow change needed)
- Hardware Security Module (HSM) for NFC tag password management
