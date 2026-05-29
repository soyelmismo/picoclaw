import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  type ModelInfo,
  type ModelProviderOption,
  getCatalogs,
} from "@/api/models"
import { maskedSecretPlaceholder } from "@/components/secret-placeholder"

import {
  getEffectiveAPIBase,
  getSubmittedAPIBase,
  normalizeApiBase,
} from "./model-provider-form-shared"
import { type FieldValidation, validateModelField } from "./model-validation"
import {
  getCanonicalProviderKey,
  getProviderCatalogEntry,
  getProviderCatalogMap,
  getProviderDefaultAPIBase,
  getProviderDefaultAuthMethod,
  isProviderAuthMethodLocked,
} from "./provider-registry"

export interface ModelFormFields {
  provider: string
  model: string
  apiBase: string
  apiKey: string
  proxy: string
  authMethod: string
  connectMode: string
  workspace: string
  rpm: string
  maxTokensField: string
  requestTimeout: string
  thinkingLevel: string
  toolSchemaTransform: string
  streamingEnabled: boolean
  extraBody: string
  customHeaders: string
}

export const EMPTY_MODEL_FORM: ModelFormFields = {
  provider: "",
  model: "",
  apiBase: "",
  apiKey: "",
  proxy: "",
  authMethod: "",
  connectMode: "",
  workspace: "",
  rpm: "",
  maxTokensField: "",
  requestTimeout: "",
  thinkingLevel: "",
  toolSchemaTransform: "",
  streamingEnabled: false,
  extraBody: "",
  customHeaders: "",
}

function buildEditForm(model: ModelInfo): ModelFormFields {
  return {
    provider: getCanonicalProviderKey(model.provider),
    model: model.model,
    apiKey: "",
    apiBase: model.api_base ?? "",
    proxy: model.proxy ?? "",
    authMethod: model.auth_method ?? "",
    connectMode: model.connect_mode ?? "",
    workspace: model.workspace ?? "",
    rpm: model.rpm ? String(model.rpm) : "",
    maxTokensField: model.max_tokens_field ?? "",
    requestTimeout: model.request_timeout ? String(model.request_timeout) : "",
    thinkingLevel: model.thinking_level ?? "",
    toolSchemaTransform: model.tool_schema_transform ?? "",
    streamingEnabled: model.streaming?.enabled === true,
    extraBody: model.extra_body ? JSON.stringify(model.extra_body, null, 2) : "",
    customHeaders: model.custom_headers
      ? JSON.stringify(model.custom_headers, null, 2)
      : "",
  }
}

interface UseModelFormBaseOptions {
  providerOptions?: ModelProviderOption[]
}

interface UseModelFormAddOptions extends UseModelFormBaseOptions {
  mode: "add"
}

interface UseModelFormEditOptions extends UseModelFormBaseOptions {
  mode: "edit"
  model: ModelInfo | null
}

export type UseModelFormOptions = UseModelFormAddOptions | UseModelFormEditOptions

