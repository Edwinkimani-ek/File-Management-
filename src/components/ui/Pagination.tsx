import Link from 'next/link';

export const PAGE_SIZE = 25;

export function Pagination({
  page,
  total,
  basePath,
  params,
}: {
  page: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total === 0) return null;

  const href = (p: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (p > 1) search.set('page', String(p));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-3 border-t border-ink-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-600">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn-secondary">
            Previous
          </Link>
        ) : (
          <span className="btn-secondary opacity-50">Previous</span>
        )}
        <span className="text-sm text-ink-600">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className="btn-secondary">
            Next
          </Link>
        ) : (
          <span className="btn-secondary opacity-50">Next</span>
        )}
      </div>
    </div>
  );
}

/** Reads ?page= from search params, clamped to a sane value. */
export function pageFromParams(value: string | undefined): number {
  const n = Number(value ?? '1');
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function rangeFor(page: number): [number, number] {
  const from = (page - 1) * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1];
}
