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
          'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
          variant === 'default' &&
            'bg-brand-600 text-white shadow-soft hover:bg-brand-700 hover:shadow-glow',
          variant === 'outline' &&
            'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300',
          variant === 'ghost' && 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          variant === 'destructive' &&
            'bg-red-600 text-white shadow-soft hover:bg-red-700',
          variant === 'secondary' && 'bg-gray-100 text-gray-900 hover:bg-gray-200',
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-12 px-7 text-base',
          size === 'icon' && 'h-10 w-10',
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
