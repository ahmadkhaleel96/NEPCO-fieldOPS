/**
 * @fieldops/api-client
 *
 * This package contains a typed API client generated from the OpenAPI spec.
 *
 * Generation process:
 * 1. The Hono API (apps/api) exposes /openapi.json in non-production mode
 * 2. Run `npm run generate` in this package to fetch the spec and generate the client
 * 3. The generated client is committed so both web and mobile apps can import it
 *
 * Usage:
 *   import { ApiClient } from '@fieldops/api-client'
 *   const client = new ApiClient({ baseUrl: process.env.API_URL })
 *   const permits = await client.workPermits.list({ status: 'issued' })
 *
 * Phase 0: This is a placeholder. The full client is generated in Phase 0.5 completion
 * once the full OpenAPI spec is finalized.
 */

export { ApiClient, ApiError } from './client';
export type {
  ApiClientConfig,
  ApiClientUser,
  CreateUserPayload,
  UpdateUserPayload,
  ApiClientNfcTag,
  NfcTagStatus,
  ProvisionNfcTagPayload,
  ConfirmInstallPayload,
  ApiClientVehicle,
  CreateVehiclePayload,
  UpdateVehiclePayload,
  ApiClientAsset,
  AssetType,
  CreateAssetPayload,
  UpdateAssetPayload,
  PaginatedResponse,
  ApiClientWorkPermit,
  ApiClientWorkPermitDetail,
  WorkPermitStatus,
  WorkPermitType,
  CreateWorkPermitPayload,
  WithdrawPermitPayload,
} from './client';
