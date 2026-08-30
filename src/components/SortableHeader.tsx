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

  return (
    <th
      onClick={() => onSort(field)}
      className={`py-3 px-3 cursor-pointer select-none transition-colors group whitespace-nowrap ${
        isActive
          ? 'text-cyan-300 font-bold bg-slate-900/80 border-b-2 border-cyan-500/80'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
      } ${className}`}
      title={`클릭하여 ${isActive ? (currentOrder === 'desc' ? '오름차순' : '내림차순') : '정렬'} 변경`}
    >
      <div className={`flex items-center space-x-1.5 ${alignClass}`}>
        <span className="truncate">{children}</span>
        <span className="shrink-0 transition-transform">
          {isActive ? (
            currentOrder === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
          )}
        </span>
      </div>
    </th>
  );
}
