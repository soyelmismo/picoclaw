import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

export type BindingState =
  | "idle"
  | "loading"
  | "waiting"
  | "scaned"
  | "confirmed"
  | "expired"
  | "error"

export interface QRFlowResponse {
  flow_id: string
  status: "wait" | "scaned" | "confirmed" | "expired" | "error"
  qr_data_uri?: string
  error?: string
  [key: string]: unknown
}

export interface QRBindingFlowConfig {
  startFlow: () => Promise<QRFlowResponse>
  pollFlow: (flowId: string) => Promise<QRFlowResponse>
  getEntityId: (response: QRFlowResponse) => string | undefined
  i18nPrefix: string
  existingId?: string
  onBindSuccess?: () => void
}

export function useQRBindingFlow(config: QRBindingFlowConfig) {
  const {
    startFlow,
    pollFlow,
    getEntityId,
    i18nPrefix,
    existingId,
    onBindSuccess,
  } = config

  const { t } = useTranslation()

  const [bindState, setBindState] = useState<BindingState>("idle")
  const [qrDataURI, setQrDataURI] = useState<string | null>(null)
  const [entityId, setEntityId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollGenerationRef = useRef(0)

  const stopPolling = useCallback(() => {
    pollGenerationRef.current += 1
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  useEffect(() => {
    if (!existingId) return
    stopPolling()
    setEntityId(existingId)
    setBindState("confirmed")
    setErrorMsg("")
  }, [existingId, stopPolling])

  const startPolling = useCallback(
    (id: string) => {
      stopPolling()
      const generation = pollGenerationRef.current
      let inFlight = false
      pollTimerRef.current = setInterval(async () => {
        if (inFlight) return
        inFlight = true
        try {
          const resp = await pollFlow(id)
          if (generation !== pollGenerationRef.current) {
            return
          }
          if (resp.status === "scaned") {
            setBindState("scaned")
          } else if (resp.status === "confirmed") {
            stopPolling()
            setEntityId(getEntityId(resp) ?? existingId ?? null)
            setBindState("confirmed")
            onBindSuccess?.()
          } else if (resp.status === "expired") {
            stopPolling()
            setBindState("expired")
          } else if (resp.status === "error") {
            stopPolling()
            setBindState("error")
            setErrorMsg(resp.error ?? t(`${i18nPrefix}.errorGeneric`))
          }
        } catch {
          // transient network error — keep polling
        } finally {
          inFlight = false
        }
      }, 2000)
    },
    [existingId, stopPolling, onBindSuccess, t, i18nPrefix, pollFlow, getEntityId],
  )

  const handleBind = async () => {
    setBindState("loading")
    setErrorMsg("")
    setQrDataURI(null)
    stopPolling()
    try {
      const resp = await startFlow()
      setQrDataURI(resp.qr_data_uri ?? null)
      setBindState("waiting")
      startPolling(resp.flow_id)
    } catch (e) {
      setBindState("error")
      setErrorMsg(
        e instanceof Error ? e.message : t(`${i18nPrefix}.errorGeneric`),
      )
    }
  }

  const handleRebind = () => {
    stopPolling()
    setBindState("idle")
    setQrDataURI(null)
    setEntityId(null)
    setErrorMsg("")
    void handleBind()
  }

  const clearError = useCallback(() => setErrorMsg(""), [])

  return {
    bindState,
    qrDataURI,
    entityId,
    errorMsg,
    handleBind,
    handleRebind,
    clearError,
  }
}
