import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'low' | 'medium' | 'high' | 'critical' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        variant === 'default' && 'bg-gray-100 text-gray-700 ring-gray-200',
        variant === 'outline' && 'bg-transparent text-gray-600 ring-gray-300',
        variant === 'low' && 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
        variant === 'medium' && 'bg-amber-50 text-amber-700 ring-amber-600/20',
        variant === 'high' && 'bg-orange-50 text-orange-700 ring-orange-600/20',
        variant === 'critical' && 'bg-red-50 text-red-700 ring-red-600/20',
        className
      )}
      {...props}
    />
  )
}
