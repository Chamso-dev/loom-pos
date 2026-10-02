import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Green for a gain, red for a loss, nothing for zero. */
export function signTone(value: number) {
  return value > 0 ? 'text-gain' : value < 0 ? 'text-loss' : undefined
}
