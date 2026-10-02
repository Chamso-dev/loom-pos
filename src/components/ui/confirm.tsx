import type { ReactNode } from 'react'
import Modal from './modal'
import { Button } from './button'
import { useI18n } from '@/i18n'

/** In-app confirmation, used instead of window.confirm so it matches the app and its language. */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: ReactNode
  message?: ReactNode
  confirmLabel: ReactNode
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} data-autofocus>
            {t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </Modal>
  )
}
