import { apiRequest } from "@/api/request"

// API client for Pico Channel configuration.

interface PicoInfoResponse {
  ws_url: string
  enabled: boolean
  configured?: boolean
}

interface PicoSetupResponse {
  ws_url: string
  enabled: boolean
  configured?: boolean
  changed: boolean
}

export async function getPicoInfo(): Promise<PicoInfoResponse> {
  return apiRequest<PicoInfoResponse>(
    "/api/pico/info",
    undefined,
    "simple",
  )
}

export async function regenPicoToken(): Promise<PicoInfoResponse> {
  return apiRequest<PicoInfoResponse>(
    "/api/pico/token",
    { method: "POST" },
    "simple",
  )
}

export async function setupPico(): Promise<PicoSetupResponse> {
  return apiRequest<PicoSetupResponse>(
    "/api/pico/setup",
    { method: "POST" },
    "simple",
  )
}

export type { PicoInfoResponse, PicoSetupResponse }
