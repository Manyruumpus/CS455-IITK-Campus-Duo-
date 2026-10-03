import React, { ReactNode } from 'react';

export interface TableWrapperProps {
  caption?: string;
  children: ReactNode;
  className?: string;
}

export const TableWrapper: React.FC<TableWrapperProps> = ({
  caption,
  children,
  className = '',
}) => {
  return (
    <div className={`w-full overflow-hidden rounded-lg border border-craft-border bg-craft-surface ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          {caption && <caption className="sr-only">{caption}</caption>}
          {children}
        </table>
      </div>
    </div>
  );
};
