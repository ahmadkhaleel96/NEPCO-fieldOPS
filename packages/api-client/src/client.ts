export interface ApiClientConfig {
  baseUrl: string;
  /** JWT access token — required for all authenticated endpoints */
  accessToken?: string;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

export interface ApiClientUser {
  id: string;
  auth_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'engineer' | 'team_leader' | 'technician' | 'driver';
  phone: string | null;
  is_active: boolean;
  push_token: string | null;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  email: string;
  full_name: string;
  role: ApiClientUser['role'];
  phone?: string;
}

export interface UpdateUserPayload {
  full_name?: string;
  role?: ApiClientUser['role'];
  phone?: string | null;
  is_active?: boolean;
}

export type NfcTagStatus = 'provisioned' | 'active' | 'inactive' | 'replaced';

export interface ApiClientNfcTag {
  id: string;
  tag_id: string;
  status: NfcTagStatus;
  asset_id: string | null;
  vehicle_id: string | null;
  provisioned_by: string;
  replaced_by: string | null;
  install_lat: number | null;
  install_lng: number | null;
  install_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProvisionNfcTagPayload {
  tag_id: string;
  asset_id?: string;
  vehicle_id?: string;
}

export interface ConfirmInstallPayload {
  latitude: number;
  longitude: number;
  photo_url: string;
}

export interface ApiClientVehicle {
  id: string;
  vehicle_code: string;
  plate_number: string;
  model: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateVehiclePayload {
  vehicle_code: string;
  plate_number: string;
  model?: string;
}

export interface UpdateVehiclePayload {
  plate_number?: string;
  model?: string | null;
  is_active?: boolean;
}

export type AssetType =
  | 'hv_tower'
  | 'substation'
  | 'switchgear'
  | 'cable_joint'
  | 'distribution_cabinet';

export interface ApiClientAsset {
  id: string;
  asset_code: string;
  asset_type: AssetType;
  name: string;
  latitude: number;
  longitude: number;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAssetPayload {
  asset_code: string;
  asset_type: AssetType;
  name: string;
  latitude: number;
  longitude: number;
  metadata: Record<string, unknown>;
}

export interface UpdateAssetPayload {
  asset_type?: AssetType;
  name?: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
}

export type WorkPermitStatus =
  | 'draft'
  | 'issued'
  | 'active'
  | 'completed'
  | 'incomplete'
  | 'suspended'
  | 'withdrawn';

export type WorkPermitType = 'maintenance' | 'inspection' | 'emergency' | 'installation';

export interface ApiClientWorkPermit {
  id: string;
  permit_number: string;
  permit_type: WorkPermitType;
  status: WorkPermitStatus;
  engineer_id: string;
  vehicle_id: string;
  scheduled_start: string;
  scheduled_end: string;
  safety_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiClientWorkPermitDetail extends ApiClientWorkPermit {
  permit_members: Array<{
    id: string;
    permit_id: string;
    user_id: string;
    accepted_at: string | null;
    withdrawn_at: string | null;
    withdrawal_reason: string | null;
    created_at: string;
  }>;
  permit_assets: Array<{
    asset_id: string;
    assets: {
      id: string;
      asset_code: string;
      name: string;
      asset_type: AssetType;
      metadata: Record<string, unknown>;
    } | null;
  }>;
}

export interface CreateWorkPermitPayload {
  permit_type: WorkPermitType;
  vehicle_id: string;
  asset_ids: string[];
  scheduled_start: string;
  scheduled_end: string;
  safety_notes?: string;
  team: {
    driver_id: string;
    leader_id: string;
    technician_ids: string[];
  };
}

export interface WithdrawPermitPayload {
  reason: string;
}

export type NfcEventType = 'vehicle_start' | 'site_arrival' | 'trip_end' | 'permit_withdrawal';

export interface ApiClientTrip {
  id: string;
  permit_id: string;
  driver_id: string;
  vehicle_id: string;
  start_time: string;
  end_time: string | null;
  start_lat: number;
  start_lng: number;
  end_lat: number | null;
  end_lng: number | null;
  client_id: string;
  created_at: string;
}

export interface StartTripPayload {
  tag_id: string;
  permit_id: string;
  lat: number;
  lng: number;
  client_id: string;
  client_timestamp: string;
}

export interface TripLocationPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  captured_at: string;
  client_id: string;
}

export interface PostTripLocationsPayload {
  locations: TripLocationPoint[];
}

export interface EndTripPayload {
  lat?: number;
  lng?: number;
}

export interface TripTrack {
  type: 'LineString';
  coordinates: [number, number][];
  has_gaps: boolean;
}

export interface SiteArrivalPayload {
  tag_id: string;
  trip_id: string;
  lat: number;
  lng: number;
  client_id: string;
  client_timestamp: string;
}

export interface SiteArrivalResponse {
  event_id: string;
  asset_id: string;
  permit_id: string;
}

/**
 * Typed API client for the FieldOps API.
 */
export class ApiClient {
  private baseUrl: string;
  private accessToken: string | undefined;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accessToken = config.accessToken;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  protected async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { code: 'UNKNOWN', message: response.statusText },
      }));
      throw new ApiError(response.status, error.error?.code, error.error?.message);
    }

    return response.json() as Promise<T>;
  }

  get health() {
    return {
      check: () =>
        this.request<{ status: string; timestamp: string }>('GET', '/health'),
    };
  }

  get nfcTags() {
    return {
      list: (params?: { page?: number; per_page?: number; status?: NfcTagStatus }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        if (params?.status) qs.set('status', params.status);
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientNfcTag>>('GET', `/nfc-tags${query}`);
      },
      get: (id: string) =>
        this.request<{ success: true; data: ApiClientNfcTag }>('GET', `/nfc-tags/${id}`),
      provision: (payload: ProvisionNfcTagPayload) =>
        this.request<{ success: true; data: ApiClientNfcTag }>('POST', '/nfc-tags', payload),
      confirmInstall: (id: string, payload: ConfirmInstallPayload) =>
        this.request<{ success: true; data: ApiClientNfcTag }>('PATCH', `/nfc-tags/${id}/confirm-install`, payload),
    };
  }

  get vehicles() {
    return {
      list: (params?: { page?: number; per_page?: number }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientVehicle>>('GET', `/vehicles${query}`);
      },
      get: (id: string) =>
        this.request<{ success: true; data: ApiClientVehicle }>('GET', `/vehicles/${id}`),
      create: (payload: CreateVehiclePayload) =>
        this.request<{ success: true; data: ApiClientVehicle }>('POST', '/vehicles', payload),
      update: (id: string, payload: UpdateVehiclePayload) =>
        this.request<{ success: true; data: ApiClientVehicle }>('PATCH', `/vehicles/${id}`, payload),
      deactivate: (id: string) =>
        this.request<{ success: true; data: ApiClientVehicle }>('DELETE', `/vehicles/${id}`),
    };
  }

  get assets() {
    return {
      list: (params?: { page?: number; per_page?: number; asset_type?: AssetType }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        if (params?.asset_type) qs.set('asset_type', params.asset_type);
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientAsset>>('GET', `/assets${query}`);
      },
      get: (id: string) =>
        this.request<{ success: true; data: ApiClientAsset }>('GET', `/assets/${id}`),
      create: (payload: CreateAssetPayload) =>
        this.request<{ success: true; data: ApiClientAsset }>('POST', '/assets', payload),
      update: (id: string, payload: UpdateAssetPayload) =>
        this.request<{ success: true; data: ApiClientAsset }>('PATCH', `/assets/${id}`, payload),
      deactivate: (id: string) =>
        this.request<{ success: true; data: ApiClientAsset }>('DELETE', `/assets/${id}`),
    };
  }

  get trips() {
    return {
      start: (payload: StartTripPayload) =>
        this.request<{ success: true; data: ApiClientTrip }>('POST', '/trips', payload),
      postLocations: (id: string, payload: PostTripLocationsPayload) =>
        this.request<{ success: true; data: { inserted: number } }>(
          'POST',
          `/trips/${id}/locations`,
          payload
        ),
      getTrack: (id: string) =>
        this.request<{ success: true; data: TripTrack }>('GET', `/trips/${id}/track`),
      end: (id: string, payload: EndTripPayload) =>
        this.request<{ success: true; data: ApiClientTrip }>('POST', `/trips/${id}/end`, payload),
    };
  }

  get nfcEvents() {
    return {
      recordArrival: (payload: SiteArrivalPayload) =>
        this.request<{ success: true; data: SiteArrivalResponse }>('POST', '/nfc-events', payload),
    };
  }

  get workPermits() {
    return {
      list: (params?: { page?: number; per_page?: number; status?: WorkPermitStatus }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        if (params?.status) qs.set('status', params.status);
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientWorkPermit>>('GET', `/work-permits${query}`);
      },
      get: (id: string) =>
        this.request<{ success: true; data: ApiClientWorkPermitDetail }>('GET', `/work-permits/${id}`),
      create: (payload: CreateWorkPermitPayload) =>
        this.request<{ success: true; data: ApiClientWorkPermit }>('POST', '/work-permits', payload),
      withdraw: (id: string, payload: WithdrawPermitPayload) =>
        this.request<{ success: true; data: ApiClientWorkPermit }>('POST', `/work-permits/${id}/withdraw`, payload),
    };
  }

  get assetInspections() {
    return {
      list: (params?: { page?: number; per_page?: number; status?: InspectionStatus; trip_id?: string }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        if (params?.status) qs.set('status', params.status);
        if (params?.trip_id) qs.set('trip_id', params.trip_id);
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientAssetInspection>>('GET', `/asset-inspections${query}`);
      },
      get: (id: string) =>
        this.request<{ success: true; data: ApiClientAssetInspection & { asset_changes: ApiClientAssetChange[] } }>(
          'GET',
          `/asset-inspections/${id}`
        ),
      submit: (payload: SubmitInspectionPayload) =>
        this.request<{ success: true; data: ApiClientAssetInspection }>('POST', '/asset-inspections', payload),
    };
  }

  get assetChanges() {
    return {
      list: (params?: { page?: number; per_page?: number; status?: ApprovalStatus; asset_id?: string }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        if (params?.status) qs.set('status', params.status);
        if (params?.asset_id) qs.set('asset_id', params.asset_id);
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientAssetChange>>('GET', `/asset-changes${query}`);
      },
      review: (id: string, payload: ReviewChangePayload) =>
        this.request<{ success: true; data: ApiClientAssetChange; warning?: string }>(
          'PATCH',
          `/asset-changes/${id}/approve`,
          payload
        ),
    };
  }

  get reports() {
    return {
      list: (params?: { page?: number; per_page?: number; cadence?: ReportCadence }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        if (params?.cadence) qs.set('cadence', params.cadence);
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientReportListItem>>('GET', `/reports${query}`);
      },
      get: (id: string) =>
        this.request<{ success: true; data: ApiClientReport }>('GET', `/reports/${id}`),
      generate: (payload: GenerateReportPayload) =>
        this.request<{ success: true; data: ApiClientReport }>('POST', '/reports/generate', payload),
      verify: (id: string) =>
        this.request<{ success: true; data: VerifyReportResult }>('POST', `/reports/${id}/verify`),
      regeneratePdf: (id: string) =>
        this.request<{ success: true; data: { report_id: string; message: string } }>(
          'POST',
          `/reports/${id}/regenerate-pdf`
        ),
    };
  }

  get followUpTasks() {
    return {
      list: (params?: { page?: number; per_page?: number; asset_id?: string; resolved?: boolean }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        if (params?.asset_id) qs.set('asset_id', params.asset_id);
        if (params?.resolved !== undefined) qs.set('resolved', String(params.resolved));
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientFollowUpTask>>('GET', `/follow-up-tasks${query}`);
      },
      get: (id: string) =>
        this.request<{ success: true; data: ApiClientFollowUpTask }>('GET', `/follow-up-tasks/${id}`),
      resolve: (id: string, payload: ResolveFollowUpTaskPayload) =>
        this.request<{ success: true; data: ApiClientFollowUpTask }>('PATCH', `/follow-up-tasks/${id}/resolve`, payload),
    };
  }

  get safetyReports() {
    return {
      list: (params?: { page?: number; per_page?: number; trip_id?: string }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        if (params?.trip_id) qs.set('trip_id', params.trip_id);
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientSafetyReport>>('GET', `/safety-reports${query}`);
      },
      get: (id: string) =>
        this.request<{ success: true; data: ApiClientSafetyReport }>('GET', `/safety-reports/${id}`),
    };
  }

  get users() {
    return {
      list: (params?: { page?: number; per_page?: number }) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.per_page) qs.set('per_page', String(params.per_page));
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request<PaginatedResponse<ApiClientUser>>('GET', `/users${query}`);
      },
      get: (id: string) =>
        this.request<{ success: true; data: ApiClientUser }>('GET', `/users/${id}`),
      create: (payload: CreateUserPayload) =>
        this.request<{ success: true; data: ApiClientUser }>('POST', '/users', payload),
      update: (id: string, payload: UpdateUserPayload) =>
        this.request<{ success: true; data: ApiClientUser }>('PATCH', `/users/${id}`, payload),
      deactivate: (id: string) =>
        this.request<{ success: true; data: ApiClientUser }>('DELETE', `/users/${id}`),
    };
  }
}

