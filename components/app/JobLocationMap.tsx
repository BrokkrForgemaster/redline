"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface LocationTag {
  id: string;
  tag_type: string;
  latitude: number;
  longitude: number;
  captured_at_device: string;
  employee_name: string;
}

const TAG_COLORS: Record<string, string> = {
  start:        "#16A34A",
  finish:       "#B11226",
  photo_before: "#2563EB",
  photo_after:  "#7C3AED",
  manual:       "#6B7280",
};

const TAG_LABELS: Record<string, string> = {
  start:        "Start",
  finish:       "Finish",
  photo_before: "Before Photo",
  photo_after:  "After Photo",
  manual:       "Manual Tag",
};

function makeIcon(tagType: string) {
  const color = TAG_COLORS[tagType] ?? "#6B7280";
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="28" viewBox="0 0 28 36" fill="none">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="13" r="5" fill="white"/>
    </svg>`,
    className: "",
    iconSize: [22, 28],
    iconAnchor: [11, 28],
    popupAnchor: [0, -28],
  });
}

export default function JobLocationMap({ tags }: { tags: LocationTag[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    tags.forEach(tag => {
      const ts = new Date(tag.captured_at_device).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      L.marker([tag.latitude, tag.longitude], { icon: makeIcon(tag.tag_type) })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui;font-size:12px;line-height:1.5;">
            <strong style="color:#1F1F1F;">${TAG_LABELS[tag.tag_type] ?? tag.tag_type}</strong><br/>
            <span style="color:#6B7280;">${tag.employee_name}</span><br/>
            <span style="color:#6B7280;">${ts}</span>
          </div>`
        );
    });

    if (tags.length === 1) {
      map.setView([tags[0].latitude, tags[0].longitude], 15);
    } else if (tags.length > 1) {
      const bounds = L.latLngBounds(tags.map(t => [t.latitude, t.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }

    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [tags]);

  return <div ref={mapRef} className="w-full h-full" style={{ zIndex: 0 }} />;
}
