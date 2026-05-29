"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ReportReason } from "@/lib/types";

const reasons: ReportReason[] = [
  "Bullying",
  "Doxxing",
  "Harassment",
  "Hate",
  "Sexual content involving minors",
  "Other"
];

type ReportModalProps = {
  storyId: string;
  storyTitle: string;
  open: boolean;
  onClose: () => void;
};

export function ReportModal({ storyId, storyTitle, open, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>("Bullying");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");

  if (!open) {
    return null;
  }

  async function submitReport() {
    setStatus("submitting");
    if (supabase && !storyId.startsWith("sample-")) {
      await supabase.from("reports").insert({
        story_id: storyId,
        reason,
        details
      });
    }
    setStatus("sent");
    window.setTimeout(onClose, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#4b4b47]/45 p-3 sm:items-center">
      <div className="max-h-[calc(100svh-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-[#f8f8f6] p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#787775]">Report</p>
            <h2 className="mt-1 text-xl font-medium text-[#4b4b47]">{storyTitle}</h2>
          </div>
          <button
            aria-label="Close report modal"
            className="grid h-10 w-10 place-items-center rounded-full bg-[#e1e2e6] text-[#4b4b47]"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-2">
          {reasons.map((item) => (
            <label
              className="flex items-center gap-3 rounded-2xl border border-[#d8d3ce] bg-[#e1e2e6] px-3 py-3 text-sm font-medium text-[#4b4b47]"
              key={item}
            >
              <input
                checked={reason === item}
                className="h-4 w-4 accent-[#787775]"
                name="reason"
                onChange={() => setReason(item)}
                type="radio"
              />
              {item}
            </label>
          ))}
        </div>

        <textarea
          className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] p-3 text-sm outline-none ring-[#f8c0c8] focus:ring-4"
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Add details for the safety team"
          value={details}
        />

        <button
          className="mt-4 w-full rounded-2xl bg-[#f8c0c8] px-4 py-3 text-sm font-medium text-[#4b4b47] disabled:opacity-60"
          disabled={status === "submitting" || status === "sent"}
          onClick={submitReport}
          type="button"
        >
          {status === "sent" ? "Report sent" : "Submit report"}
        </button>
      </div>
    </div>
  );
}
