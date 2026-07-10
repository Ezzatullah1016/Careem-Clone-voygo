"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { SavedLocation } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/glass/top-bar";
import { PlaceAutocomplete, type PlaceResult } from "@/components/map/place-autocomplete";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SavedLocationIcon } from "../home/saved-location-icon";

const ICON_CHOICES = ["home", "work", "fitness_center", "school", "favorite"];

/** Saved locations manager: label + icon + Places-picked address. */
export default function LocationsPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("home");
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void repos().savedLocations.listForUser(user.id).then(setLocations);
  }, [user]);

  async function save() {
    if (!user || !place || !label.trim()) return;
    setSaving(true);
    try {
      const saved = await repos().savedLocations.save({
        userId: user.id,
        label: label.trim(),
        icon,
        address: place.address,
        location: place.location,
      });
      setLocations((prev) => [...prev.filter((l) => l.id !== saved.id), saved]);
      setLabel("");
      setPlace(null);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await repos().savedLocations.remove(id);
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-primary-container/5 pb-[110px] pt-[90px]">
      <TopBar title="Saved Locations" backHref="/profile" />

      <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-container-padding">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <Label>Add a place</Label>
            <PlaceAutocomplete placeholder="Search address..." onSelect={setPlace} />
            {place && <p className="text-label-sm text-primary">{place.address}</p>}
            <div className="flex gap-2">
              <Input placeholder="Label (e.g. Home)" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {ICON_CHOICES.map((choice) => (
                <button
                  key={choice}
                  onClick={() => setIcon(choice)}
                  className={
                    icon === choice
                      ? "flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-glow"
                      : "glass-panel flex h-12 w-12 items-center justify-center rounded-full text-secondary"
                  }
                  aria-label={choice}
                >
                  <SavedLocationIcon name={choice} />
                </button>
              ))}
            </div>
            <Button onClick={save} disabled={!place || !label.trim() || saving}>
              Save location
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col divide-y divide-black/5 p-2">
            {locations.length === 0 && (
              <p className="p-6 text-center text-body-md text-on-surface-variant">No saved places yet.</p>
            )}
            {locations.map((loc) => (
              <div key={loc.id} className="flex items-center gap-4 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container/20 text-primary">
                  <SavedLocationIcon name={loc.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-label-md text-on-surface">{loc.label}</p>
                  <p className="truncate text-label-sm text-on-surface-variant">{loc.address}</p>
                </div>
                <button
                  onClick={() => remove(loc.id)}
                  className="rounded-full p-2 text-secondary transition-colors hover:bg-error-container hover:text-on-error-container"
                  aria-label={`Delete ${loc.label}`}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
