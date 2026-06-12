import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'low' | 'medium' | 'high' | 'critical' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-gray-100 text-gray-800',
        variant === 'outline' && 'border border-gray-300 text-gray-700',
        variant === 'low' && 'bg-green-100 text-green-800',
        variant === 'medium' && 'bg-yellow-100 text-yellow-800',
        variant === 'high' && 'bg-orange-100 text-orange-800',
        variant === 'critical' && 'bg-red-100 text-red-800',
        className
      )}
      {...props}
    />
  )
}
