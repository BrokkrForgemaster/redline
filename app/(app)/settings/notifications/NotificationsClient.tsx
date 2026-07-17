"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Mail, Smartphone, Info, Save } from "lucide-react";

const EMAIL_PREFS_KEY = "redline_email_notification_prefs";

interface EmailPrefs {
  new_leads: boolean;
  job_completed: boolean;
  invoice_overdue: boolean;
  low_stock_alerts: boolean;
}

const DEFAULT_PREFS: EmailPrefs = {
  new_leads: true,
  job_completed: false,
  invoice_overdue: true,
  low_stock_alerts: true,
};

export default function NotificationsClient() {
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_PREFS_KEY);
      if (saved) {
        setEmailPrefs(JSON.parse(saved) as EmailPrefs);
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const handleToggle = (key: keyof EmailPrefs) => {
    setEmailPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(EMAIL_PREFS_KEY, JSON.stringify(emailPrefs));
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    }
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

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          Notification preferences are managed at the account level. Email notifications are sent
          to the address associated with your profile.
        </p>
      </div>

      {/* Push Notifications */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <Smartphone size={18} className="text-muted" />
          </div>
          <div>
            <h2 className="font-semibold text-charcoal">Push Notifications</h2>
            <p className="text-xs text-muted">Browser and mobile push alerts</p>
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-charcoal">Enable Push Notifications</p>
            <p className="text-xs text-muted mt-0.5">
              Requires service worker configuration — contact your developer to enable.
            </p>
          </div>
          <div className="w-10 h-6 rounded-full bg-gray-200 relative cursor-not-allowed opacity-50">
            <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow" />
          </div>
        </div>
      </div>

      {/* Email Notifications */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <Mail size={18} className="text-muted" />
          </div>
          <div>
            <h2 className="font-semibold text-charcoal">Email Notifications</h2>
            <p className="text-xs text-muted">Alerts sent to your account email address</p>
          </div>
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-3">
          {(
            [
              { key: "new_leads" as const, label: "New Leads", desc: "When a new lead is submitted" },
              { key: "job_completed" as const, label: "Job Completed", desc: "When a job is marked complete" },
              { key: "invoice_overdue" as const, label: "Invoice Overdue", desc: "When an invoice passes its due date" },
              { key: "low_stock_alerts" as const, label: "Low Stock Alerts", desc: "When inventory falls below reorder point" },
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
