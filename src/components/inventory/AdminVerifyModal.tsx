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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-md shadow-2xl border-primary/20 animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <ShieldAlert size={20} />
              </div>
              <CardTitle className="text-xl font-bold">{title}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} type="button" className="rounded-full">
              <X size={20} />
            </Button>
          </CardHeader>
          
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {message}
            </p>
            
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Admin Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  autoFocus
                  required 
                  placeholder="••••••••" 
                  className="pl-10 h-12 bg-accent/20 border-border/40 focus:ring-primary/20"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2 pb-6 px-6">
            <Button variant="premium" type="submit" className="w-full h-12 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20">
              Authorize Action
            </Button>
            <Button variant="ghost" type="button" onClick={onClose} className="w-full text-[10px] uppercase font-bold tracking-widest opacity-60 hover:opacity-100">
              Cancel
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
