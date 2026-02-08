"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const cities: { name: string; lat: number; lng: number }[] = [
  { name: "Lexington", lat: 38.0406, lng: -84.5037 },
  { name: "Richmond", lat: 37.7479, lng: -84.2947 },
  { name: "Danville", lat: 37.6456, lng: -84.7722 },
  { name: "Nicholasville", lat: 37.8806, lng: -84.573 },
  { name: "Berea", lat: 37.5687, lng: -84.2963 },
  { name: "Winchester", lat: 37.99, lng: -84.1797 },
  { name: "Paris", lat: 38.2098, lng: -84.253 },
  { name: "Stanford", lat: 37.5312, lng: -84.6619 },
  { name: "Mount Vernon", lat: 37.3537, lng: -84.3405 },
  { name: "Somerset", lat: 37.0922, lng: -84.6041 },
  { name: "Eubank", lat: 37.2737, lng: -84.6383 },
];

// Custom red pin SVG as a data URI
const pinIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" fill="none">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="#B11226"/>
    <circle cx="14" cy="13" r="5" fill="white"/>
  </svg>`,
  className: "",
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
});

export default function ServiceAreaMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [37.65, -84.45],
      zoom: 9,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add attribution in bottom-right
    L.control.attribution({ position: "bottomright" }).addTo(map);

    // Add markers for each city
    cities.forEach((city) => {
      L.marker([city.lat, city.lng], { icon: pinIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui;text-align:center;padding:2px 0;">
            <strong style="font-size:13px;color:#1F1F1F;">${city.name}, KY</strong><br/>
            <span style="font-size:11px;color:#6B7280;">Redline Service Area</span>
          </div>`
        );
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapRef}
      className="w-full h-[400px] rounded-xl"
      style={{ zIndex: 0 }}
    />
  );
}
