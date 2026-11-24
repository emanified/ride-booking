import { useEffect, useRef, useState } from 'react'
import { searchLocations } from '../../utils/openStreetMap'

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 3

/**
 * LocationSearchInput
 *
 * Text input wired to Nominatim (OpenStreetMap) search. Styled to match the
 * app's existing .input-field look. Debounces requests and only searches
 * once the query is at least MIN_QUERY_LENGTH characters.
 */
export default function LocationSearchInput({
  label,
  placeholder = '',
  value,
  onChange,
  onPlaceSelect,
  error,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const lastSelectedRef = useRef(null)

  useEffect(() => {
    // Selecting a suggestion sets `value` to its address — don't immediately
    // re-search that same text.
    if (lastSelectedRef.current === value) {
      lastSelectedRef.current = null
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = value.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const results = await searchLocations(trimmed)
      setSuggestions(results)
      setIsOpen(true)
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [value])

  const handleSelect = (place) => {
    lastSelectedRef.current = place.address
    onChange(place.address)
    if (onPlaceSelect) onPlaceSelect(place)
    setIsOpen(false)
    setSuggestions([])
  }

  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>}
      <input
        type="text"
        className="input-field"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setIsOpen(true) }}
        onBlur={() => setIsOpen(false)}
      />
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full glass-panel rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-xl">
          {loading && <div className="px-3 py-2 text-xs text-zinc-500">Searching…</div>}
          {!loading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500">No results found.</div>
          )}
          {!loading &&
            suggestions.map((s) => (
              <button
                key={s.placeId}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="block w-full text-left px-3 py-2 text-sm text-zinc-700 hover:bg-yellow-50 border-b border-zinc-100 last:border-0"
              >
                {s.address}
              </button>
            ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
