"use client";

import { AlertTriangle, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav, BrandBar } from "@/components/AppNav";
import { ResponseModeSelect } from "@/components/ResponseModeSelect";
import type { ResponseMode } from "@/lib/response-mode";
import { categories, emptyReactions } from "@/lib/sample-data";
import { findSafetyIssues, safetyWarning } from "@/lib/safety";
import { supabase } from "@/lib/supabase";
import type { Story, StoryCategory } from "@/lib/types";

const cliffhangerIdeas = [
  "Then things got worse.",
  "I didn't expect what happened next.",
  "He found the messages."
];

export default function CreatePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<StoryCategory>("my crush era");
  const [body, setBody] = useState("");
  const [responseMode, setResponseMode] = useState<ResponseMode>("anything");
  const [isUpdate, setIsUpdate] = useState(false);
  const [previousStoryId, setPreviousStoryId] = useState("");
  const [previousStories, setPreviousStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesError, setStoriesError] = useState("");
  const [storiesRetry, setStoriesRetry] = useState(0);
  const [cliffhanger, setCliffhanger] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    async function loadStories() {
      try {
        const { data, error } = await client!.auth.getUser();
        if (error || !data.user) { router.push("/login"); return; }
        const userId = data.user.id;
        const { data: profile, error: profileError } = await client!.from("users")
          .select("username").eq("id", userId).single();
        if (profileError || !profile?.username) throw new Error("Could not load your account.");
        if (cancelled) return;
        setUsername(profile.username);
        // Fetch every page, including older stories beyond Supabase's row limit.
        const ownStories: Story[] = [];
        for (let offset = 0; ; offset += 200) {
          const { data: rows, error: storiesLoadError } = await client!.from("stories")
            .select("*").eq("anonymous_name", profile.username).eq("is_hidden", false)
            .order("created_at", { ascending: false }).order("id", { ascending: false })
            .range(offset, offset + 199);
          if (storiesLoadError) throw new Error("Could not load your previous stories. Please try again.");
          if (cancelled) return;
          ownStories.push(...((rows ?? []) as Story[]).filter(story =>
            (!story.user_id || story.user_id === userId) && !story.is_private && !story.is_diary_only));
          if ((rows ?? []).length < 200) break;
        }
        if (!cancelled) {
          setPreviousStories(ownStories);
          setStoriesError("");
        }
      } catch (error) {
        if (!cancelled) setStoriesError(error instanceof Error ? error.message : "Could not load your stories.");
      } finally {
        if (!cancelled) setStoriesLoading(false);
      }
    }
    void loadStories();
    return () => { cancelled = true; };
  }, [router, storiesRetry]);

  const selectedStory = previousStories.find(story => story.id === previousStoryId);

  const cleanedPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const hasPoll = pollQuestion.trim().length > 0 && cleanedPollOptions.length >= 2;
  const safetyIssues = useMemo(() => findSafetyIssues(`${title} ${body}`), [title, body]);

  async function submitStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (safetyIssues.length > 0 || !username) return;
    if (isUpdate && (!selectedStory || storiesLoading || storiesError)) {
      setErrorMsg("Choose one of your previous stories before posting an update.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    const payload = {
      anonymous_name: username,
      title,
      category,
      body,
      is_update: isUpdate,
      response_mode: responseMode,
      cliffhanger: cliffhanger || null,
      is_resolved: false,
      status: isUpdate ? "Update pending" : "Unresolved",
      status_updated_at: new Date().toISOString(),
      has_active_poll: hasPoll,
      reactions: emptyReactions()
    };

    // Get auth token to pass to server-side API route
    const client = supabase;
    if (!client) {
      setErrorMsg("Database not connected. Please try again later.");
      setStatus("error");
      return;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      setErrorMsg("You must be logged in to post.");
      setStatus("error");
      router.push("/login");
      return;
    }

    // Submit through server-side route — safety check + rate limit enforced there
    const res = await fetch("/api/submit-story", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ payload, previousStoryId: isUpdate ? previousStoryId : null, pollQuestion: pollQuestion.trim(), pollOptions: cleanedPollOptions, hasPoll }),
    });

    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error ?? "Could not post story. Please try again.");
      setStatus("error");
      return;
    }

    setStatus("saved");
    setTitle(""); setBody(""); setPreviousStoryId(""); setCliffhanger(""); setPollQuestion(""); setPollOptions(["", ""]); setIsUpdate(false); setResponseMode("anything");
    setTimeout(() => router.push(`/story/${json.id}`), 1000);
  }

  return (
    <main className="pb-24">
      <BrandBar />
      <section className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">Anonymous post</p>
          <h1 className="mt-2 text-3xl font-medium leading-tight text-[#4b4b47]">Drop the story</h1>
        </div>

        <form className="rounded-3xl border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm sm:p-6" onSubmit={submitStory}>
          <div className="mb-5 rounded-2xl bg-[#f8f8f6] p-4 text-sm font-medium leading-6 text-[#4b4b47]">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle size={18} />Safety first
            </div>
            {safetyWarning}
          </div>

          {/* Posting as — no editable input */}
          <div className="mb-5 rounded-2xl bg-[#e1e2e6] px-4 py-3 text-sm font-medium text-[#4b4b47]">
            posting as <span className="font-semibold">@{username || "..."}</span>
          </div>

          <label className="block text-sm font-medium text-[#4b4b47]">
            Title
            <input
              className="mt-2 min-h-12 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-base font-medium outline-none ring-[#f8c0c8] focus:ring-4"
              maxLength={90} onChange={(e) => setTitle(e.target.value)} required value={title}
            />
          </label>

          <label className="mt-5 block text-sm font-medium text-[#4b4b47]">
            Category
            <select
              className="mt-2 min-h-12 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-base font-medium outline-none ring-[#f8c0c8] focus:ring-4"
              onChange={(e) => setCategory(e.target.value as StoryCategory)} value={category}
            >
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <ResponseModeSelect value={responseMode} onChange={setResponseMode} />

          <label className="mt-5 block text-sm font-medium text-[#4b4b47]">
            Story
            <textarea
              className="mt-2 min-h-64 w-full resize-none rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] p-4 text-base font-medium leading-7 outline-none ring-[#f8c0c8] focus:ring-4"
              maxLength={1400} onChange={(e) => setBody(e.target.value)} required value={body}
            />
          </label>

          <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-[#e1e2e6] p-4 text-sm font-medium text-[#4b4b47]">
            This is an update
            <input checked={isUpdate} className="h-5 w-5 accent-[#787775]" onChange={(e) => setIsUpdate(e.target.checked)} type="checkbox" />
          </label>

          {isUpdate ? (
            <div className="mt-4 grid gap-3">
              <label className="block text-sm font-medium text-[#4b4b47]">
                Which story are you updating?
                <select
                  className="mt-2 min-h-12 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-base font-medium outline-none ring-[#f8c0c8] focus:ring-4"
                  onChange={(e) => setPreviousStoryId(e.target.value)} value={previousStoryId}
                  disabled={storiesLoading || Boolean(storiesError) || previousStories.length === 0}
                  required
                >
                  <option value="">{storiesLoading ? "Loading your stories…" : "Choose a previous story"}</option>
                  {previousStories.map(story => (
                    <option key={story.id} value={story.id}>
                      {story.title} — Part {story.part_number ?? 1} — {new Date(story.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>
              {storiesError ? (
                <div role="alert" className="text-sm text-red-400">
                  {storiesError}
                  <button type="button" className="ml-2 underline" onClick={() => {
                    setStoriesLoading(true); setStoriesError(""); setStoriesRetry(value => value + 1);
                  }}>Try again</button>
                </div>
              ) : !storiesLoading && previousStories.length === 0 ? (
                <p className="text-sm text-[#787775]">You have no previous public stories yet. Uncheck “This is an update” to start a new story.</p>
              ) : null}
              {selectedStory && (
                <div className="rounded-2xl bg-[#e1e2e6] px-4 py-3 text-sm font-medium text-[#4b4b47]">
                  Your update will join <span className="font-semibold">{selectedStory.arc_title || selectedStory.title}</span> and receive the next part number automatically.
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-5 rounded-3xl bg-[#e1e2e6] p-4 text-[#4b4b47]">
            <div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={18} />Want to add a cliffhanger ending?</div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {cliffhangerIdeas.map((idea) => (
                <button className="shrink-0 rounded-full bg-[#f8f8f6] px-3 py-2 text-xs font-medium text-[#4b4b47]" key={idea} onClick={() => setCliffhanger(idea)} type="button">{idea}</button>
              ))}
            </div>
            <input
              className="mt-3 min-h-12 w-full rounded-2xl border border-[#e1e2e6] bg-[#f8f8f6] px-4 text-base font-medium text-[#4b4b47] outline-none"
              onChange={(e) => setCliffhanger(e.target.value)} placeholder="Optional" value={cliffhanger}
            />
          </div>

          <div className="mt-5 rounded-3xl bg-[#e1e2e6] p-4 text-[#4b4b47]">
            <p className="text-sm font-medium">Ask readers what you should do</p>
            <p className="mt-1 text-xs font-medium leading-5 text-[#787775]">Optional. Add a quick vote if you want readers to help choose the next move.</p>
            <input
              className="mt-3 min-h-12 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-base font-medium outline-none ring-[#f8c0c8] focus:ring-4"
              maxLength={110} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Should I text him back?" value={pollQuestion}
            />
            <div className="mt-3 grid gap-2">
              {pollOptions.map((option, index) => (
                <input
                  className="min-h-11 w-full rounded-2xl border border-[#d8d3ce] bg-[#f8f8f6] px-4 text-sm font-medium outline-none ring-[#f8c0c8] focus:ring-4"
                  key={index} maxLength={60}
                  onChange={(e) => { const next = [...pollOptions]; next[index] = e.target.value; setPollOptions(next); }}
                  placeholder={`Option ${index + 1}`} value={option}
                />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {pollOptions.length < 4 ? <button className="rounded-full bg-[#f8f8f6] px-3 py-2 text-xs font-medium text-[#4b4b47]" onClick={() => setPollOptions((c) => [...c, ""])} type="button">Add option</button> : null}
              {pollOptions.length > 2 ? <button className="rounded-full bg-[#f8f8f6] px-3 py-2 text-xs font-medium text-[#4b4b47]" onClick={() => setPollOptions((c) => c.slice(0, -1))} type="button">Remove option</button> : null}
            </div>
          </div>

          {safetyIssues.length > 0 ? (
            <p className="mt-4 rounded-2xl bg-[#e1e2e6] p-3 text-sm font-medium text-[#4b4b47]">Please remove possible identifying or unsafe terms: {safetyIssues.join(", ")}</p>
          ) : null}

          <button
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#f8c0c8] px-4 py-4 text-sm font-medium text-[#4b4b47] disabled:opacity-60"
            disabled={status === "saving" || safetyIssues.length > 0 || (isUpdate && (storiesLoading || Boolean(storiesError) || !selectedStory))} type="submit"
          >
            <Send size={18} />
            {status === "saving" ? "Posting..." : "Submit story"}
          </button>

          {status === "saved" ? <p className="mt-3 text-center text-sm font-medium text-[#4b4b47]">Story posted! Taking you there…</p> : null}
          {status === "error" ? <p className="mt-3 text-center text-sm font-medium text-red-400">{errorMsg}</p> : null}
        </form>

        <Link className="mt-5 block text-center text-sm font-medium text-[#4b4b47]" href="/">Back to feed</Link>
      </section>
      <AppNav />
    </main>
  );
}
