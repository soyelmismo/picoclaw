import { apiRequest } from "@/api/request"

export type OAuthProvider = "openai" | "anthropic" | "google-antigravity"
export type OAuthMethod = "browser" | "device_code" | "token"

export interface OAuthProviderStatus {
  provider: OAuthProvider
  display_name: string
  methods: OAuthMethod[]
  logged_in: boolean
  status: "connected" | "expired" | "needs_refresh" | "not_logged_in"
  auth_method?: string
  expires_at?: string
  account_id?: string
  email?: string
  project_id?: string
}

export interface OAuthFlowState {
  flow_id: string
  provider: OAuthProvider
  method: OAuthMethod
  status: "pending" | "success" | "error" | "expired"
  expires_at?: string
  error?: string
  user_code?: string
  verify_url?: string
  interval?: number
}

export interface OAuthLoginRequest {
  provider: OAuthProvider
  method: OAuthMethod
  token?: string
}

export interface OAuthLoginResponse {
  status: string
  provider: OAuthProvider
  method: OAuthMethod
  flow_id?: string
  auth_url?: string
  user_code?: string
  verify_url?: string
  interval?: number
  expires_at?: string
}

interface OAuthProvidersResponse {
  providers: OAuthProviderStatus[]
}

export async function getOAuthProviders(): Promise<OAuthProvidersResponse> {
  return apiRequest<OAuthProvidersResponse>(
    "/api/oauth/providers",
    undefined,
    "text-detail",
  )
}

export async function loginOAuth(
  payload: OAuthLoginRequest,
): Promise<OAuthLoginResponse> {
  return apiRequest<OAuthLoginResponse>(
    "/api/oauth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "text-detail",
  )
}

export async function getOAuthFlow(flowID: string): Promise<OAuthFlowState> {
  return apiRequest<OAuthFlowState>(
    `/api/oauth/flows/${encodeURIComponent(flowID)}`,
    undefined,
    "text-detail",
  )
}

export async function pollOAuthFlow(flowID: string): Promise<OAuthFlowState> {
  return apiRequest<OAuthFlowState>(
    `/api/oauth/flows/${encodeURIComponent(flowID)}/poll`,
    {
      method: "POST",
    },
    "text-detail",
  )
}

export async function logoutOAuth(
  provider: OAuthProvider,
): Promise<{ status: string; provider: OAuthProvider }> {
  return apiRequest<{ status: string; provider: OAuthProvider }>(
    "/api/oauth/logout",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    },
    "text-detail",
  )
}
