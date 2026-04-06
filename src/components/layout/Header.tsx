import { Bell, Search, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Header() {
  return (
    <header className="h-16 flex items-center justify-between px-8 bg-background/40 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 transition-all duration-300">
      <div className="flex-1 flex items-center max-w-md">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
          <input 
            type="text" 
            placeholder="Search products, orders..."
            className="w-full bg-accent/30 border border-border/50 h-10 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground relative transition-all border border-transparent hover:border-border">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background shadow-lg shadow-primary/30"></span>
        </button>
        <div className="h-8 w-px bg-border/40 mx-1"></div>
        <button className="flex items-center gap-2 pl-1 pr-1 py-1 hover:bg-accent rounded-xl transition-all border border-transparent hover:border-border text-muted-foreground hover:text-foreground group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
            <User size={18} />
          </div>
        </button>
      </div>
    </header>
  )
}
