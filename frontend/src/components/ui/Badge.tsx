import React, { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'ember' | 'success' | 'warning' | 'danger' | 'outline' | 'mono';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors';

  const variants = {
    default: 'bg-zinc-800 text-zinc-300 border border-zinc-700/60',
    ember: 'bg-ember-950/60 text-ember-300 border border-ember-800/60',
    success: 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60',
    warning: 'bg-amber-950/60 text-amber-300 border border-amber-800/60',
    danger: 'bg-red-950/60 text-red-300 border border-red-800/60',
    outline: 'bg-transparent text-craft-ink border border-craft-borderMedium',
    mono: 'bg-zinc-900 text-zinc-300 border border-zinc-700 font-mono text-[11px] tracking-wide',
  };

  const dotColors = {
    default: 'bg-zinc-400',
    ember: 'bg-ember-400 animate-pulse',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    outline: 'bg-zinc-400',
    mono: 'bg-ember-400',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], className))} {...props}>
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full mr-1.5 shrink-0', dotColors[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
