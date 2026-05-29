"use client";

import { AlertTriangle, RefreshCcw, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { AppNav, BrandBar } from "@/components/AppNav";
import { categories, emptyReactions, generateAnonymousName } from "@/lib/sample-data";
import { findSafetyIssues, safetyWarning } from "@/lib/safety";
import { supabase } from "@/lib/supabase";
import type { StoryCategory } from "@/lib/types";

const cliffhangerIdeas = [
  "Then things got worse.",
  "I didn't expect what happened next.",
  "He found the messages."
];

export default function CreatePage() {
  const [anonymousName, setAnonymousName] = useState(generateAnonymousName());
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<StoryCategory>("Crush");
  const [body, setBody] = useState("");
  const [isUpdate, setIsUpdate] = useState(false);
  const [previousReference, setPreviousReference] = useState("");
  const [cliffhanger, setCliffhanger] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "local">("idle");
  const cleanedPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
  const hasPoll = pollQuestion.trim().length > 0 && cleanedPollOptions.length >= 2;
  const safetyIssues = useMemo(() => findSafetyIssues(`${title} ${body} ${previousReference}`), [
    title,
    body,
    previousReference
  ]);

  async function submitStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (safetyIssues.length > 0) {
      return;
    }

    setStatus("saving");
    const storyArcId = (previousReference || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const payload = {
      anonymous_name: anonymousName.trim() || generateAnonymousName(),
      title,
      category,
      body,
      is_update: isUpdate,
      previous_story_reference: isUpdate ? previousReference : null,
      story_arc_id: storyArcId,
      arc_title: previousReference || title,
      part_number: isUpdate ? 2 : 1,
      update_label: isUpdate ? "Update" : "Part 1",
      cliffhanger: cliffhanger || null,
      is_resolved: false,
      status: isUpdate ? "Update pending" : "Unresolved",
      status_updated_at: new Date().toISOString(),
      has_active_poll: hasPoll,
      reactions: emptyReactions()
    };

    if (supabase) {
      const { data, error } = await supabase.from("stories").insert(payload).select("id").single();
      if (!error && data?.id && hasPoll) {
        await supabase.from("story_polls").insert({
          story_id: data.id,
          question: pollQuestion.trim(),
          options: cleanedPollOptions,
          is_active: true
        });
      }
      setStatus(error ? "local" : "saved");
    } else {
      setStatus("local");
    }

    setTitle("");
    setBody("");
    setPreviousReference("");
    setCliffhanger("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setIsUpdate(false);
  }

  return (
    <main className="pb-24">
      <BrandBar />
      <section className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">Anonymous post</p>
          <h1 className="mt-2 text-3xl font-medium leading-tight text-[#4b4b47]">Drop the story</h1>
        </div>

        <form
          className="rounded-3xl border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm sm:p-6"
          onSubmit={submitStory}
        >
          <div className="mb-5 rounded-2xl bg-[#f8f8f6] p-4 text-sm font-medium leading-6 text-[#4b4b47]">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle size={18} />
              Safety first
            </div>
            {safetyWarning}
          </div>

          <label className="block text-sm font-medium text-[#4b4b47]">
            Anonymous username
            <div className="mt-2 flex gap-2">
              <input
                className="min-h-12 flex-1 rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-base font-medium outline-none ring-[#f8c0c8] focus:ring-4"
                onChange={(event) => setAnonymousName(event.target.value)}
                value={anonymousName}
              />
              <button
                aria-label="Generate username"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f8c0c8] text-[#4b4b47]"
                onClick={() => setAnonymousName(generateAnonymousName())}
                type="button"
              >
                <RefreshCcw size={18} />
              </button>
            </div>
          </label>

          <label className="mt-5 block text-sm font-medium text-[#4b4b47]">
            Title
            <input
              className="mt-2 min-h-12 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-base font-medium outline-none ring-[#f8c0c8] focus:ring-4"
              maxLength={90}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>

          <label className="mt-5 block text-sm font-medium text-[#4b4b47]">
            Category
            <select
              className="mt-2 min-h-12 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-base font-medium outline-none ring-[#f8c0c8] focus:ring-4"
              onChange={(event) => setCategory(event.target.value as StoryCategory)}
              value={category}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="mt-5 block text-sm font-medium text-[#4b4b47]">
            Story
            <textarea
              className="mt-2 min-h-64 w-full resize-none rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] p-4 text-base font-medium leading-7 outline-none ring-[#f8c0c8] focus:ring-4"
              maxLength={1400}
              onChange={(event) => setBody(event.target.value)}
              required
              value={body}
            />
          </label>

          <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-[#e1e2e6] p-4 text-sm font-medium text-[#4b4b47]">
            This is an update
            <input
              checked={isUpdate}
              className="h-5 w-5 accent-[#787775]"
              onChange={(event) => setIsUpdate(event.target.checked)}
              type="checkbox"
            />
          </label>

          {isUpdate ? (
            <label className="mt-4 block text-sm font-medium text-[#4b4b47]">
              Previous story title/link
              <input
                className="mt-2 min-h-12 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-base font-medium outline-none ring-[#f8c0c8] focus:ring-4"
                onChange={(event) => setPreviousReference(event.target.value)}
                value={previousReference}
              />
            </label>
          ) : null}

          <div className="mt-5 rounded-3xl bg-[#e1e2e6] p-4 text-[#4b4b47]">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles size={18} />
              Want to add a cliffhanger ending?
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {cliffhangerIdeas.map((idea) => (
                <button
                  className="shrink-0 rounded-full bg-[#f8f8f6] px-3 py-2 text-xs font-medium text-[#4b4b47]"
                  key={idea}
                  onClick={() => setCliffhanger(idea)}
                  type="button"
                >
                  {idea}
                </button>
              ))}
            </div>
            <input
              className="mt-3 min-h-12 w-full rounded-2xl border border-[#e1e2e6] bg-[#f8f8f6] px-4 text-base font-medium text-[#4b4b47] outline-none"
              onChange={(event) => setCliffhanger(event.target.value)}
              placeholder="Optional"
              value={cliffhanger}
            />
          </div>

          <div className="mt-5 rounded-3xl bg-[#e1e2e6] p-4 text-[#4b4b47]">
            <p className="text-sm font-medium">Ask readers what you should do</p>
            <p className="mt-1 text-xs font-medium leading-5 text-[#787775]">
              Optional. Add a quick vote if you want readers to help choose the next move.
            </p>
            <input
              className="mt-3 min-h-12 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-base font-medium outline-none ring-[#f8c0c8] focus:ring-4"
              maxLength={110}
              onChange={(event) => setPollQuestion(event.target.value)}
              placeholder="Should I text him back?"
              value={pollQuestion}
            />
            <div className="mt-3 grid gap-2">
              {pollOptions.map((option, index) => (
                <input
                  className="min-h-11 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-sm font-medium outline-none ring-[#f8c0c8] focus:ring-4"
                  key={index}
                  maxLength={60}
                  onChange={(event) => {
                    const nextOptions = [...pollOptions];
                    nextOptions[index] = event.target.value;
                    setPollOptions(nextOptions);
                  }}
                  placeholder={`Option ${index + 1}`}
                  value={option}
                />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {pollOptions.length < 4 ? (
                <button
                  className="rounded-full bg-[#f8f8f6] px-3 py-2 text-xs font-medium text-[#4b4b47]"
                  onClick={() => setPollOptions((current) => [...current, ""])}
                  type="button"
                >
                  Add option
                </button>
              ) : null}
              {pollOptions.length > 2 ? (
                <button
                  className="rounded-full bg-[#f8f8f6] px-3 py-2 text-xs font-medium text-[#4b4b47]"
                  onClick={() => setPollOptions((current) => current.slice(0, -1))}
                  type="button"
                >
                  Remove option
                </button>
              ) : null}
            </div>
          </div>

          {safetyIssues.length > 0 ? (
            <p className="mt-4 rounded-2xl bg-[#e1e2e6] p-3 text-sm font-medium text-[#4b4b47]">
              Please remove possible identifying or unsafe terms before posting: {safetyIssues.join(", ")}
            </p>
          ) : null}

          <button
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#f8c0c8] px-4 py-4 text-sm font-medium text-[#4b4b47] disabled:opacity-60"
            disabled={status === "saving" || safetyIssues.length > 0}
            type="submit"
          >
            <Send size={18} />
            {status === "saving" ? "Posting..." : "Submit story"}
          </button>

          {status === "saved" ? (
            <p className="mt-3 text-center text-sm font-medium text-[#4b4b47]">Story saved to Supabase.</p>
          ) : null}
          {status === "local" ? (
            <p className="mt-3 text-center text-sm font-medium text-[#4b4b47]">
              Supabase is not connected yet, but the posting flow is ready.
            </p>
          ) : null}
        </form>

        <Link className="mt-5 block text-center text-sm font-medium text-[#4b4b47]" href="/">
          Back to feed
        </Link>
      </section>
      <AppNav />
    </main>
  );
}
