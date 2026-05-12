import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { geoAPI, type GeoPlace } from '@/services/api';

export interface PlaceValue {
  /** Short label shown to drivers/customers (e.g. "King's Cross Station"). */
  name: string;
  /** Full formatted address. */
  address: string;
  lat: number;
  lng: number;
  /** Postal code parsed from the autocomplete suggestion. Captured so a
   *  route stop can persist the rider-matchable PIN even when the
   *  formatted `address` string doesn't include it (Nominatim sometimes
   *  drops the PIN for sparse rural records, e.g. "Aligarh, Uttar Pradesh,
   *  India"). */
  pincode?: string;
}

interface Props {
  value: PlaceValue | null;
  onChange: (v: PlaceValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** ISO 3166-1 alpha-2 country code(s), comma separated. Defaults to 'gb'. */
  countryCodes?: string;
  className?: string;
}

/**
 * A debounced address-autocomplete input that talks to the backend
 * `/geo/autocomplete` proxy (Nominatim). Used everywhere the admin needs
 * to pick a real-world location — route stops, zone centres, etc. The same
 * picked place can be re-used by drivers and customers because we store
 * the canonical name + lat/lng + formatted address.
 */
export function PlaceSearchInput({
  value,
  onChange,
  placeholder = 'Search for an address or place…',
  disabled,
  countryCodes = 'in',
  className,
}: Props) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input text in sync if value changes externally (edit mode load).
  useEffect(() => {
    setQuery(value?.name ?? '');
  }, [value?.name, value?.lat, value?.lng]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Debounced search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === value?.name) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await geoAPI.autocomplete(trimmed, { countrycodes: countryCodes });
        setResults(res.data?.data?.results ?? []);
        setOpen(true);
        setHighlight(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, countryCodes]);

  const pick = (p: GeoPlace) => {
    // Prefer the structured PIN from the autocomplete payload; as a
    // safety net try to pull one out of the formatted address (last 6
    // digits — typical Indian-format PIN position).
    const pinFromParts = p.parts?.pincode?.trim();
    const pinFromAddress = (p.address || p.displayName || '').match(/\b\d{6}\b/g)?.pop();
    const resolvedName = p.parts?.road
      ? [p.parts.road, p.parts.area || p.parts.city].filter(Boolean).join(', ')
      : p.address || p.displayName;
    const resolvedAddress = p.address || p.displayName;
    const initialPincode = pinFromParts || pinFromAddress || undefined;

    onChange({
      name: resolvedName,
      address: resolvedAddress,
      lat: p.lat,
      lng: p.lng,
      pincode: initialPincode,
    });
    setQuery(resolvedAddress);
    setOpen(false);

    // Autocomplete often returns region-level entries with no postal_code
    // (e.g. "Aligarh, Uttar Pradesh, India" returns parts.pincode=''). A
    // reverse geocode at the exact lat/lng falls back to a precise
    // building-level Nominatim result that almost always carries one.
    // Fire-and-forget — the form is already usable; the PIN field
    // populates when the reverse lookup resolves a few hundred ms later.
    if (!initialPincode && p.lat && p.lng) {
      geoAPI
        .reverse(p.lat, p.lng)
        .then((res) => {
          const rev = (res.data as any)?.data;
          const revPin: string | undefined =
            (rev?.parts?.pincode || '').toString().trim() ||
            ((rev?.address || rev?.displayName || '').match(/\b\d{6}\b/g) ?? []).pop() ||
            undefined;
          if (revPin) {
            onChange({
              name: resolvedName,
              address: resolvedAddress,
              lat: p.lat,
              lng: p.lng,
              pincode: revPin,
            });
          }
        })
        .catch(() => {
          /* keep the field empty; admin can type it in manually */
        });
    }
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={clsx('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          className="input pl-9 pr-9"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKey}
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            tabIndex={-1}
            aria-label="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {value && value.lat !== 0 && (
        <div className="text-[11px] text-gray-500 mt-1 truncate">
          {value.address} · {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </div>
      )}

      {open && results.length > 0 && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto py-1"
          role="listbox"
        >
          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={clsx(
                'px-3 py-2 text-sm cursor-pointer flex items-start gap-2',
                i === highlight ? 'bg-primary-50 text-primary-900' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <div className="truncate font-medium">{r.address}</div>
                <div className="text-[11px] text-gray-500 truncate">
                  {r.displayName}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
