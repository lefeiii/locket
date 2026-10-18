"use client";

import { EmailNotificationSettings } from "@/components/EmailNotificationSettings";
import { BellRing, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppNav, BrandBar } from "@/components/AppNav";

const preferenceItems = [
  ["followed_story_updates", "Update alarms for followed stories"],
  ["followed_persona_updates", "Update alarms for followed personas"],
  ["poll_result_reminders", "Poll result reminders"],
  ["seasonal_wrapped_reminders", "Seasonal Wrapped reminders"]
] as const;

type PreferenceKey = (typeof preferenceItems)[number][0];
type Preferences = Record<PreferenceKey, boolean> & {
  update_alarms_enabled: boolean;
  browser_push_enabled: boolean;
};

const defaultPreferences: Preferences = {
  update_alarms_enabled: false,
  followed_story_updates: true,
  followed_persona_updates: true,
  poll_result_reminders: true,
  seasonal_wrapped_reminders: true,
  browser_push_enabled: false
};

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    if (typeof window === "undefined") {
      return defaultPreferences;
    }
    const saved = window.localStorage.getItem("locket.notificationPreferences");
    return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
  });
  const [message, setMessage] = useState("");

  function save(next: Preferences) {
    setPreferences(next);
    window.localStorage.setItem("locket.notificationPreferences", JSON.stringify(next));
  }

  async function enableBrowserPush() {
    if (!("Notification" in window)) {
      setMessage("Browser push is not available here yet. In-app alarms still work.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      save({ ...preferences, update_alarms_enabled: true, browser_push_enabled: true });
      setMessage("Browser push is on. Locket will also keep in-app notifications here.");
      return;
    }

    save({ ...preferences, update_alarms_enabled: true, browser_push_enabled: false });
    setMessage("No worries. You can still follow stories and see alerts inside Locket.");
  }

  return (
    <main className="pb-24">
      <BrandBar />
      <section className="mx-auto max-w-md px-4 py-6">
        <EmailNotificationSettings />
        <div className="rounded-[2rem] border border-[#c8b7a7] bg-[#f1e9e1] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#6b4a3a]">Update Alarm</p>
          <h1 className="mt-2 text-3xl font-medium leading-tight text-[#4f3325]">Choose what pulls you back in</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-[#6b4a3a]">
            Alarms are opt-in. Locket can follow the story without browser notifications if you prefer.
          </p>

          <button
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#c88d7d] px-4 text-sm font-medium text-[#4f3325]"
            onClick={enableBrowserPush}
            type="button"
          >
            <BellRing size={18} />
            Turn On Update Alarm
          </button>
          {message ? <p className="mt-3 text-center text-xs font-medium leading-5 text-[#6b4a3a]">{message}</p> : null}
        </div>

        <section className="mt-5 grid gap-3">
          {preferenceItems.map(([key, label]) => (
            <label
              className="flex items-center justify-between gap-4 rounded-3xl border border-[#c8b7a7] bg-[#f1e9e1] p-4 shadow-sm"
              key={key}
            >
              <span className="text-sm font-medium text-[#4f3325]">{label}</span>
              <button
                aria-pressed={preferences[key]}
                className={`grid h-8 w-8 place-items-center rounded-full ${
                  preferences[key] ? "bg-[#c88d7d] text-[#4f3325]" : "bg-[#d8d6d2] text-[#6b4a3a]"
                }`}
                onClick={() => save({ ...preferences, [key]: !preferences[key] })}
                type="button"
              >
                {preferences[key] ? <Check size={16} /> : null}
              </button>
            </label>
          ))}
        </section>

        <Link className="mt-5 block text-center text-sm font-medium text-[#4f3325]" href="/">
          Back to feed
        </Link>
      </section>
      <AppNav />
    </main>
  );
}
