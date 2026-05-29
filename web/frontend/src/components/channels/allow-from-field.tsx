import { useTranslation } from "react-i18next"

import {
  type ArrayFieldFlusher,
  ChannelArrayListField,
} from "@/components/channels/channel-array-list-field"
import {
  asStringArray,
  parseAllowFromInput,
} from "@/components/channels/channel-array-utils"

interface AllowFromFieldProps {
  value: unknown
  onChange: (value: unknown) => void
  fieldPath?: string
  registerFlusher?: (fieldPath: string, flusher: ArrayFieldFlusher | null) => void
  resetVersion?: number
}

export function AllowFromField({
  value,
  onChange,
  fieldPath = "allow_from",
  registerFlusher,
  resetVersion,
}: AllowFromFieldProps) {
  const { t } = useTranslation()

  return (
    <ChannelArrayListField
      label={t("channels.field.allowFrom")}
      hint={t("channels.form.desc.allowFrom")}
      value={asStringArray(value)}
      onChange={onChange}
      placeholder={t("channels.field.allowFromPlaceholder")}
      parser={parseAllowFromInput}
      fieldPath={fieldPath}
      registerFlusher={registerFlusher}
      resetVersion={resetVersion}
    />
  )
}
