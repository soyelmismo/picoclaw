import { IconTrash } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

import type { SkillSupportItem } from "@/api/skills"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

interface DeleteDialogProps {
  open: boolean
  skillPendingDelete: SkillSupportItem | null
  isDeletePending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DeleteDialog({
  open,
  skillPendingDelete,
  isDeletePending,
  onOpenChange,
  onConfirm,
}: DeleteDialogProps) {
  const { t } = useTranslation()

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pages.agent.skills.delete_title")}
      description={t("pages.agent.skills.delete_description", {
        name: skillPendingDelete?.name,
      })}
      confirmLabel={
        <>
          {!isDeletePending && <IconTrash className="size-4" />}
          {t("pages.agent.skills.delete_confirm")}
        </>
      }
      isPending={isDeletePending}
      cancelLabel={t("common.cancel")}
      onConfirm={onConfirm}
    />
  )
}
