import { useAtomValue } from "jotai"
import { useCallback, useEffect, useState } from "react"

import { restartGateway, startGateway, stopGateway } from "@/api/gateway"
import {
  beginGatewayStoppingTransition,
  cancelGatewayStoppingTransition,
  gatewayAtom,
  refreshGatewayState,
  subscribeGatewayPolling,
  updateGatewayStore,
} from "@/store"

export function useGateway() {
  const gateway = useAtomValue(gatewayAtom)
  const { status: state, canStart, startReason, restartRequired } = gateway
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return subscribeGatewayPolling()
  }, [])

  const withGatewayAction = useCallback(
    async (action: () => Promise<void>, label: string) => {
      setError(null)
      setLoading(true)
      try {
        await action()
      } catch (err) {
        console.error(`Failed to ${label} gateway:`, err)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        await refreshGatewayState({ force: true })
        setLoading(false)
      }
    },
    [],
  )

  const start = useCallback(async () => {
    if (!canStart) return
    await withGatewayAction(async () => {
      await startGateway()
      updateGatewayStore({
        status: "starting",
        restartRequired: false,
      })
    }, "start")
  }, [canStart, withGatewayAction])

  const stop = useCallback(async () => {
    await withGatewayAction(async () => {
      beginGatewayStoppingTransition()
      try {
        await stopGateway()
      } catch (err) {
        cancelGatewayStoppingTransition()
        throw err
      }
    }, "stop")
  }, [withGatewayAction])

  const restart = useCallback(async () => {
    if (state !== "running") return
    await withGatewayAction(async () => {
      await restartGateway()
      updateGatewayStore({
        status: "restarting",
        restartRequired: false,
      })
    }, "restart")
  }, [state, withGatewayAction])

  return {
    state,
    loading,
    canStart,
    startReason,
    restartRequired,
    start,
    stop,
    restart,
    error,
  }
}
