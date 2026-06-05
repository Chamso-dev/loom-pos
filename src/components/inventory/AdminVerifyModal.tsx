import { useState } from 'react'
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShieldAlert, X, Lock } from 'lucide-react'

interface AdminVerifyModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (password: string) => void
  title?: string
  message?: string
}

export default function AdminVerifyModal({ 
  isOpen, 
  onClose, 
  onVerify, 
  title = "Admin Verification Required",
  message = "Please enter the admin password to authorize this inventory modification."
}: AdminVerifyModalProps) {
  const [password, setPassword] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onVerify(password)
    setPassword('')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md shadow-lg border border-border animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-muted-foreground" />
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} type="button" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </Button>
          </CardHeader>
          
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-normal">
              {message}
            </p>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Admin Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  autoFocus
                  required 
                  placeholder="••••••••" 
                  className="pl-9 h-10 bg-background border-border"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 pt-2 pb-6 px-6">
            <Button variant="outline" type="button" onClick={onClose} className="h-9 text-xs">
              Cancel
            </Button>
            <Button variant="default" type="submit" className="h-9 text-xs">
              Authorize Action
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

