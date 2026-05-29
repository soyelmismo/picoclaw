import { apiRequest } from "@/api/request"

export interface AutoStartStatus {
  enabled: boolean
  supported: boolean
  platform: string
  message?: string
}

export interface LauncherConfig {
  port: number
  public: boolean
  allowed_cidrs: string[]
}

export interface SystemVersionInfo {
  version: string
  git_commit?: string
  build_time?: string
  go_version: string
}

export async function getAutoStartStatus(): Promise<AutoStartStatus> {
  return apiRequest<AutoStartStatus>("/api/system/autostart")
}

export async function setAutoStartEnabled(
  enabled: boolean,
): Promise<AutoStartStatus> {
  return apiRequest<AutoStartStatus>("/api/system/autostart", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  })
}

export async function getLauncherConfig(): Promise<LauncherConfig> {
  return apiRequest<LauncherConfig>("/api/system/launcher-config")
}

export async function setLauncherConfig(
  payload: LauncherConfig,
): Promise<LauncherConfig> {
  return apiRequest<LauncherConfig>("/api/system/launcher-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function getSystemVersionInfo(): Promise<SystemVersionInfo> {
  return apiRequest<SystemVersionInfo>("/api/system/version")
}
