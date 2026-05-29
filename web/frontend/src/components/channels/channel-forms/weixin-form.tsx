import { useTranslation } from "react-i18next"

import type { ChannelConfig } from "@/api/channels"
import { pollWeixinFlow, startWeixinFlow } from "@/api/channels"
import { type ArrayFieldFlusher } from "@/components/channels/channel-array-list-field"
import { AllowFromField } from "@/components/channels/allow-from-field"
import { QRBindingSection } from "@/components/channels/qr-binding-section"
import { asString } from "@/lib/type-coerce"
import { Field } from "@/components/shared-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useQRBindingFlow } from "@/hooks/use-qr-binding-flow"

interface WeixinFormProps {
  config: ChannelConfig
  onChange: (key: string, value: unknown) => void
  isEdit: boolean
  onBindSuccess?: () => void
  registerArrayFieldFlusher?: (
    fieldPath: string,
    flusher: ArrayFieldFlusher | null,
  ) => void
  arrayFieldResetVersion?: number
}

export function WeixinForm({
  config,
  onChange,
  isEdit,
  onBindSuccess,
  registerArrayFieldFlusher,
  arrayFieldResetVersion,
}: WeixinFormProps) {
  const { t } = useTranslation()

  const existingAccountID = asString(config.account_id)
  const isBound = isEdit && existingAccountID !== ""

  const {
    bindState,
    qrDataURI,
    entityId,
    errorMsg,
    handleBind,
    handleRebind,
  } = useQRBindingFlow({
    startFlow: startWeixinFlow,
    pollFlow: pollWeixinFlow,
    getEntityId: (resp) => resp.account_id,
    i18nPrefix: "channels.weixin",
    existingId: existingAccountID,
    onBindSuccess,
  })

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="border-border/60 border-b px-6">
          <CardTitle className="text-foreground text-sm font-medium">
            {t("channels.weixin.bindTitle")}
          </CardTitle>
          <CardDescription>{t("channels.weixin.bindDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <QRBindingSection
            bindState={bindState}
            qrDataURI={qrDataURI}
            entityId={entityId}
            existingId={existingAccountID}
            isBound={isBound}
            i18nPrefix="channels.weixin"
            channelLabel="WeChat"
            errorMsg={errorMsg}
            onBind={handleBind}
            onRebind={handleRebind}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="divide-border/60 divide-y px-6 py-0 [&>div]:py-5">
          <AllowFromField
            value={config.allow_from}
            onChange={(value) => onChange("allow_from", value)}
            registerFlusher={registerArrayFieldFlusher}
            resetVersion={arrayFieldResetVersion}
          />

          <Field
            label={t("channels.field.proxy")}
            hint={t("channels.form.desc.proxy")}
          >
            <Input
              value={asString(config.proxy)}
              onChange={(e) => onChange("proxy", e.target.value)}
              placeholder="http://localhost:7890"
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  )
}
