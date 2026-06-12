import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          variant === 'default' && 'bg-indigo-600 text-white hover:bg-indigo-700',
          variant === 'outline' &&
            'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
          variant === 'ghost' && 'text-gray-700 hover:bg-gray-100',
          variant === 'destructive' && 'bg-red-600 text-white hover:bg-red-700',
          variant === 'secondary' && 'bg-gray-100 text-gray-900 hover:bg-gray-200',
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-11 px-8 text-base',
          size === 'icon' && 'h-9 w-9',
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
