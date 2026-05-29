import { IconDownload, IconPlugConnected } from "@tabler/icons-react"

import { Field, KeyInput, SwitchCardField } from "@/components/shared-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import type { ModelFormFields } from "./use-model-form"
import { providerSupportsFetch } from "./provider-registry"
import { ProviderCombobox } from "./provider-combobox"
import type { FieldValidation } from "./model-validation"
import type { ModelProviderOption } from "@/api/models"

interface ModelFormFieldsProps {
  form: ModelFormFields
  setForm: React.Dispatch<React.SetStateAction<ModelFormFields>>
  setField: (
    key: keyof ModelFormFields,
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  handleModelChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleProviderChange: (provider: string) => void
  handleCommonModel: (modelId: string) => void
  applyFix: () => void
  modelValidation: FieldValidation | null
  providerDef: unknown
  commonModels: string[]
  catalogModels: string[]
  fetchedModels: string[]
  isOAuth: boolean
  defaultModelAllowed: boolean
  setAsDefault: boolean
  setSetAsDefault: (v: boolean) => void
  apiKeyPlaceholder: string
  apiBasePlaceholder: string
  error: string
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  providerOptions?: ModelProviderOption[]
  onFetchOpen: () => void
  onTestOpen: () => void
  filterCreateAllowed?: boolean
  showModelName?: boolean
  modelName?: string
  onModelNameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  modelNameError?: string
  providerError?: string
  testDisabled?: boolean
  showSelectProviderHint?: boolean
  apiKeyHint?: string
  t: (key: string, params?: Record<string, unknown>) => string
}

export function ModelFormFieldsComponent({
  form,
  setForm,
  setField,
  handleModelChange,
  handleProviderChange,
  handleCommonModel,
  applyFix,
  modelValidation,
  providerDef,
  commonModels,
  catalogModels,
  fetchedModels,
  isOAuth,
  defaultModelAllowed,
  setAsDefault,
  setSetAsDefault,
  apiKeyPlaceholder,
  apiBasePlaceholder,
  error,
  scrollContainerRef,
  providerOptions,
  onFetchOpen,
  onTestOpen,
  filterCreateAllowed,
  showModelName,
  modelName,
  onModelNameChange,
  modelNameError,
  providerError,
  testDisabled,
  showSelectProviderHint,
  apiKeyHint,
  t,
}: ModelFormFieldsProps) {
  return (
    <>
      {showModelName && (
        <Field
          label={t("models.add.modelName")}
          hint={t("models.add.modelNameHint")}
        >
          <Input
            value={modelName ?? ""}
            onChange={onModelNameChange}
            placeholder={t("models.add.modelNamePlaceholder")}
            aria-invalid={!!modelNameError}
          />
          {modelNameError && (
            <p className="text-destructive text-xs">{modelNameError}</p>
          )}
        </Field>
      )}

      <Field
        label={t("models.field.provider")}
        hint={t("models.field.providerHint")}
        error={providerError}
        required
      >
        <ProviderCombobox
          value={form.provider}
          onChange={handleProviderChange}
          placeholder={t("models.field.providerPlaceholder")}
          backendOptions={providerOptions}
          filterCreateAllowed={filterCreateAllowed}
          containerRef={scrollContainerRef}
        />
      </Field>

      <Field
        label={t("models.add.modelId")}
        hint={t("models.add.modelIdHint")}
      >
        <Input
          value={form.model}
          onChange={handleModelChange}
          placeholder={
            providerDef
              ? `${commonModels[0] || "model-name"}`
              : t("models.add.modelIdPlaceholder")
          }
          className="font-mono text-sm"
          aria-invalid={!!error || modelValidation?.level === "error"}
        />
        {modelValidation && modelValidation.messageKey && (
          <div
            className={`flex items-center gap-2 text-xs ${
              modelValidation.level === "error"
                ? "text-destructive"
                : modelValidation.level === "warning"
                  ? "text-yellow-600 dark:text-yellow-500"
                  : "text-green-600 dark:text-green-500"
            }`}
          >
            <span>
              {t(modelValidation.messageKey, modelValidation.messageParams)}
            </span>
            {modelValidation.fix && (
              <button
                type="button"
                onClick={applyFix}
                className="text-primary underline hover:no-underline"
              >
                {t("common.fix")}
              </button>
            )}
          </div>
        )}
        {commonModels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {commonModels.map((m) => (
              <Badge
                key={m}
                variant="secondary"
                className="hover:bg-secondary/80 cursor-pointer font-mono text-xs"
                onClick={() => handleCommonModel(m)}
              >
                {m}
              </Badge>
            ))}
          </div>
        )}
        {catalogModels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {catalogModels.map((m) => (
              <Badge
                key={m}
                variant={form.model === m ? "default" : "outline"}
                className="cursor-pointer font-mono text-xs"
                onClick={() => handleCommonModel(m)}
              >
                {m}
              </Badge>
            ))}
          </div>
        )}
        {fetchedModels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {fetchedModels.map((m) => (
              <Badge
                key={m}
                variant={form.model === m ? "default" : "outline"}
                className="cursor-pointer font-mono text-xs"
                onClick={() => handleCommonModel(m)}
              >
                {m}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          {providerSupportsFetch(form.provider, providerOptions) && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onFetchOpen}
            >
              <IconDownload className="size-3" />
              {t("models.fetch.title")}
            </Button>
          )}
          {showSelectProviderHint && !form.provider && (
            <span className="text-muted-foreground text-xs">
              {t("models.field.selectProviderFirst")}
            </span>
          )}
        </div>
      </Field>

      {!isOAuth && (
        <Field
          label={t("models.field.apiKey")}
          hint={apiKeyHint}
        >
          <KeyInput
            value={form.apiKey}
            onChange={(v) => setForm((f) => ({ ...f, apiKey: v }))}
            placeholder={apiKeyPlaceholder}
          />
        </Field>
      )}

      <Field
        label={t("models.field.apiBase")}
        hint={isOAuth ? t("models.edit.oauthNote") : undefined}
      >
        <Input
          value={form.apiBase}
          onChange={setField("apiBase")}
          placeholder={apiBasePlaceholder}
          disabled={isOAuth}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onTestOpen}
          disabled={testDisabled}
        >
          <IconPlugConnected className="size-4" />
          {t("models.test.testConnection")}
        </Button>
      </div>

      <SwitchCardField
        label={t("models.defaultOnSave.label")}
        hint={
          !defaultModelAllowed && form.provider
            ? t("models.defaultOnSave.unsupportedProvider")
            : t("models.defaultOnSave.description")
        }
        checked={setAsDefault}
        onCheckedChange={setSetAsDefault}
        disabled={!defaultModelAllowed}
      />
    </>
  )
}
