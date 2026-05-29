import { apiRequest } from "@/api/request"

export type ChannelConfig = Record<string, unknown>
export type AppConfig = Record<string, unknown>

export interface SupportedChannel {
  name: string
  display_name?: string
  config_key: string
  variant?: string
}

export interface ChannelConfigResponse {
  config: ChannelConfig
  configured_secrets: string[]
  config_key: string
  variant?: string
}

interface ChannelsCatalogResponse {
  channels: SupportedChannel[]
}

interface ConfigActionResponse {
  status: string
  errors?: string[]
}

export async function getChannelsCatalog(): Promise<ChannelsCatalogResponse> {
  return apiRequest<ChannelsCatalogResponse>("/api/channels/catalog")
}

export async function getAppConfig(): Promise<AppConfig> {
  return apiRequest<AppConfig>("/api/config")
}

export async function getChannelConfig(
  channelName: string,
): Promise<ChannelConfigResponse> {
  return apiRequest<ChannelConfigResponse>(
    `/api/channels/${encodeURIComponent(channelName)}/config`,
  )
}

export async function patchAppConfig(
  patch: Record<string, unknown>,
): Promise<ConfigActionResponse> {
  return apiRequest<ConfigActionResponse>("/api/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
}

export async function resetAppConfig(): Promise<ConfigActionResponse> {
  return apiRequest<ConfigActionResponse>("/api/config/reset", {
    method: "POST",
  })
}

// WeChat QR login flow API

export interface WeixinFlowResponse {
  flow_id: string
  status: "wait" | "scaned" | "confirmed" | "expired" | "error"
  qr_data_uri?: string
  account_id?: string
  error?: string
}

export interface WecomFlowResponse {
  flow_id: string
  status: "wait" | "scaned" | "confirmed" | "expired" | "error"
  qr_data_uri?: string
  bot_id?: string
  error?: string
}

export async function startWeixinFlow(): Promise<WeixinFlowResponse> {
  return apiRequest<WeixinFlowResponse>("/api/weixin/flows", {
    method: "POST",
  })
}

export async function pollWeixinFlow(
  flowID: string,
): Promise<WeixinFlowResponse> {
  return apiRequest<WeixinFlowResponse>(
    `/api/weixin/flows/${encodeURIComponent(flowID)}`,
  )
}

export async function startWecomFlow(): Promise<WecomFlowResponse> {
  return apiRequest<WecomFlowResponse>("/api/wecom/flows", { method: "POST" })
}

export async function pollWecomFlow(
  flowID: string,
): Promise<WecomFlowResponse> {
  return apiRequest<WecomFlowResponse>(
    `/api/wecom/flows/${encodeURIComponent(flowID)}`,
  )
}

export type { ChannelsCatalogResponse, ConfigActionResponse }
