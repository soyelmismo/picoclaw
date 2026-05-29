export function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export function asBool(value: unknown): boolean {
  return value === true
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}
