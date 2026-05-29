import { launcherFetch } from "@/api/http"

type ErrorExtraction = "simple" | "json-errors" | "text-detail"

export async function extractApiError(res: Response): Promise<string> {
  try {
    const raw = await res.text()
    if (raw.trim() === "") {
      return `API error: ${res.status} ${res.statusText}`
    }
    try {
      const body = JSON.parse(raw) as {
        error?: string
        errors?: string[]
      }
      if (Array.isArray(body.errors) && body.errors.length > 0) {
        return body.errors.join("; ")
      }
      if (typeof body.error === "string" && body.error.trim() !== "") {
        return body.error
      }
    } catch {
      return raw.trim()
    }
  } catch {
    // ignore invalid body
  }
  return `API error: ${res.status} ${res.statusText}`
}

async function extractSimpleError(res: Response): Promise<string> {
  return `API error: ${res.status} ${res.statusText}`
}

async function extractJsonErrors(res: Response): Promise<string> {
  let message = `API error: ${res.status} ${res.statusText}`
  try {
    const body = (await res.json()) as {
      error?: string
      errors?: string[]
      status?: string
    }
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      message = body.errors.join("; ")
    } else if (typeof body.error === "string" && body.error.trim() !== "") {
      message = body.error
    }
  } catch {
    // Keep default fallback message if response body is not JSON.
  }
  return message
}

async function extractTextDetail(res: Response): Promise<string> {
  const message = await res.text()
  return message || `API error: ${res.status} ${res.statusText}`
}

const EXTRACTORS: Record<ErrorExtraction, (res: Response) => Promise<string>> =
  {
    simple: extractSimpleError,
    "json-errors": extractJsonErrors,
    "text-detail": extractTextDetail,
  }

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
  extraction: ErrorExtraction = "json-errors",
): Promise<T> {
  const res = await launcherFetch(path, options)
  if (!res.ok) {
    throw new Error(await EXTRACTORS[extraction](res))
  }
  return res.json() as Promise<T>
}
