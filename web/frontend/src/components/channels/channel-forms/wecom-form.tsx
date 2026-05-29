import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type { ChannelConfig } from "@/api/channels"
import { patchAppConfig, pollWecomFlow, startWecomFlow } from "@/api/channels"
import { QRBindingSection } from "@/components/channels/qr-binding-section"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { asString } from "@/lib/type-coerce"
import { useQRBindingFlow } from "@/hooks/use-qr-binding-flow"

interface WecomFormProps {
  config: ChannelConfig
  isEdit: boolean
  onBindSuccess?: () => void
  onEnabledChange?: (enabled: boolean) => void
}

export function WecomForm({
  config,
  isEdit,
  onBindSuccess,
  onEnabledChange,
}: WecomFormProps) {
  const { t } = useTranslation()

  const existingBotID = asString(config.bot_id)
  const isBound = isEdit && existingBotID !== ""

  const [enabled, setEnabled] = useState(config.enabled === true)
  const [toggleSaving, setToggleSaving] = useState(false)
  const [toggleError, setToggleError] = useState("")

  useEffect(() => {
    setEnabled(config.enabled === true)
  }, [config.enabled])

  const {
    bindState,
    qrDataURI,
    entityId,
    errorMsg,
    handleBind,
    handleRebind,
  } = useQRBindingFlow({
    startFlow: startWecomFlow,
    pollFlow: pollWecomFlow,
    getEntityId: (resp) => resp.bot_id,
    i18nPrefix: "channels.wecom",
    existingId: existingBotID,
    onBindSuccess,
  })

  const handleEnabledChange = useCallback(
    async (checked: boolean) => {
      if (!existingBotID || toggleSaving) {
        return
      }
      setToggleSaving(true)
      setToggleError("")
      try {
        await patchAppConfig({
          channel_list: {
            wecom: {
              enabled: checked,
              type: "wecom",
            },
          },
        })
        setEnabled(checked)
        onEnabledChange?.(checked)
      } catch (e) {
        setToggleError(
          e instanceof Error ? e.message : t("channels.wecom.errorGeneric"),
        )
      } finally {
        setToggleSaving(false)
      }
    },
    [existingBotID, onEnabledChange, t, toggleSaving],
  )

  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground border-border/60 flex items-center justify-between rounded-xl border px-6 py-4 shadow-sm">
        <p className="text-sm font-medium">{t("channels.page.enableLabel")}</p>
        <div className="flex flex-col items-end gap-2">
          <Switch
            checked={enabled}
            disabled={!isBound || toggleSaving}
            onCheckedChange={(checked) => void handleEnabledChange(checked)}
          />
          {toggleError && (
            <p className="text-destructive max-w-60 text-right text-xs leading-normal">
              {toggleError}
            </p>
          )}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-border/60 border-b px-6">
          <CardTitle className="text-foreground text-sm font-medium">
            {t("channels.wecom.bindTitle")}
          </CardTitle>
          <CardDescription>{t("channels.wecom.bindDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <QRBindingSection
            bindState={bindState}
            qrDataURI={qrDataURI}
            entityId={entityId}
            existingId={existingBotID}
            isBound={isBound}
            i18nPrefix="channels.wecom"
            channelLabel="WeCom"
            errorMsg={errorMsg}
            onBind={handleBind}
            onRebind={handleRebind}
          />
        </CardContent>
      </Card>
    </div>
  )
}
