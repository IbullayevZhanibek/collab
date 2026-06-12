import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-sm text-gray-900 shadow-soft placeholder:text-gray-400 transition-colors focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
