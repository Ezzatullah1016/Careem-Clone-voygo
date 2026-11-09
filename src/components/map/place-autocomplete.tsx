"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin, Search } from "lucide-react";
import type { LatLng } from "@/core/entities";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PlaceResult {
  address: string;
  location: LatLng;
}

interface PlaceAutocompleteProps {
  placeholder?: string;
  onSelect: (place: PlaceResult) => void;
  className?: string;
  autoFocus?: boolean;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

/**
 * Google Places autocomplete bound to the glass search input.
 * Uses Places API (New) — `AutocompleteSuggestion` + `Place.fetchFields` —
 * since the legacy `places.Autocomplete` widget can't be enabled on new
 * Cloud projects. One session token spans the typing + the final fetchFields.
 */
export function PlaceAutocomplete({ placeholder = "Enter destination...", onSelect, className, autoFocus }: PlaceAutocompleteProps) {
  const places = useMapsLibrary("places");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestId = useRef(0);
  const selectedText = useRef<string | null>(null);

  // Debounced suggestion fetch; stale responses are dropped via requestId.
  useEffect(() => {
    if (!places) return;
    const input = query.trim();
    const id = ++requestId.current;
    if (input.length < MIN_CHARS || input === selectedText.current) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      tokenRef.current ??= new places.AutocompleteSessionToken();
      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: tokenRef.current,
        });
        if (id !== requestId.current) return;
        setSuggestions(suggestions.flatMap((s) => (s.placePrediction ? [s.placePrediction] : [])));
        setActive(-1);
      } catch (err) {
        if (id === requestId.current) setSuggestions([]);
        console.error("Place autocomplete failed", err);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [places, query]);

  const select = useCallback(
    async (prediction: google.maps.places.PlacePrediction) => {
      const place = prediction.toPlace();
      try {
        await place.fetchFields({ fields: ["formattedAddress", "location"] });
      } catch (err) {
        console.error("Place details failed", err);
        return;
      } finally {
        // fetchFields ends the billing session; next keystroke starts a new one.
        tokenRef.current = null;
      }
      const loc = place.location;
      if (!loc) return;
      const address = place.formattedAddress ?? prediction.text.text;
      selectedText.current = address;
      setQuery(address);
      setSuggestions([]);
      setOpen(false);
      onSelect({ address, location: { lat: loc.lat(), lng: loc.lng() } });
    },
    [onSelect]
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = suggestions[active >= 0 ? active : 0];
      if (pick) void select(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const ready = Boolean(places);
  const showList = open && suggestions.length > 0;

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="absolute left-4 z-10 h-5 w-5 text-secondary" />
      <Input
        value={query}
        onChange={(e) => {
          selectedText.current = null;
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={ready ? placeholder : "Search unavailable — Maps key missing"}
        className="pl-12"
        autoFocus={autoFocus}
        disabled={!ready}
        autoComplete="off"
        role="combobox"
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl bg-white/90 p-1 shadow-glass backdrop-blur-glass dark:bg-inverse-surface/90"
        >
          {suggestions.map((p, i) => (
            <li
              key={p.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus on the input so onBlur doesn't close the list before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void select(p)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2",
                i === active && "bg-surface-container dark:bg-white/10"
              )}
            >
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary-container" />
              <div className="min-w-0">
                <p className="truncate text-body-md text-on-surface dark:text-white">
                  {p.mainText?.text ?? p.text.text}
                </p>
                {p.secondaryText && (
                  <p className="truncate text-label-sm text-on-surface-variant dark:text-white/60">
                    {p.secondaryText.text}
                  </p>
                )}
              </div>
            </li>
          ))}
          <li aria-hidden className="px-3 pb-1 pt-2 text-right text-[10px] text-on-surface-variant dark:text-white/50">
            Powered by Google
          </li>
        </ul>
      )}
    </div>
  );
}
