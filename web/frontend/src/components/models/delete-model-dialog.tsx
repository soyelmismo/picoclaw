import { useState } from "react"
import { useTranslation } from "react-i18next"

import { type ModelInfo, deleteModel } from "@/api/models"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

interface DeleteModelDialogProps {
  model: ModelInfo | null
  onClose: () => void
  onDeleted: () => void
}

export function DeleteModelDialog({
  model,
  onClose,
  onDeleted,
}: DeleteModelDialogProps) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!model) return
    if (model.is_default) {
      onClose()
      return
    }
    setDeleting(true)
    try {
      await deleteModel(model.index)
      onDeleted()
    } catch {
      // ignore, user can retry from list
    } finally {
      setDeleting(false)
      onClose()
    }
  }

  return (
    <ConfirmDeleteDialog
      open={model !== null}
      onOpenChange={(v) => !v && onClose()}
      title={t("models.delete.title")}
      description={t("models.delete.description", { name: model?.model_name })}
      confirmLabel={t("models.delete.confirm")}
      isPending={deleting}
      cancelLabel={t("common.cancel")}
      onConfirm={handleConfirm}
    />
  )
}
