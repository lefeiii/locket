"use client";

import { responseModes, type ResponseMode } from "@/lib/response-mode";

export function ResponseModeSelect({ value, onChange }: {
  value: ResponseMode;
  onChange: (value: ResponseMode) => void;
}) {
  return (
    <label className="mt-5 block text-sm font-medium text-[#514137]">
      What do you need from readers?
      <select value={value} onChange={event => onChange(event.target.value as ResponseMode)}
        className="mt-2 min-h-12 w-full rounded-2xl border border-[#e5d5c2] bg-[#fffaf2] px-4 text-base outline-none ring-[#e9b3ad] focus:ring-4">
        {Object.entries(responseModes).map(([mode, option]) => (
          <option key={mode} value={mode}>{option.label}</option>
        ))}
      </select>
      <span className="mt-2 block text-xs font-normal leading-5 text-[#7d695a]">
        {responseModes[value].description} You can change this later.
      </span>
    </label>
  );
}
