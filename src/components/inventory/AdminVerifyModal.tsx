import { useState } from 'react'
import { Lock } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, TextInput } from '@/components/ui/field'
import { useI18n } from '@/i18n'

interface AdminVerifyModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (password: string) => void
}

export default function AdminVerifyModal({ isOpen, onClose, onVerify }: AdminVerifyModalProps) {
  const [password, setPassword] = useState('')
  const { t } = useI18n()
  if (!isOpen) return null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onVerify(password)
    setPassword('')
  }

  return (
    <Modal title={t('inventory.verifyTitle')} subtitle={t('inventory.verifyMessage')} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('inventory.verifyPassword')}>
          <div className="relative">
            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <TextInput type="password" dir="ltr" aria-label={t('inventory.verifyPassword')} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required className="ps-9 text-start" />
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('inventory.authorize')}</Button>
        </div>
      </form>
    </Modal>
  )
}
