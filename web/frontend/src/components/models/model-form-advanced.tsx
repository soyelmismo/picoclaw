import { AdvancedSection, Field, SwitchCardField } from "@/components/shared-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import type { ModelFormFields } from "./use-model-form"

interface ModelFormAdvancedProps {
  form: ModelFormFields
  setField: (
    key: keyof ModelFormFields,
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  setForm: React.Dispatch<React.SetStateAction<ModelFormFields>>
  authMethodLocked: boolean
  defaultAuthMethod: string
  t: (key: string) => string
}

export function ModelFormAdvanced({
  form,
  setField,
  setForm,
  authMethodLocked,
  defaultAuthMethod,
  t,
}: ModelFormAdvancedProps) {
  return (
    <AdvancedSection>
      <Field
        label={t("models.field.proxy")}
        hint={t("models.field.proxyHint")}
      >
        <Input
          value={form.proxy}
          onChange={setField("proxy")}
          placeholder="http://127.0.0.1:7890"
        />
      </Field>

      <Field
        label={t("models.field.authMethod")}
        hint={
          authMethodLocked
            ? t("models.field.authMethodManagedHint")
            : t("models.field.authMethodHint")
        }
      >
        <Input
          value={authMethodLocked ? defaultAuthMethod : form.authMethod}
          onChange={setField("authMethod")}
          placeholder="oauth"
          disabled={authMethodLocked}
        />
      </Field>

      <Field
        label={t("models.field.connectMode")}
        hint={t("models.field.connectModeHint")}
      >
        <Input
          value={form.connectMode}
          onChange={setField("connectMode")}
          placeholder="stdio"
        />
      </Field>

      <Field
        label={t("models.field.workspace")}
        hint={t("models.field.workspaceHint")}
      >
        <Input
          value={form.workspace}
          onChange={setField("workspace")}
          placeholder="/path/to/workspace"
        />
      </Field>

      <Field
        label={t("models.field.requestTimeout")}
        hint={t("models.field.requestTimeoutHint")}
      >
        <Input
          value={form.requestTimeout}
          onChange={setField("requestTimeout")}
          placeholder="60"
          type="number"
          min={0}
        />
      </Field>

      <Field
        label={t("models.field.rpm")}
        hint={t("models.field.rpmHint")}
      >
        <Input
          value={form.rpm}
          onChange={setField("rpm")}
          placeholder="60"
          type="number"
          min={0}
        />
      </Field>

      <Field
        label={t("models.field.thinkingLevel")}
        hint={t("models.field.thinkingLevelHint")}
      >
        <Input
          value={form.thinkingLevel}
          onChange={setField("thinkingLevel")}
          placeholder={t("models.field.providerDefault")}
        />
      </Field>

      <Field
        label={t("models.field.maxTokensField")}
        hint={t("models.field.maxTokensFieldHint")}
      >
        <Input
          value={form.maxTokensField}
          onChange={setField("maxTokensField")}
          placeholder="max_completion_tokens"
        />
      </Field>

      <Field
        label={t("models.field.toolSchemaTransform")}
        hint={t("models.field.toolSchemaTransformHint")}
      >
        <Input
          value={form.toolSchemaTransform}
          onChange={setField("toolSchemaTransform")}
          placeholder="google"
        />
      </Field>

      <SwitchCardField
        label={t("models.field.streamingEnabled")}
        hint={t("models.field.streamingEnabledHint")}
        checked={form.streamingEnabled}
        onCheckedChange={(checked) =>
          setForm((f) => ({ ...f, streamingEnabled: checked }))
        }
        ariaLabel={t("models.field.streamingEnabled")}
      />

      <Field
        label={t("models.field.extraBody")}
        hint={t("models.field.extraBodyHint")}
      >
        <Textarea
          value={form.extraBody}
          onChange={setField("extraBody")}
          placeholder='{"key": "value"}'
          rows={3}
        />
      </Field>

      <Field
        label={t("models.field.customHeaders")}
        hint={t("models.field.customHeadersHint")}
      >
        <Textarea
          value={form.customHeaders}
          onChange={setField("customHeaders")}
          placeholder='{"X-Source": "coding-plan"}'
          rows={3}
        />
      </Field>
    </AdvancedSection>
  )
}
