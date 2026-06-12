import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[84px] w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 shadow-soft placeholder:text-gray-400 transition-colors focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
