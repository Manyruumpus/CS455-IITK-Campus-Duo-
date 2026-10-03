import React from 'react';

export interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
  label?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  lines = 3,
  className = '',
  label = 'Loading content...',
}) => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`space-y-3 animate-pulse p-4 rounded-lg bg-craft-surface border border-craft-border ${className}`}
    >
      <div className="h-4 bg-zinc-800 rounded w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 bg-zinc-800/70 rounded ${
            i === lines - 1 ? 'w-2/3' : 'w-full'
          }`}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
};
