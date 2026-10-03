import React from 'react';
import { Search, X } from 'lucide-react';

export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  options?: FilterOption[];
  selectedOption?: string;
  onOptionSelect?: (optionId: string) => void;
  onClearFilters?: () => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Filter by course, name, or keywords...',
  options = [],
  selectedOption,
  onOptionSelect,
  onClearFilters,
  className = '',
}) => {
  const hasActiveFilters = searchQuery !== '' || (selectedOption && selectedOption !== 'ALL');

  return (
    <div className={`space-y-3 p-4 rounded-lg bg-craft-surface border border-craft-border ${className}`}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-craft-muted pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 bg-craft-bg border border-craft-border rounded-md text-xs text-craft-ink placeholder-craft-subtle focus:outline-none focus:ring-2 focus:ring-ember-500"
          />
        </div>

        {/* Category Pills */}
        {options.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onOptionSelect && onOptionSelect(opt.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-ember-600 text-white shadow-sm'
                      : 'bg-craft-bg text-craft-muted hover:text-craft-ink border border-craft-border'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Clear Button */}
        {hasActiveFilters && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 text-xs text-craft-muted hover:text-craft-ink px-2 py-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
