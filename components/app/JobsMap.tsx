"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface JobMapMarker {
  jobId: string;
  jobNumber: string;
  title: string;
  customerName: string;
  status: string;
  scheduledDate: string | null;
  lat: number;
  lng: number;
}

function statusColor(status: string): string {
  if (["scheduled", "en_route", "arrived", "in_progress"].includes(status)) return "#16A34A";
  if (["paused", "quality_review", "follow_up_required"].includes(status)) return "#D97706";
  if (["completed", "archived"].includes(status)) return "#6B7280";
  if (["cancelled", "weather_delayed"].includes(status)) return "#EF4444";
  return "#B11226";
}

function makeIcon(status: string) {
  const color = statusColor(status);
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" fill="none">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="13" r="5" fill="white"/>
    </svg>`,
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

export default function JobsMap({ jobs }: { jobs: JobMapMarker[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [37.65, -84.45],
      zoom: 10,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    jobs.forEach(job => {
      L.marker([job.lat, job.lng], { icon: makeIcon(job.status) })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui;min-width:180px;line-height:1.5;">
            <strong style="font-size:13px;color:#1F1F1F;">${job.jobNumber}</strong><br/>
            <p style="font-size:12px;color:#374151;margin:2px 0 0;">${job.title}</p>
            <p style="font-size:11px;color:#6B7280;margin:2px 0 0;">${job.customerName}</p>
            ${job.scheduledDate ? `<p style="font-size:11px;color:#6B7280;margin:2px 0 0;">${job.scheduledDate}</p>` : ""}
            <a href="/jobs/${job.jobId}" style="display:inline-block;margin-top:6px;font-size:12px;color:#B11226;font-weight:600;text-decoration:none;">View job →</a>
          </div>`
        );
    });

    if (jobs.length > 0) {
      const bounds = L.latLngBounds(jobs.map(j => [j.lat, j.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [jobs]);

  return <div ref={mapRef} className="w-full h-[420px] rounded-b-xl" style={{ zIndex: 0 }} />;
}
