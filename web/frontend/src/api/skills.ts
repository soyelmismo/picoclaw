import { apiRequest } from "@/api/request"

export interface SkillSupportItem {
  name: string
  path: string
  source: "workspace" | "global" | "builtin" | string
  description: string
  origin_kind: "builtin" | "third_party" | "manual" | string
  registry_name?: string
  registry_url?: string
  installed_version?: string
  installed_at?: number
}

export interface SkillDetailResponse extends SkillSupportItem {
  content: string
}

export interface SkillRegistrySearchResult {
  score: number
  slug: string
  display_name: string
  summary: string
  version: string
  registry_name: string
  url?: string
  installed: boolean
  installed_name?: string
}

interface SkillsResponse {
  skills: SkillSupportItem[]
}

export interface SkillSearchResponse {
  results: SkillRegistrySearchResult[]
  limit: number
  offset: number
  next_offset?: number
  has_more: boolean
}

type SkillActionResponse = Partial<SkillSupportItem> & {
  status?: string
}

export interface InstallSkillRequest {
  slug: string
  registry: string
  version?: string
  force?: boolean
}

export interface InstallSkillResponse {
  status: string
  slug: string
  registry: string
  version: string
  summary?: string
  is_suspicious?: boolean
  skill?: SkillSupportItem
}

export async function getSkills(): Promise<SkillsResponse> {
  return apiRequest<SkillsResponse>("/api/skills")
}

export async function getSkill(name: string): Promise<SkillDetailResponse> {
  return apiRequest<SkillDetailResponse>(
    `/api/skills/${encodeURIComponent(name)}`,
  )
}

export async function searchSkills(
  query: string,
  limit = 20,
  offset = 0,
): Promise<SkillSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
  })
  return apiRequest<SkillSearchResponse>(
    `/api/skills/search?${params.toString()}`,
  )
}

export async function installSkill(
  input: InstallSkillRequest,
): Promise<InstallSkillResponse> {
  return apiRequest<InstallSkillResponse>("/api/skills/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
}

export async function importSkill(file: File): Promise<SkillActionResponse> {
  const formData = new FormData()
  formData.set("file", file)
  return apiRequest<SkillActionResponse>("/api/skills/import", {
    method: "POST",
    body: formData,
  })
}

export async function deleteSkill(name: string): Promise<SkillActionResponse> {
  return apiRequest<SkillActionResponse>(
    `/api/skills/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
    },
  )
}
