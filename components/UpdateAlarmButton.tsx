"use client";

import { BellRing } from "lucide-react";
import { useState } from "react";

type UpdateAlarmButtonProps = {
  label?: string;
};

export function UpdateAlarmButton({ label = "Turn On Update Alarm" }: UpdateAlarmButtonProps) {
  const [message, setMessage] = useState("");

  async function enableAlarm() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setMessage("Alarms are saved in Locket. Browser push is not available here yet.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      window.localStorage.setItem("locket.updateAlarms", "enabled");
      setMessage("Update alarms are on. In-app alerts will also appear here.");
      return;
    }

    setMessage("No worries. You can still follow stories inside Locket and check alerts here.");
  }

  return (
    <div className="grid gap-2">
      <button
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#f8c0c8] px-4 text-sm font-medium text-[#4b4b47]"
        onClick={enableAlarm}
        type="button"
      >
        <BellRing size={18} />
        {label}
      </button>
      {message ? <p className="text-center text-xs font-medium leading-5 text-[#787775]">{message}</p> : null}
    </div>
  );
}
