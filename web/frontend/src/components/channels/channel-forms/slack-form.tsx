import { useTranslation } from "react-i18next"

import type { ChannelConfig } from "@/api/channels"
import { type ArrayFieldFlusher } from "@/components/channels/channel-array-list-field"
import { AllowFromField } from "@/components/channels/allow-from-field"
import { getSecretInputPlaceholder } from "@/components/channels/channel-config-fields"
import { Field, KeyInput } from "@/components/shared-form"
import { asString } from "@/lib/type-coerce"
import { Card, CardContent } from "@/components/ui/card"

interface SlackFormProps {
  config: ChannelConfig
  onChange: (key: string, value: unknown) => void
  configuredSecrets: string[]
  fieldErrors?: Record<string, string>
  registerArrayFieldFlusher?: (
    fieldPath: string,
    flusher: ArrayFieldFlusher | null,
  ) => void
  arrayFieldResetVersion?: number
}

export function SlackForm({
  config,
  onChange,
  configuredSecrets,
  fieldErrors = {},
  registerArrayFieldFlusher,
  arrayFieldResetVersion,
}: SlackFormProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardContent className="divide-border/60 divide-y px-6 py-0 [&>div]:py-5">
          <Field
            label={t("channels.field.botToken")}
            required
            hint={t("channels.form.desc.botToken")}
            error={fieldErrors.bot_token}
          >
            <KeyInput
              value={asString(config._bot_token)}
              onChange={(v) => onChange("_bot_token", v)}
              placeholder={getSecretInputPlaceholder(
                configuredSecrets,
                "bot_token",
                t("channels.field.secretHintSet"),
                "xoxb-xxxx",
              )}
            />
          </Field>

          <Field
            label={t("channels.field.appToken")}
            hint={t("channels.form.desc.appToken")}
          >
            <KeyInput
              value={asString(config._app_token)}
              onChange={(v) => onChange("_app_token", v)}
              placeholder={getSecretInputPlaceholder(
                configuredSecrets,
                "app_token",
                t("channels.field.secretHintSet"),
                "xapp-xxxx",
              )}
            />
          </Field>
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
        </CardContent>
      </Card>
    </div>
  )
}
