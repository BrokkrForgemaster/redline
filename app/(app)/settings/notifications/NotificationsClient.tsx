"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, Smartphone } from "lucide-react";

function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=").replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

export default function NotificationsClient() {
  const [supported, setSupported] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [enabledOnDevice, setEnabledOnDevice] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setSupported(available);
      if (!available) return;
      try {
        const response = await fetch("/api/v1/push/subscription", { cache: "no-store" });
        if (!response.ok) throw new Error("Push settings are unavailable.");
        const settings = await response.json() as { publicKey: string };
        setPublicKey(settings.publicKey);
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const status = await fetch("/api/v1/push/subscription", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          if (status.ok) setEnabledOnDevice((await status.json()).registered === true);
        }
      } catch {
        setError("Push settings could not be loaded. In-app alerts remain available.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function enablePush() {
    if (!supported || !publicKey) return;
    setWorking(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
      const response = await fetch("/api/v1/push/subscription", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok || (await response.json()).saved !== true) {
        throw new Error("The device subscription was not saved. Please retry.");
      }
      setEnabledOnDevice(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not enable push alerts.");
    } finally {
      setWorking(false);
    }
  }

  async function disablePush() {
    setWorking(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/v1/push/subscription", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("Could not disable server push delivery. Please retry.");
        await subscription.unsubscribe();
      }
      setEnabledOnDevice(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disable push alerts.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Notifications</h1>
        <p className="mt-1 text-sm text-muted">Server push is optional. Your in-app inbox remains available when push is off or delayed.</p>
      </div>
      <div className="space-y-4 rounded-xl border bg-white p-6">
        <div className="flex items-center gap-3"><Smartphone size={20} className="text-redline" /><h2 className="font-semibold">Push alerts on this device</h2></div>
        <p className="text-sm text-muted">Install the app where required, then enable notifications from this device. Delivery depends on your browser and phone settings.</p>
        <p className="text-sm font-medium">{enabledOnDevice ? "Enabled and saved on server" : supported ? "Not enabled on this device" : "Push is unavailable in this browser"}</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="button" onClick={enabledOnDevice ? disablePush : enablePush}
          disabled={!supported || !publicKey || working}
          className="inline-flex items-center gap-2 rounded-lg bg-redline px-4 py-2 font-semibold text-white disabled:opacity-50">
          <BellRing size={16} /> {working ? "Saving…" : enabledOnDevice ? "Disable on this device" : "Enable alerts"}
        </button>
      </div>
      <p className="text-sm text-muted">Open <Link href="/dashboard" className="text-redline underline">your dashboard</Link> for in-app alerts. Push acceptance does not mark an alert read.</p>
    </div>
  );
}
