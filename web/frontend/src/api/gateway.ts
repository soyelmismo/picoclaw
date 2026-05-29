import { apiRequest } from "@/api/request"

// API client for gateway process management.

interface GatewayStatusResponse {
  gateway_status: "running" | "starting" | "restarting" | "stopped" | "error"
  gateway_start_allowed?: boolean
  gateway_start_reason?: string
  gateway_restart_required?: boolean
  pid?: number
  boot_default_model?: string
  config_default_model?: string
  [key: string]: unknown
}

interface GatewayLogsResponse {
  logs?: string[]
  log_total?: number
  log_run_id?: number
}

interface GatewayActionResponse {
  status: string
  pid?: number
  log_total?: number
  log_run_id?: number
}

export async function getGatewayStatus(): Promise<GatewayStatusResponse> {
  return apiRequest<GatewayStatusResponse>(
    "/api/gateway/status",
    undefined,
    "simple",
  )
}

export async function getGatewayLogs(options?: {
  log_offset?: number
  log_run_id?: number
}): Promise<GatewayLogsResponse> {
  const params = new URLSearchParams()
  if (options?.log_offset !== undefined) {
    params.set("log_offset", options.log_offset.toString())
  }
  if (options?.log_run_id !== undefined) {
    params.set("log_run_id", options.log_run_id.toString())
  }
  const queryString = params.toString() ? `?${params.toString()}` : ""
  return apiRequest<GatewayLogsResponse>(
    `/api/gateway/logs${queryString}`,
    undefined,
    "simple",
  )
}

export async function startGateway(): Promise<GatewayActionResponse> {
  return apiRequest<GatewayActionResponse>(
    "/api/gateway/start",
    {
      method: "POST",
    },
    "simple",
  )
}

export async function stopGateway(): Promise<GatewayActionResponse> {
  return apiRequest<GatewayActionResponse>(
    "/api/gateway/stop",
    {
      method: "POST",
    },
    "simple",
  )
}

export async function restartGateway(): Promise<GatewayActionResponse> {
  return apiRequest<GatewayActionResponse>(
    "/api/gateway/restart",
    {
      method: "POST",
    },
    "simple",
  )
}

export async function clearGatewayLogs(): Promise<GatewayActionResponse> {
  return apiRequest<GatewayActionResponse>(
    "/api/gateway/logs/clear",
    {
      method: "POST",
    },
    "simple",
  )
}

export type {
  GatewayStatusResponse,
  GatewayLogsResponse,
  GatewayActionResponse,
}
