import { IconCheck, IconLoader2, IconQrcode, IconRefresh, IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

import type { BindingState } from "@/hooks/use-qr-binding-flow"
import { Button } from "@/components/ui/button"

export interface QRBindingSectionProps {
  bindState: BindingState
  qrDataURI: string | null
  entityId: string | null
  existingId: string
  isBound: boolean
  i18nPrefix: string
  channelLabel: string
  errorMsg?: string
  onBind: () => void
  onRebind: () => void
}

export function QRBindingSection({
  bindState,
  qrDataURI,
  entityId,
  existingId,
  isBound,
  i18nPrefix,
  channelLabel,
  errorMsg,
  onBind,
  onRebind,
}: QRBindingSectionProps) {
  const { t } = useTranslation()

  if (bindState === "idle") {
    if (isBound) {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <IconCheck size={16} />
            {t(`${i18nPrefix}.bound`)}
          </div>
          {existingId && (
            <p className="text-muted-foreground font-mono text-xs">
              {existingId}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRebind}
            className="mt-1 gap-2"
          >
            <IconRefresh size={14} />
            {t(`${i18nPrefix}.rebind`)}
          </Button>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="text-muted-foreground text-sm">
          {t(`${i18nPrefix}.notBound`)}
        </p>
        <Button onClick={onBind} className="gap-2">
          <IconQrcode size={16} />
          {t(`${i18nPrefix}.bind`)}
        </Button>
      </div>
    )
  }

  if (bindState === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <IconLoader2
          className="text-muted-foreground animate-spin"
          size={32}
        />
        <p className="text-muted-foreground text-sm">
          {t(`${i18nPrefix}.generating`)}
        </p>
      </div>
    )
  }

  if (bindState === "waiting" || bindState === "scaned") {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        {qrDataURI ? (
          <img
            src={qrDataURI}
            alt={`${channelLabel} QR Code`}
            className="border-border/60 h-48 w-48 rounded-xl border bg-white p-2 shadow-sm"
          />
        ) : (
          <div className="border-border/60 bg-muted flex h-48 w-48 items-center justify-center rounded-xl border">
            <IconLoader2
              className="text-muted-foreground animate-spin"
              size={32}
            />
          </div>
        )}
        {bindState === "scaned" ? (
          <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            <IconLoader2 size={14} className="animate-spin" />
            {t(`${i18nPrefix}.scanned`)}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t(`${i18nPrefix}.scanHint`)}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRebind}
          className="text-muted-foreground"
        >
          <IconRefresh size={14} className="mr-1" />
          {t(`${i18nPrefix}.refresh`)}
        </Button>
      </div>
    )
  }

  if (bindState === "confirmed") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
          <IconCheck
            size={28}
            className="text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {t(`${i18nPrefix}.bound`)}
        </p>
        {entityId && (
          <p className="text-muted-foreground font-mono text-xs">
            {entityId}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRebind}
          className="mt-1 gap-2"
        >
          <IconRefresh size={14} />
          {t(`${i18nPrefix}.rebind`)}
        </Button>
      </div>
    )
  }

  if (bindState === "expired") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <IconX size={28} className="text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {t(`${i18nPrefix}.expired`)}
        </p>
        <Button onClick={onRebind} className="gap-2">
          <IconRefresh size={14} />
          {t(`${i18nPrefix}.retry`)}
        </Button>
      </div>
    )
  }

  if (bindState === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="bg-destructive/10 flex h-14 w-14 items-center justify-center rounded-full">
          <IconX size={28} className="text-destructive" />
        </div>
        <p className="text-destructive text-sm">
          {errorMsg || t(`${i18nPrefix}.errorGeneric`)}
        </p>
        <Button variant="outline" onClick={onRebind} className="gap-2">
          <IconRefresh size={14} />
          {t(`${i18nPrefix}.retry`)}
        </Button>
      </div>
    )
  }

  return null
}
