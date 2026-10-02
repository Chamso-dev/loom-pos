/** The LoomPOS mark, inline so it also works offline and in the single-file demo. */
export default function Logo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="32" height="32" rx="8" fill="#18181b" />
      <path d="M9 8h3.5v10.5a1.5 1.5 0 001.5 1.5H23v3.5H14A5.5 5.5 0 018.5 18V8z" fill="#3b82f6" />
      <rect x="14" y="8" width="9" height="7" rx="1" fill="#f4f4f5" />
    </svg>
  )
}
