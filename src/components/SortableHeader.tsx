import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

interface SortableHeaderProps<T extends string> {
  field: T;
  currentField: T;
  currentOrder: 'asc' | 'desc';
  onSort: (field: T) => void;
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function SortableHeader<T extends string>({
  field,
  currentField,
  currentOrder,
  onSort,
  children,
  align = 'left',
  className = '',
}: SortableHeaderProps<T>) {
  const isActive = field === currentField;

  const alignClass =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

    const ariaSort: 'ascending' | 'descending' | 'none' = isActive
    ? (currentOrder === 'asc' ? 'ascending' : 'descending')
    : 'none';

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`p-0 whitespace-nowrap text-xs font-semibold ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`w-full py-3 px-3 cursor-pointer select-none transition-colors group flex items-center space-x-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset ${alignClass} ${
          isActive
            ? 'text-cyan-300 font-bold bg-slate-900/80 border-b-2 border-cyan-500/80'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
        }`}
        title={`클릭하여 ${isActive ? (currentOrder === 'desc' ? '오름차순' : '내림차순') : '정렬'} 변경`}
      >
        <span className="truncate">{children}</span>
        <span className="shrink-0 transition-transform">
          {isActive ? (
            currentOrder === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400" aria-hidden="true" />
          )}
        </span>
      </button>
    </th>
  );
}
