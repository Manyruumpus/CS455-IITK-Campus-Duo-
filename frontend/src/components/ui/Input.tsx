import React, { InputHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      errorMessage,
      leftAdornment,
      rightAdornment,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-craft-muted uppercase tracking-wider">
            {label}
            {required && <span className="text-ember-400 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAdornment && (
            <div className="absolute left-3 flex items-center pointer-events-none text-craft-muted">
              {leftAdornment}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={!!errorMessage}
            aria-describedby={
              errorMessage ? errorId : helperText ? helperId : undefined
            }
            className={twMerge(
              clsx(
                'w-full bg-craft-surface border rounded-md px-3 py-2 text-sm text-craft-ink placeholder-craft-subtle transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ember-500 focus:border-ember-500',
                'disabled:opacity-50 disabled:bg-zinc-900 disabled:cursor-not-allowed',
                errorMessage
                  ? 'border-red-500/80 focus:ring-red-500'
                  : 'border-craft-border hover:border-craft-borderMedium',
                leftAdornment ? 'pl-9' : '',
                rightAdornment ? 'pr-9' : '',
                className
              )
            )}
            {...props}
          />
          {rightAdornment && (
            <div className="absolute right-3 flex items-center text-craft-muted">
              {rightAdornment}
            </div>
          )}
        </div>
        {errorMessage ? (
          <p id={errorId} className="text-xs text-red-400 font-medium" role="alert">
            {errorMessage}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-craft-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
