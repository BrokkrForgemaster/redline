"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BellRing, Mail, Smartphone, Info, Save } from "lucide-react";

const EMAIL_PREFS_KEY = "redline_email_notification_prefs";
const EMAIL_ADDRESS_KEY = "redline_notification_email";
const PUSH_ENABLED_KEY = "redline_push_notifications_enabled";

interface EmailPrefs {
  new_leads: boolean;
  job_activity: boolean;
}

const DEFAULT_PREFS: EmailPrefs = {
  new_leads: true,
  job_activity: true,
};

export default function NotificationsClient({ defaultEmail }: { defaultEmail: string }) {
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs>(DEFAULT_PREFS);
  const [notificationEmail, setNotificationEmail] = useState(defaultEmail);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(EMAIL_PREFS_KEY);
        const savedEmail = localStorage.getItem(EMAIL_ADDRESS_KEY);
        const savedPush = localStorage.getItem(PUSH_ENABLED_KEY);

        if (saved) setEmailPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(saved) as Partial<EmailPrefs>) });
        if (savedEmail) setNotificationEmail(savedEmail);
        setPushEnabled(savedPush === "true");
        setPushSupported("serviceWorker" in navigator && "Notification" in window);
        if ("Notification" in window) setPermission(Notification.permission);
      } catch {
        // Ignore malformed local preferences.
      }
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const handleToggle = (key: keyof EmailPrefs) => {
    setEmailPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(EMAIL_PREFS_KEY, JSON.stringify(emailPrefs));
      localStorage.setItem(EMAIL_ADDRESS_KEY, notificationEmail.trim());
      localStorage.setItem(PUSH_ENABLED_KEY, String(pushEnabled));
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    }
  };

  const handleEnablePush = async () => {
    if (!pushSupported) {
      toast.error("Push notifications are not supported in this browser.");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission !== "granted") {
      setPushEnabled(false);
      toast.error("Notification permission was not granted.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    setPushEnabled(true);
    localStorage.setItem(PUSH_ENABLED_KEY, "true");
    registration.showNotification("Redline alerts enabled", {
      body: "New in-app job alerts will also appear as PWA notifications on this device.",
      icon: "/images/logo.png",
      badge: "/images/logo.png",
      tag: "redline-alerts-enabled",
      data: { url: "/dashboard" },
    });
    toast.success("Push notifications enabled");
  };

  const handleTestPush = async () => {
    if (permission !== "granted") {
      await handleEnablePush();
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    registration.showNotification("Test Redline alert", {
      body: "This is how job alerts will appear on this device.",
      icon: "/images/logo.png",
      badge: "/images/logo.png",
      tag: "redline-test-alert",
      data: { url: "/dashboard" },
    });
  };

  if (!loaded) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Notifications</h1>
        <p className="text-sm text-muted mt-1">
          Control how and when you receive notifications.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          In-app alerts update the dashboard and jobs pages in realtime. PWA alerts appear on
          this device after browser permission is granted.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <Smartphone size={18} className="text-muted" />
          </div>
          <div>
            <h2 className="font-semibold text-charcoal">Push Notifications</h2>
            <p className="text-xs text-muted">Browser, PWA, and mobile home-screen alerts</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 py-2 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-charcoal">Enable Push Notifications</p>
            <p className="text-xs text-muted mt-0.5">
              Allows new in-app alerts to also show as device notifications.
            </p>
          </div>
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={!pushSupported || permission === "denied"}
            className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 disabled:opacity-50 ${
              pushEnabled && permission === "granted" ? "bg-redline" : "bg-gray-200"
            }`}
            aria-label="Enable push notifications"
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                pushEnabled && permission === "granted" ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <button
          type="button"
          onClick={handleTestPush}
          disabled={!pushSupported || permission === "denied"}
          className="inline-flex items-center gap-2 text-sm font-semibold text-redline hover:underline disabled:text-muted disabled:no-underline"
        >
          <BellRing size={14} />
          Test push alert
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <Mail size={18} className="text-muted" />
          </div>
          <div>
            <h2 className="font-semibold text-charcoal">Email Notifications</h2>
            <p className="text-xs text-muted">Alerts sent to the email address below</p>
          </div>
        </div>

        <div className="space-y-4 border-t border-gray-100 pt-3">
          <div>
            <label htmlFor="notification-email" className="block text-sm font-medium text-charcoal">
              Notification Email
            </label>
            <input
              id="notification-email"
              type="email"
              value={notificationEmail}
              onChange={(event) => setNotificationEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-redline focus:ring-2 focus:ring-redline/20"
              placeholder="alerts@example.com"
              autoComplete="email"
            />
            <p className="text-xs text-muted mt-1">
              Server email delivery still requires an email provider to be configured.
            </p>
          </div>

          {(
            [
              { key: "new_leads" as const, label: "New Leads", desc: "When a new lead is submitted" },
              { key: "job_activity" as const, label: "Job Started / Finished", desc: "When a subcontractor starts or finishes a job" },
            ] satisfies { key: keyof EmailPrefs; label: string; desc: string }[]
          ).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-charcoal">{label}</p>
                <p className="text-xs text-muted">{desc}</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(key)}
                className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                  emailPrefs[key] ? "bg-redline" : "bg-gray-200"
                }`}
                aria-label={`Toggle ${label}`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    emailPrefs[key] ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-redline text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-redline-dark transition-colors"
        >
          <Save size={14} />
          Save Preferences
        </button>
      </div>
    </div>
  );
}
