import { apiRequest } from "@/api/request"
import { refreshGatewayState } from "@/store/gateway"

// API client for model list management.

export interface ModelInfo {
  index: number
  model_name: string
  provider?: string
  model: string
  api_base?: string
  api_key: string
  proxy?: string
  auth_method?: string
  // Advanced fields
  connect_mode?: string
  workspace?: string
  rpm?: number
  max_tokens_field?: string
  request_timeout?: number
  thinking_level?: string
  tool_schema_transform?: string
  streaming?: {
    enabled?: boolean
  }
  extra_body?: Record<string, unknown>
  custom_headers?: Record<string, string>
  // Meta
  enabled: boolean
  available: boolean
  status: "available" | "unconfigured" | "unreachable"
  is_default: boolean
  is_virtual: boolean
  default_model_allowed?: boolean
}

export interface ModelProviderOption {
  id: string
  display_name?: string
  icon_slug?: string
  domain?: string
  default_api_base: string
  empty_api_key_allowed: boolean
  create_allowed: boolean
  default_model_allowed: boolean
  supports_fetch?: boolean
  default_auth_method?: string
  auth_method_locked?: boolean
  local?: boolean
  priority?: number
  common_models?: string[]
  aliases?: string[]
}

interface ModelsListResponse {
  models: ModelInfo[]
  total: number
  default_model: string
  provider_options: ModelProviderOption[]
}

interface ModelActionResponse {
  status: string
  index?: number
  default_model?: string
}

export async function getModels(): Promise<ModelsListResponse> {
  return apiRequest<ModelsListResponse>("/api/models", undefined, "text-detail")
}

export async function addModel(
  model: Partial<ModelInfo>,
): Promise<ModelActionResponse> {
  return apiRequest<ModelActionResponse>(
    "/api/models",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model),
    },
    "text-detail",
  )
}

export async function updateModel(
  index: number,
  model: Partial<ModelInfo>,
): Promise<ModelActionResponse> {
  return apiRequest<ModelActionResponse>(
    `/api/models/${index}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model),
    },
    "text-detail",
  )
}

export async function deleteModel(index: number): Promise<ModelActionResponse> {
  return apiRequest<ModelActionResponse>(
    `/api/models/${index}`,
    {
      method: "DELETE",
    },
    "text-detail",
  )
}

export async function setDefaultModel(
  modelName: string,
): Promise<ModelActionResponse> {
  const response = await apiRequest<ModelActionResponse>(
    "/api/models/default",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_name: modelName }),
    },
    "text-detail",
  )

  await refreshGatewayState()
  return response
}

export interface TestModelResponse {
  success: boolean
  latency_ms: number
  status: string
  error?: string
}

export async function testModel(index: number): Promise<TestModelResponse> {
  return apiRequest<TestModelResponse>(
    `/api/models/${index}/test`,
    {
      method: "POST",
    },
    "text-detail",
  )
}

export interface TestModelInlineRequest {
  provider: string
  model: string
  api_base?: string
  api_key?: string
  auth_method?: string
  model_index?: number
}

export async function testModelInline(
  params: TestModelInlineRequest,
): Promise<TestModelResponse> {
  return apiRequest<TestModelResponse>(
    "/api/models/test-inline",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    "text-detail",
  )
}

export interface UpstreamModel {
  id: string
  owned_by?: string
  extra?: Record<string, unknown>
}

export interface FetchModelsRequest {
  provider: string
  api_key?: string
  api_base?: string
  model_index?: number
}

export interface FetchModelsResponse {
  models: UpstreamModel[]
  total: number
}

export async function fetchUpstreamModels(
  req: FetchModelsRequest,
): Promise<FetchModelsResponse> {
  return apiRequest<FetchModelsResponse>(
    "/api/models/fetch",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    },
    "text-detail",
  )
}

// --- Model Catalog API ---

export interface CatalogModel {
  id: string
  owned_by?: string
  extra?: Record<string, unknown>
}

export interface CatalogEntry {
  id: string
  provider: string
  api_base: string
  api_key_mask: string
  models: CatalogModel[]
  fetched_at: string
}

interface CatalogListResponse {
  entries: CatalogEntry[]
  total: number
}

export async function getCatalogs(): Promise<CatalogListResponse> {
  return apiRequest<CatalogListResponse>(
    "/api/models/catalog",
    undefined,
    "text-detail",
  )
}

export async function deleteCatalog(id: string): Promise<void> {
  await apiRequest<Record<string, never>>(
    `/api/models/catalog/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
    "text-detail",
  )
}

export type { ModelsListResponse, ModelActionResponse }
