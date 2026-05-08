import clsx from 'clsx';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No data available',
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="table-container">
        <div className="p-8">
          <div className="flex flex-col gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 skeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const rows: T[] = Array.isArray(data) ? data : [];

  if (rows.length === 0) {
    return (
      <div className="table-container">
        <div className="p-12 text-center text-gray-500">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="table-container overflow-x-auto">
      <table className="w-full">
        <thead className="table-header">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={clsx(
                  'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr
              key={keyExtractor(item)}
              className={clsx('table-row', onRowClick && 'cursor-pointer')}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={clsx('px-4 py-3 text-sm', column.className)}
                >
                  {column.render
                    ? column.render(item)
                    : (item as any)[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  /**
   * How many consecutive numbered buttons to show in the sliding window
   * around / leading to the current page (default 10).
   * The first page and last page are always shown, with `…` collapsing any gap.
   */
  windowSize?: number;
}

/**
 * Build a page list like:
 *   [1,2,3,4,5,6,7,8,9,10,'dots',57]   (near start)
 *   [1,'dots',23,24,25,26,27,28,29,30,31,32,'dots',57]   (middle)
 *   [1,'dots',48,49,50,51,52,53,54,55,56,57]   (near end)
 *
 * Shows up to `windowSize` consecutive numbered pages, plus first & last
 * with `…` separators when there is a gap.
 */
function buildPageItems(page: number, totalPages: number, windowSize = 10): (number | 'dots')[] {
  if (totalPages <= 0) return [];
  if (totalPages <= windowSize + 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // Center the window on `page`, but clamp so it doesn't run past the ends.
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  let end = start + windowSize - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - windowSize + 1);
  }

  const showLeftDots = start > 2;
  const showRightDots = end < totalPages - 1;

  // If we're near the start, anchor to page 1 and grow the window forward.
  if (!showLeftDots) {
    start = 1;
    end = Math.min(totalPages, windowSize);
    const leftRange = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return end < totalPages - 1
      ? [...leftRange, 'dots', totalPages]
      : end === totalPages - 1
        ? [...leftRange, totalPages]
        : leftRange;
  }

  // If we're near the end, anchor to last page and grow the window backward.
  if (!showRightDots) {
    end = totalPages;
    start = Math.max(1, totalPages - windowSize + 1);
    const rightRange = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return start > 2
      ? [1, 'dots', ...rightRange]
      : start === 2
        ? [1, ...rightRange]
        : rightRange;
  }

  // Middle: 1 … [window] … last
  const middle = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return [1, 'dots', ...middle, 'dots', totalPages];
}

export function Pagination({ page, totalPages, onPageChange, total, windowSize = 10 }: PaginationProps) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-500">
          {total !== undefined && `Total: ${total} items`}
        </div>
      </div>
    );
  }

  const items = buildPageItems(page, totalPages, windowSize);

  return (
    <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
      <div className="text-sm text-gray-500">
        {total !== undefined && `Total: ${total} items`}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn btn-secondary btn-sm"
        >
          Previous
        </button>
        {items.map((it, idx) =>
          it === 'dots' ? (
            <span
              key={`dots-${idx}`}
              className="px-2 text-sm text-gray-400 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={it}
              onClick={() => onPageChange(it)}
              aria-current={it === page ? 'page' : undefined}
              className={
                it === page
                  ? 'btn btn-primary btn-sm min-w-[2.25rem]'
                  : 'btn btn-secondary btn-sm min-w-[2.25rem]'
              }
            >
              {it}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn btn-secondary btn-sm"
        >
          Next
        </button>
      </div>
    </div>
  );
}
