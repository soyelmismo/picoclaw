import { useTranslation } from "react-i18next"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

interface LogoutConfirmDialogProps {
  open: boolean
  providerLabel: string
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

export function LogoutConfirmDialog({
  open,
  providerLabel,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: LogoutConfirmDialogProps) {
  const { t } = useTranslation()

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("credentials.logoutDialog.title")}
      description={t(
        "credentials.logoutDialog.description",
        "This will remove your saved credential for {{provider}}.",
        { provider: providerLabel },
      )}
      confirmLabel={t("credentials.actions.logout")}
      isPending={isSubmitting}
      cancelLabel={t("common.cancel")}
      onConfirm={onConfirm}
    />
  )
}
