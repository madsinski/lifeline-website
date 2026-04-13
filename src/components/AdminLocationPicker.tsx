"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  value: string;
  onChange: (location: string, lat?: number, lng?: number) => void;
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

export default function AdminLocationPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<{ description: string; place_id: string }[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 64.135, lng: -21.895 }); // Default: Reykjavik
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    if (window.google?.maps) { setMapsLoaded(true); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init services
  useEffect(() => {
    if (!mapsLoaded) return;
    autocompleteRef.current = new google.maps.places.AutocompleteService();
    geocoderRef.current = new google.maps.Geocoder();
  }, [mapsLoaded]);

  // Init map when shown
  useEffect(() => {
    if (!showMap || !mapsLoaded || !mapRef.current || mapInstanceRef.current) return;
    const map = new google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
    });
    mapInstanceRef.current = map;

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarker({ lat, lng });

      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = new google.maps.Marker({ position: { lat, lng }, map });

      // Reverse geocode
      geocoderRef.current?.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const addr = results[0].formatted_address;
          setQuery(addr);
          onChange(addr, lat, lng);
        } else {
          const loc = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setQuery(loc);
          onChange(loc, lat, lng);
        }
      });
    });
  }, [showMap, mapsLoaded]);

  // Autocomplete search
  const searchPlaces = useCallback((input: string) => {
    if (!autocompleteRef.current || input.length < 3) { setSuggestions([]); return; }
    autocompleteRef.current.getPlacePredictions({ input }, (predictions, status) => {
      if (status === "OK" && predictions) {
        setSuggestions(predictions.map(p => ({ description: p.description, place_id: p.place_id })));
      } else {
        setSuggestions([]);
      }
    });
  }, []);

  const selectSuggestion = (suggestion: { description: string; place_id: string }) => {
    setQuery(suggestion.description);
    setSuggestions([]);
    // Geocode to get lat/lng
    geocoderRef.current?.geocode({ placeId: suggestion.place_id }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const loc = results[0].geometry.location;
        const lat = loc.lat();
        const lng = loc.lng();
        onChange(suggestion.description, lat, lng);
        setMarker({ lat, lng });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat, lng });
          mapInstanceRef.current.setZoom(15);
          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new google.maps.Marker({ position: { lat, lng }, map: mapInstanceRef.current });
        }
      } else {
        onChange(suggestion.description);
      }
    });
  };

  // No API key — simple text input
  if (!GOOGLE_MAPS_KEY) {
    return (
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
          placeholder="Enter address or location name"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
        />
        <p className="text-[10px] text-gray-400 mt-1">Add NEXT_PUBLIC_GOOGLE_MAPS_KEY to enable map picker</p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); searchPlaces(e.target.value); }}
          placeholder="Search address..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none pr-20"
        />
        <button
          type="button"
          onClick={() => { setShowMap(!showMap); if (!showMap) mapInstanceRef.current = null; }}
          className="absolute right-1 top-1 px-2 py-1 text-[10px] font-medium text-cyan-700 bg-cyan-50 rounded hover:bg-cyan-100 transition-colors"
        >
          {showMap ? "Hide map" : "Pick on map"}
        </button>
        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.place_id}
                onClick={() => selectSuggestion(s)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                {s.description}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Map */}
      {showMap && (
        <div ref={mapRef} className="mt-2 w-full h-48 rounded-lg border border-gray-200 overflow-hidden" />
      )}
    </div>
  );
}
