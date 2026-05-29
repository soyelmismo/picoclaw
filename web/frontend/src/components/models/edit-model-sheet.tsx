import { IconLoader2 } from "@tabler/icons-react"


import {
  type ModelInfo,
  type ModelProviderOption,
  setDefaultModel,
  updateModel,
} from "@/api/models"
import { ConfigChangeNotice } from "@/components/config-change-notice"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { showSaveSuccessOrRestartToast } from "@/lib/restart-required"
import { refreshGatewayState } from "@/store/gateway"

import { FetchModelsDialog } from "./fetch-models-dialog"
import { ModelFormAdvanced } from "./model-form-advanced"
import { ModelFormFieldsComponent } from "./model-form-fields"
import { TestModelDialog } from "./test-model-dialog"
import { useModelForm } from "./use-model-form"

interface EditModelSheetProps {
  model: ModelInfo | null
  open: boolean
  onClose: () => void
  onSaved: () => void
  providerOptions?: ModelProviderOption[]
}

export function EditModelSheet({
  model,
  open,
  onClose,
  onSaved,
  providerOptions,
}: EditModelSheetProps) {
  const hook = useModelForm({ mode: "edit", model, providerOptions })
  const {
    form,
    setForm,
    saving,
    setSaving,
    setAsDefault,
    setSetAsDefault,
    error,
    setError,
    modelValidation,
    fetchOpen,
    setFetchOpen,
    testOpen,
    setTestOpen,
    fetchedModels,
    catalogModels,
    scrollContainerRef,
    canonicalProvider,
    providerDef,
    commonModels,
    authMethodLocked,
    defaultAuthMethod,
    effectiveAuthMethod,
    isOAuth,
    defaultModelAllowed,
    apiBasePlaceholder,
    effectiveApiBase,
    isDirty,
    setField,
    handleModelChange,
    handleProviderChange,
    applyFix,
    handleCommonModel,
    handleFetchFill,
    parseJsonFields,
    buildPayload,
    t,
  } = hook

  const handleSave = async () => {
    if (!model) return
    if (!providerDef) {
      setError(t("models.field.providerInvalid"))
      return
    }
    if (!form.model.trim()) {
      setError(t("models.add.errorRequired"))
      return
    }
    if (modelValidation?.level === "error") return

    const jsonResult = parseJsonFields()
    if (!jsonResult.ok) return

    setSaving(true)
    setError("")
    try {
      const streaming =
        model.streaming?.enabled === true || form.streamingEnabled
          ? { enabled: form.streamingEnabled }
          : undefined
      const payload = buildPayload(
        jsonResult.extraBody!,
        jsonResult.customHeaders!,
        streaming,
      )
      await updateModel(model.index, {
        ...payload,
        model_name: model.model_name,
      })
      if (setAsDefault && !model.is_default) {
        await setDefaultModel(model.model_name)
      }
      const gateway = await refreshGatewayState({ force: true })
      showSaveSuccessOrRestartToast(
        t,
        t("models.edit.saveSuccess"),
        model.model_name,
        gateway?.restartRequired === true,
      )
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("models.edit.saveError"))
    } finally {
      setSaving(false)
    }
  }

  const hasSavedAPIKey = Boolean(model?.api_key)
  const providerError =
    !providerDef && form.provider
      ? t("models.field.providerInvalid")
      : undefined

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 p-0 data-[side=right]:!w-full data-[side=right]:sm:!w-[560px] data-[side=right]:sm:!max-w-[560px]"
        >
          <SheetHeader className="border-b-muted border-b px-6 py-5">
            <SheetTitle className="text-base">
              {t("models.edit.title", { name: model?.model_name })}
            </SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {model?.model}
            </SheetDescription>
          </SheetHeader>

          <div
            className="min-h-0 flex-1 overflow-y-auto"
            ref={scrollContainerRef}
          >
            <div className="space-y-5 px-6 py-5">
              <ModelFormFieldsComponent
                form={form}
                setForm={setForm}
                setField={setField}
                handleModelChange={handleModelChange}
                handleProviderChange={handleProviderChange}
                handleCommonModel={handleCommonModel}
                applyFix={applyFix}
                modelValidation={modelValidation}
                providerDef={providerDef}
                commonModels={commonModels}
                catalogModels={catalogModels}
                fetchedModels={fetchedModels}
                isOAuth={isOAuth}
                defaultModelAllowed={defaultModelAllowed}
                setAsDefault={setAsDefault}
                setSetAsDefault={setSetAsDefault}
                apiKeyPlaceholder={hook.apiKeyPlaceholder}
                apiBasePlaceholder={apiBasePlaceholder}
                error={error}
                scrollContainerRef={scrollContainerRef}
                providerOptions={providerOptions}
                onFetchOpen={() => setFetchOpen(true)}
                onTestOpen={() => setTestOpen(true)}
                providerError={providerError}
                apiKeyHint={
                  hasSavedAPIKey ? t("models.edit.apiKeyHint") : undefined
                }
                t={t}
              />

              <ModelFormAdvanced
                form={form}
                setField={setField}
                setForm={setForm}
                authMethodLocked={authMethodLocked}
                defaultAuthMethod={defaultAuthMethod}
                t={t}
              />

              {error && (
                <p className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm">
                  {error}
                </p>
              )}
            </div>
          </div>

          <SheetFooter className="border-t-muted border-t px-6 py-4">
            {isDirty && (
              <ConfigChangeNotice
                kind="save"
                title={t("common.saveChangesTitle")}
                description={t("models.unsavedPrompt")}
              />
            )}
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !isDirty || saving || modelValidation?.level === "error"
              }
            >
              {saving && <IconLoader2 className="size-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </SheetFooter>
        </SheetContent>

        <TestModelDialog
          model={model}
          open={testOpen}
          onClose={() => setTestOpen(false)}
          inlineParams={{
            provider: canonicalProvider,
            model: form.model,
            apiBase: effectiveApiBase,
            apiKey: form.apiKey,
            authMethod: effectiveAuthMethod,
            modelIndex: model?.index,
          }}
        />

        <FetchModelsDialog
          open={fetchOpen}
          onClose={() => setFetchOpen(false)}
          onFill={handleFetchFill}
          provider={canonicalProvider}
          apiKey={form.apiKey}
          apiBase={effectiveApiBase}
          modelIndex={model?.index}
          backendOptions={providerOptions}
        />
      </Sheet>
    </>
  )
}
