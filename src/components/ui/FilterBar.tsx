'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface FilterSelect {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Search box plus filter selects, wired to the URL so that every list view
 * is linkable and the server component does the actual filtering.
 */
export function FilterBar({
  searchPlaceholder = 'Search…',
  selects = [],
}: {
  searchPlaceholder?: string;
  selects?: FilterSelect[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');

  useEffect(() => {
    setQuery(params.get('q') ?? '');
  }, [params]);

  const push = (next: URLSearchParams) => {
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (query.trim()) next.set('q', query.trim());
    else next.delete('q');
    push(next);
  };

  const onSelect = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    push(next);
  };

  const hasFilters = Array.from(params.keys()).some((k) => k !== 'page');

  return (
    <form
      onSubmit={onSearch}
      className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="min-w-0 flex-1 sm:min-w-[16rem]">
        <label className="label" htmlFor="filter-q">
          Search
        </label>
        <input
          id="filter-q"
          name="q"
          className="input"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {selects.map((select) => (
        <div key={select.name} className="sm:w-48">
          <label className="label" htmlFor={`filter-${select.name}`}>
            {select.label}
          </label>
          <select
            id={`filter-${select.name}`}
            className="input"
            value={params.get(select.name) ?? ''}
            onChange={(e) => onSelect(select.name, e.target.value)}
          >
            <option value="">All</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Search
        </button>
        {hasFilters ? (
          <button type="button" className="btn-secondary" onClick={() => router.push(pathname)}>
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}
