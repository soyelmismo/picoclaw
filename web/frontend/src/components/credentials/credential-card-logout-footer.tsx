import { IconLoader2 } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

interface CredentialCardLogoutFooterProps {
  activeAction: string
  actionKey: string
  disabled: boolean
  onAskLogout: () => void
}

export function CredentialCardLogoutFooter({
  activeAction,
  actionKey,
  disabled,
  onAskLogout,
}: CredentialCardLogoutFooterProps) {
  const { t } = useTranslation()
  const loading = activeAction === actionKey

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onAskLogout}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      {loading && <IconLoader2 className="size-4 animate-spin" />}
      {t("credentials.actions.logout")}
    </Button>
  )
}
