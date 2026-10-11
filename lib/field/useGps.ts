"use client";

import { useState, useCallback } from "react";

export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  captured_at_device: string;
}

export interface UseGpsResult {
  location: GpsLocation | null;
  acquiring: boolean;
  error: string | null;
  acquire: () => Promise<GpsLocation | null>;
  clear: () => void;
}

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 15_000,
};

function positionErrorMessage(err: GeolocationPositionError): string {
  if (err.code === 1) return "Location permission denied. Please allow location access and try again.";
  if (err.code === 2) return "Location unavailable. Move to an area with better GPS signal.";
  return "GPS timed out. Move to an open area and try again.";
}

export function useGps(): UseGpsResult {
  const [location, setLocation] = useState<GpsLocation | null>(null);
  const [acquiring, setAcquiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acquire = useCallback((): Promise<GpsLocation | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setError("GPS is not available on this device.");
        resolve(null);
        return;
      }

      setAcquiring(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: GpsLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_meters: pos.coords.accuracy,
            captured_at_device: new Date(pos.timestamp).toISOString(),
          };
          setLocation(loc);
          setAcquiring(false);
          resolve(loc);
        },
        (err) => {
          const msg = positionErrorMessage(err);
          setError(msg);
          setAcquiring(false);
          resolve(null);
        },
        GPS_OPTIONS
      );
    });
  }, []);

  const clear = useCallback(() => {
    setLocation(null);
    setError(null);
  }, []);

  return { location, acquiring, error, acquire, clear };
}
