import { IconLoader2 } from "@tabler/icons-react"
import { useState } from "react"

import { type ModelProviderOption, addModel, setDefaultModel } from "@/api/models"
import { ConfigChangeNotice } from "@/components/config-change-notice"
import { Field } from "@/components/shared-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface AddModelSheetProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  existingModelNames: string[]
  providerOptions?: ModelProviderOption[]
}

export function AddModelSheet({
  open,
  onClose,
  onSaved,
  existingModelNames,
  providerOptions,
}: AddModelSheetProps) {
  const hook = useModelForm({ mode: "add", providerOptions })
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

  const [modelName, setModelName] = useState("")
  const [modelNameError, setModelNameError] = useState("")
  const [providerError, setProviderError] = useState("")
  const [modelError, setModelError] = useState("")

  const handleModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModelName(e.target.value)
    if (modelNameError) setModelNameError("")
  }

  const handleProviderChangeAdd = (provider: string) => {
    handleProviderChange(provider)
    if (providerError) setProviderError("")
  }

  const handleModelChangeAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleModelChange(e)
    if (modelError) setModelError("")
  }

  const handleCommonModelAdd = (modelId: string) => {
    handleCommonModel(modelId)
    if (modelError) setModelError("")
  }

  const handleSave = async () => {
    const trimmedName = modelName.trim()
    if (!trimmedName) {
      setModelError(t("models.add.errorRequired"))
      return
    }
    if (existingModelNames.some((name) => name.trim() === trimmedName)) {
      setModelError(t("models.add.errorDuplicateModelName"))
      return
    }
    if (!providerDef) {
      setProviderError(t("models.field.providerInvalid"))
      return
    }
    if (!form.model.trim()) {
      setModelError(t("models.add.errorRequired"))
      return
    }
    if (modelValidation?.level === "error") return

    const jsonResult = parseJsonFields()
    if (!jsonResult.ok) return

    setSaving(true)
    setError("")
    try {
      const payload = buildPayload(jsonResult.extraBody!, jsonResult.customHeaders!)
      await addModel({ ...payload, model_name: trimmedName })
      if (setAsDefault) {
        await setDefaultModel(trimmedName)
      }
      const gateway = await refreshGatewayState({ force: true })
      showSaveSuccessOrRestartToast(
        t,
        t("models.add.saveSuccess"),
        trimmedName,
        gateway?.restartRequired === true,
      )
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("models.add.saveError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 p-0 data-[side=right]:!w-full data-[side=right]:sm:!w-[560px] data-[side=right]:sm:!max-w-[560px]"
        >
          <SheetHeader className="border-b-muted border-b px-6 py-5">
            <SheetTitle className="text-base">
              {t("models.add.title")}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {t("models.add.description")}
            </SheetDescription>
          </SheetHeader>

          <div
            className="min-h-0 flex-1 overflow-y-auto"
            ref={scrollContainerRef}
          >
            <div className="space-y-5 px-6 py-5">
              <Field
                label={t("models.add.modelName")}
                hint={t("models.add.modelNameHint")}
              >
                <Input
                  value={modelName}
                  onChange={handleModelNameChange}
                  placeholder={t("models.add.modelNamePlaceholder")}
                  aria-invalid={!!modelNameError}
                />
                {modelNameError && (
                  <p className="text-destructive text-xs">{modelNameError}</p>
                )}
              </Field>

              <ModelFormFieldsComponent
                form={form}
                setForm={setForm}
                setField={setField}
                handleModelChange={handleModelChangeAdd}
                handleProviderChange={handleProviderChangeAdd}
                handleCommonModel={handleCommonModelAdd}
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
                filterCreateAllowed
                showSelectProviderHint
                testDisabled={!form.provider || !form.model}
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
              {t("models.add.confirm")}
            </Button>
          </SheetFooter>
        </SheetContent>

        <FetchModelsDialog
          open={fetchOpen}
          onClose={() => setFetchOpen(false)}
          onFill={handleFetchFill}
          provider={canonicalProvider}
          apiKey={form.apiKey}
          apiBase={effectiveApiBase}
          backendOptions={providerOptions}
        />

        <TestModelDialog
          model={null}
          open={testOpen}
          onClose={() => setTestOpen(false)}
          inlineParams={{
            provider: canonicalProvider,
            model: form.model,
            apiBase: effectiveApiBase,
            apiKey: form.apiKey,
            authMethod: effectiveAuthMethod,
          }}
        />
      </Sheet>
    </>
  )
}