export type InspectionStatus = 'open' | 'pending' | 'incomplete' | 'deferred';
export type IncompleteReason = 'device_failure' | 'safety_hazard' | 'access_restricted' | 'equipment_missing';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApiClientAssetInspection {
  id: string;
  trip_id: string;
  asset_id: string;
  submitted_by: string;
  status: InspectionStatus;
  form_data: Record<string, unknown>;
  incomplete_reason: IncompleteReason | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface SubmitInspectionPayload {
  trip_id: string;
  asset_id: string;
  status: InspectionStatus;
  form_data: Record<string, unknown>;
  incomplete_reason?: IncompleteReason;
  idempotency_key: string;
}

export interface ApiClientAssetChange {
  id: string;
  inspection_id: string;
  asset_id: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ReviewChangePayload {
  action: 'approve' | 'reject';
  notes?: string;
}

export type ReportCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'bi_yearly' | 'yearly';

export interface ApiClientReportSummary {
  total_permits: number;
  completed_permits: number;
  incomplete_permits: number;
  suspended_permits: number;
  total_trips: number;
  total_inspections: number;
  approved_changes: number;
  rejected_changes: number;
  safety_reports: number;
  total_nfc_events: number;
}

export interface ApiClientReportData {
  period_start: string;
  period_end: string;
  cadence: ReportCadence;
  summary: ApiClientReportSummary;
  by_asset_type: Array<{ asset_type: string; inspection_count: number; change_count: number }>;
  by_engineer: Array<{ engineer_id: string; permit_count: number; approval_count: number }>;
}

export interface ApiClientReport {
  id: string;
  cadence: ReportCadence;
  period_start: string;
  period_end: string;
  data: ApiClientReportData;
  sha256: string;
  pdf_url: string | null;
  csv_sent_at: string | null;
  generated_at: string;
}

export interface ApiClientReportListItem extends Omit<ApiClientReport, 'data'> {}

export interface GenerateReportPayload {
  cadence: ReportCadence;
  period_start: string;
  period_end: string;
}

export interface VerifyReportResult {
  report_id: string;
  match: boolean;
  stored_hash: string;
  actual_hash: string;
}

export interface ApiClientFollowUpTask {
  id: string;
  inspection_id: string;
  asset_id: string;
  assigned_to: string | null;
  partial_form_data: Record<string, unknown>;
  notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResolveFollowUpTaskPayload {
  notes?: string;
}

export interface ApiClientSafetyReport {
  id: string;
  report_number: string;
  inspection_id: string;
  trip_id: string;
  reported_by: string;
  hazard_description: string;
  photo_urls: string[];
  created_at: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
