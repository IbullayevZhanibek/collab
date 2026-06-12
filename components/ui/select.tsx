import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-11 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3.5 text-sm text-gray-900 shadow-soft transition-colors focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }
