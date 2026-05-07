import { useState } from 'react';
import { useGeocoder } from '../../hooks/useGeocoder';

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { results, loading, error } = useGeocoder(query);

  const handleSelect = (place) => {
    setQuery(place.placeName);
    setOpen(false);
    onSelect?.(place);
  };

  return (
    <div className="relative">
      <input
        type="search"
        placeholder="Where to?"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100"
              >
                {r.placeName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && loading && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-lg">
          Searching…
        </div>
      )}
      {error && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-lg">
          Search failed: {error.message}
        </div>
      )}
    </div>
  );
}
