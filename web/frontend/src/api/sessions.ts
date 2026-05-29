import { apiRequest } from "@/api/request"

export interface SessionSummary {
  id: string
  title: string
  preview: string
  message_count: number
  created: string
  updated: string
}

export interface SessionDetail {
  id: string
  messages: {
    role: "user" | "assistant"
    content: string
    created_at?: string
    kind?: "normal" | "thought" | "tool_calls"
    model_name?: string
    media?: string[]
    attachments?: {
      type?: "image" | "audio" | "video" | "file"
      url: string
      filename?: string
      content_type?: string
    }[]
    tool_calls?: {
      id?: string
      type?: string
      function?: {
        name?: string
        arguments?: string
      }
      extra_content?: {
        tool_feedback_explanation?: string
      }
    }[]
  }[]
  summary: string
  created: string
  updated: string
}

export async function getSessions(
  offset: number = 0,
  limit: number = 20,
): Promise<SessionSummary[]> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
  })
  return apiRequest<SessionSummary[]>(
    `/api/sessions?${params.toString()}`,
    undefined,
    "simple",
  )
}

export async function getSessionHistory(id: string): Promise<SessionDetail> {
  return apiRequest<SessionDetail>(
    `/api/sessions/${encodeURIComponent(id)}`,
    undefined,
    "simple",
  )
}

export async function deleteSession(id: string): Promise<void> {
  await apiRequest<Record<string, never>>(
    `/api/sessions/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "simple",
  )
}