export function useModelForm(options: UseModelFormOptions) {
  const { t } = useTranslation()
  const { providerOptions, mode } = options

  const [form, setForm] = useState<ModelFormFields>(
    mode === "edit" && options.model
      ? buildEditForm(options.model)
      : { ...EMPTY_MODEL_FORM },
  )
  const [saving, setSaving] = useState(false)
  const [setAsDefault, setSetAsDefault] = useState(false)
  const [error, setError] = useState("")
  const [modelValidation, setModelValidation] =
    useState<FieldValidation | null>(null)
  const [fetchOpen, setFetchOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [catalogModels, setCatalogModels] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const providerMap = getProviderCatalogMap(providerOptions)

  const [initialFormSnapshot] = useState<ModelFormFields | null>(
    mode === "edit" && options.model ? buildEditForm(options.model) : null,
  )

  useEffect(() => {
    if (mode === "add" && options.open) {
      setForm({ ...EMPTY_MODEL_FORM })
      setSetAsDefault(false)
      setError("")
      setModelValidation(null)
      setFetchedModels([])
      setCatalogModels([])
    }
    if (mode === "edit" && options.model) {
      const built = buildEditForm(options.model)
      setForm(built)
      setSetAsDefault(options.model.is_default)
      setError("")
      setModelValidation(null)
      setFetchedModels([])
      setCatalogModels([])
      const providerKey = getCanonicalProviderKey(
        options.model.provider,
        providerOptions,
      )
      const apiBase = getEffectiveAPIBase(
        options.model.provider ?? "",
        options.model.api_base ?? "",
        providerOptions,
      )
      getCatalogs()
        .then((res) => {
          const matched = (res.entries || []).filter((e) => {
            const ep = getCanonicalProviderKey(e.provider, providerOptions)
            const eb = (e.api_base ?? "").trim().replace(/\/+$/, "")
            return ep === providerKey && eb === apiBase
          })
          const ids = matched.flatMap((e) => e.models.map((m) => m.id))
          const unique = [...new Set(ids)]
          if (unique.length > 0) setCatalogModels(unique)
        })
        .catch(() => {})
    }
  }, [mode === "add" ? options.open : options.model, providerOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === "add") {
      const providerKey = getCanonicalProviderKey(form.provider, providerOptions)
      const apiBase = getEffectiveAPIBase(
        form.provider,
        form.apiBase,
        providerOptions,
      )
      if (!form.provider.trim()) {
        setCatalogModels([])
        return
      }
      let cancelled = false
      getCatalogs()
        .then((res) => {
          if (cancelled) return
          const matched = (res.entries || []).filter((e) => {
            const ep = getCanonicalProviderKey(e.provider, providerOptions)
            const eb = (e.api_base ?? "").trim().replace(/\/+$/, "")
            return ep === providerKey && eb === apiBase
          })
          const ids = matched.flatMap((e) => e.models.map((m) => m.id))
          const unique = [...new Set(ids)]
          setCatalogModels(unique)
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }
  }, [form.provider, form.apiBase, providerOptions, mode])

  const canonicalProvider = getCanonicalProviderKey(form.provider, providerOptions)
  const providerMapEntry = canonicalProvider
    ? providerMap.get(canonicalProvider)
    : undefined
  const commonModels = providerMapEntry?.commonModels || []
  const authMethodLocked = isProviderAuthMethodLocked(form.provider, providerOptions)
  const defaultAuthMethod = getProviderDefaultAuthMethod(form.provider, providerOptions)
  const effectiveAuthMethod = (authMethodLocked ? defaultAuthMethod : form.authMethod)
    .trim()
    .toLowerCase()
  const isOAuth = effectiveAuthMethod === "oauth"
  const defaultModelAllowed = providerMapEntry?.defaultModelAllowed === true
  const apiBasePlaceholder =
    getProviderDefaultAPIBase(form.provider, providerOptions) ||
    "https://api.example.com/v1"
  const effectiveApiBase = getEffectiveAPIBase(form.provider, form.apiBase, providerOptions)
  const submittedApiBase = getSubmittedAPIBase(form.apiBase)

  const apiKeyPlaceholder =
    mode === "edit" && options.model?.api_key
      ? maskedSecretPlaceholder(
          options.model.api_key,
          t("models.field.apiKeyPlaceholderSet"),
        )
      : maskedSecretPlaceholder("", t("models.field.apiKeyPlaceholder"))

  const isDirty =
    mode === "add"
      ? JSON.stringify(form) !== JSON.stringify(EMPTY_MODEL_FORM) || setAsDefault
      : mode === "edit" &&
        options.model != null &&
        (JSON.stringify(form) !== JSON.stringify(initialFormSnapshot) ||
          setAsDefault !== options.model.is_default)

  const setField =
    (key: keyof ModelFormFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      if (error) setError("")
    }

  const debouncedValidateModel = useCallback(
    (value: string, provider: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const result = validateModelField(value, provider || undefined, providerOptions)
        setModelValidation(result)
      }, 300)
    },
    [providerOptions],
  )

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setForm((f) => ({ ...f, model: value }))
    if (error) setError("")
    debouncedValidateModel(value, form.provider)
  }

  const handleProviderChange = (provider: string) => {
    if (error) setError("")
    setForm((f) => {
      const previousOption = getProviderCatalogEntry(f.provider, providerOptions)
      const nextOption = getProviderCatalogEntry(provider, providerOptions)
      const previousDefaultBase = normalizeApiBase(
        getProviderDefaultAPIBase(f.provider, providerOptions),
      )
      const nextDefaultBase = normalizeApiBase(
        getProviderDefaultAPIBase(provider, providerOptions),
      )
      const currentApiBase = normalizeApiBase(f.apiBase)
      let authMethod = f.authMethod
      let apiBase = f.apiBase
      if (nextOption?.authMethodLocked) {
        authMethod = nextOption.defaultAuthMethod ?? ""
      } else if (
        previousOption?.authMethodLocked &&
        f.authMethod === (previousOption.defaultAuthMethod ?? "")
      ) {
        authMethod = ""
      }
      if (
        currentApiBase &&
        previousDefaultBase &&
        currentApiBase === previousDefaultBase &&
        currentApiBase !== nextDefaultBase
      ) {
        apiBase = ""
      }
      return {
        ...f,
        provider: getCanonicalProviderKey(provider, providerOptions),
        apiBase,
        authMethod,
      }
    })
    if (form.model) {
      debouncedValidateModel(form.model, provider)
    }
    const allowed =
      getProviderCatalogEntry(provider, providerOptions)?.defaultModelAllowed ?? false
    if (!allowed) {
      setSetAsDefault(false)
    }
  }

  const applyFix = () => {
    if (modelValidation?.fix) {
      setForm((f) => ({ ...f, model: modelValidation.fix! }))
      setModelValidation(null)
    }
  }

  const handleCommonModel = (modelId: string) => {
    setForm((f) => ({ ...f, model: modelId }))
    setModelValidation(null)
    if (error) setError("")
  }

  const handleFetchFill = (models: string[]) => {
    setFetchedModels(models)
    if (models.length >= 1) {
      setForm((f) => ({ ...f, model: models[0] }))
      setModelValidation(null)
      if (error) setError("")
    }
  }

  const parseJsonFields = (): {
    extraBody: Record<string, unknown> | undefined
    customHeaders: Record<string, string> | undefined
    ok: boolean
  } => {
    let extraBody: Record<string, unknown> | undefined
    let customHeaders: Record<string, string> | undefined
    try {
      extraBody = form.extraBody.trim() ? JSON.parse(form.extraBody.trim()) : {}
    } catch {
      setError(t("models.field.extraBody") + ": " + t("models.field.invalidJson"))
      return { extraBody: undefined, customHeaders: undefined, ok: false }
    }
    try {
      customHeaders = form.customHeaders.trim()
        ? JSON.parse(form.customHeaders.trim())
        : {}
    } catch {
      setError(t("models.field.customHeaders") + ": " + t("models.field.invalidJson"))
      return { extraBody: undefined, customHeaders: undefined, ok: false }
    }
    return { extraBody, customHeaders, ok: true }
  }

  const buildPayload = (
    extraBody: Record<string, unknown>,
    customHeaders: Record<string, string>,
    streamingOverride?: { enabled: boolean },
  ) => ({
    provider: canonicalProvider || undefined,
    model: form.model.trim(),
    api_base: submittedApiBase,
    api_key: form.apiKey.trim() || undefined,
    proxy: form.proxy.trim() || undefined,
    auth_method: authMethodLocked
      ? defaultAuthMethod || undefined
      : form.authMethod.trim() || undefined,
    connect_mode: form.connectMode.trim() || undefined,
    workspace: form.workspace.trim() || undefined,
    rpm: form.rpm ? Number(form.rpm) : undefined,
    max_tokens_field: form.maxTokensField.trim() || undefined,
    request_timeout: form.requestTimeout ? Number(form.requestTimeout) : undefined,
    thinking_level: form.thinkingLevel.trim() || undefined,
    tool_schema_transform: form.toolSchemaTransform.trim() || undefined,
    streaming: streamingOverride ?? (form.streamingEnabled ? { enabled: true } : undefined),
    extra_body: extraBody,
    custom_headers: customHeaders,
  })

  return {
    form,
    setForm,
    saving,
    setSaving,
    setAsDefault,
    setSetAsDefault,
    error,
    setError,
    modelValidation,
    setModelValidation,
    fetchOpen,
    setFetchOpen,
    testOpen,
    setTestOpen,
    fetchedModels,
    setFetchedModels,
    catalogModels,
    scrollContainerRef,
    canonicalProvider,
    providerDef: providerMapEntry,
    commonModels,
    authMethodLocked,
    defaultAuthMethod,
    effectiveAuthMethod,
    isOAuth,
    defaultModelAllowed,
    apiBasePlaceholder,
    effectiveApiBase,
    submittedApiBase,
    apiKeyPlaceholder,
    isDirty,
    setField,
    debouncedValidateModel,
    handleModelChange,
    handleProviderChange,
    applyFix,
    handleCommonModel,
    handleFetchFill,
    parseJsonFields,
    buildPayload,
    t,
    mode,
    providerOptions,
  }
}
