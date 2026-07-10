"use client";

import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Search } from "lucide-react";
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

/** Google Places autocomplete bound to the glass search input. */
export function PlaceAutocomplete({ placeholder = "Enter destination...", onSelect, className, autoFocus }: PlaceAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary("places");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!places || !inputRef.current) return;

    try {
      const autocomplete = new places.Autocomplete(inputRef.current, {
        fields: ["formatted_address", "geometry.location"],
      });

      const listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const loc = place.geometry?.location;
        if (!loc) return;
        onSelect({
          address: place.formatted_address ?? inputRef.current?.value ?? "",
          location: { lat: loc.lat(), lng: loc.lng() },
        });
      });

      setReady(true);
      return () => listener?.remove();
    } catch {
      // Maps SDK failed to initialise (bad/missing key) — leave input disabled.
      return;
    }
  }, [places, onSelect]);

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="absolute left-4 h-5 w-5 text-secondary" />
      <Input
        ref={inputRef}
        placeholder={ready ? placeholder : "Search unavailable — Maps key missing"}
        className="pl-12"
        autoFocus={autoFocus}
        disabled={!ready}
        aria-label={placeholder}
      />
    </div>
  );
}
