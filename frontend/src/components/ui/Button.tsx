import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ember' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:ring-offset-2 focus-visible:ring-offset-craft-bg disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-craft-surface text-craft-ink border border-craft-border hover:bg-craft-surfaceHover hover:border-craft-borderMedium active:scale-[0.98]',
      ember:
        'bg-ember-600 text-white hover:bg-ember-500 shadow-sm active:scale-[0.98] border border-ember-500',
      secondary:
        'bg-craft-surfaceHover text-craft-ink hover:bg-zinc-800 border border-transparent',
      outline:
        'bg-transparent text-craft-ink border border-craft-borderMedium hover:bg-craft-surface active:scale-[0.98]',
      ghost:
        'bg-transparent text-craft-muted hover:text-craft-ink hover:bg-craft-surface active:scale-[0.98]',
      danger:
        'bg-red-950/40 text-red-400 border border-red-800/50 hover:bg-red-900/60 active:scale-[0.98]',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
