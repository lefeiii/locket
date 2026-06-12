"use client";

import { ArrowLeft, EyeOff, GitBranch, Instagram, LogOut, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppNav, BrandBar } from "@/components/AppNav";
import { supabase } from "@/lib/supabase";
import type { Story } from "@/lib/types";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const name = decodeURIComponent(params?.name as string ?? "");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(name);
  const [editingBio, setEditingBio] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveMsgIsError, setSaveMsgIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  function setError(msg: string) { setSaveMsg(msg); setSaveMsgIsError(true); }
  function setSuccess(msg: string) { setSaveMsg(msg); setSaveMsgIsError(false); }
  const [recentComments, setRecentComments] = useState<{id: string; story_id: string; story_title: string; anonymous_name: string; body: string; created_at: string}[]>([]);

  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const isOwn = isOwnProfile;

  // Sync newUsername input when currentUsername loads from DB
  useEffect(() => { if (currentUsername) setNewUsername(currentUsername); }, [currentUsername]);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    client.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setCurrentUserId(data.user.id);
      client.from("users").select("username, bio").eq("id", data.user.id).single()
        .then(({ data: profile }) => {
          if (profile) { setCurrentUsername(profile.username); if (profile.username === name) { setBio(profile.bio ?? ""); setIsOwnProfile(true); } }
        });
    });

    // Load stories
    client.from("stories").select("*").eq("anonymous_name", name).eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setStories(data ?? []);
        setLoading(false);

        // Fetch recent comments on own stories (only for profile owner)
        const storyIds = (data ?? []).map((s: {id: string}) => s.id);
        if (storyIds.length > 0) {
          client
            .from("comments")
            .select("id, story_id, anonymous_name, body, created_at")
            .in("story_id", storyIds)
            .order("created_at", { ascending: false })
            .limit(10)
            .then(({ data: commentData }) => {
              const storyMap: Record<string, string> = {};
              (data ?? []).forEach((s: {id: string; title: string}) => { storyMap[s.id] = s.title; });
              setRecentComments(
                (commentData ?? [])
                  .filter((c: {anonymous_name: string}) => c.anonymous_name !== (currentUsername ?? name))
                  .map((c: {id: string; story_id: string; anonymous_name: string; body: string; created_at: string}) => ({
                    ...c,
                    story_title: storyMap[c.story_id] ?? "Unknown story",
                  }))
              );
            });
        }
      });
  }, [name]);

  async function handleSaveUsername() {
    const client = supabase;
    if (!client || !currentUserId) return;
    if (!/^[a-zA-Z0-9._-]{2,30}$/.test(newUsername)) { setError("letters, numbers, . _ - only (2-30 chars)"); return; }
    if (newUsername === (currentUsername ?? name)) { setEditingUsername(false); return; }
    setSaving(true);

    // Check availability first
    const { data: taken } = await client.from("users").select("id").eq("username", newUsername).neq("id", currentUserId).maybeSingle();
    if (taken) { setError("username already taken"); setSaving(false); return; }

    // Get session token for service role API call
    const { data: { session } } = await client.auth.getSession();
    if (!session) { setError("not logged in"); setSaving(false); return; }

    // Use server-side API route so RLS can't block the stories/comments update
    let res: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      res = await fetch("/api/rename-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ oldUsername: currentUsername ?? name, newUsername }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch {
      setError("request timed out — please try again");
      setSaving(false);
      return;
    }

    let json: { error?: string; success?: boolean };
    try {
      json = await res.json();
    } catch {
      setError("unexpected server response — please try again");
      setSaving(false);
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "could not update username");
      setSaving(false);
      return;
    }

    // Update local state immediately — NO redirect, stay on page
    setCurrentUsername(newUsername);
    setIsOwnProfile(true);
    setStories(prev => prev.map(s => ({ ...s, anonymous_name: newUsername })));
    setSuccess("username updated! ✓");
    setEditingUsername(false);
    setSaving(false);

    // Silently update the URL without triggering a full navigation/re-fetch
    window.history.replaceState(null, "", `/profile/${encodeURIComponent(newUsername)}`);
    setTimeout(() => setSaveMsg(""), 3000);
  }

  async function handleSaveBio() {
    const client = supabase;
    if (!client || !currentUserId) return;
    setSaving(true);
    const { error } = await client.from("users").update({ bio }).eq("id", currentUserId);
    if (error) { setError("could not update bio"); } else { setSuccess("bio saved!"); }
    setEditingBio(false); setSaving(false);
  }

  async function handleHide(storyId: string) {
    const client = supabase;
    if (!client || !confirm("Hide this story from your profile?")) return;
    const { error } = await client.from("stories").update({ is_hidden: true }).eq("id", storyId);
    if (error) {
      setError("could not hide story — try again");
      return;
    }
    setStories(prev => prev.filter(s => s.id !== storyId));
    setRecentComments(prev => prev.filter(c => c.story_id !== storyId));
  }

  async function handleDelete(storyId: string) {
    const client = supabase;
    if (!client || !confirm("Delete this story permanently? This cannot be undone.")) return;
    const { error } = await client.from("stories").delete().eq("id", storyId);
    if (error) {
      setError("could not delete story — try again");
      return;
    }
    setStories(prev => prev.filter(s => s.id !== storyId));
    setRecentComments(prev => prev.filter(c => c.story_id !== storyId));
  }

  async function handleLogout() {
    const client = supabase;
    if (!client) return;
    await client.auth.signOut();
    router.push("/");
  }

  async function handleDeleteAccount() {
    const client = supabase;
    if (!client || !currentUserId) return;
    if (!confirm("Delete your account permanently? This cannot be undone.")) return;
    await client.from("users").delete().eq("id", currentUserId);
    await client.auth.signOut();
    router.push("/signup");
  }

  return (
    <main className="pb-24">
      <BrandBar />
      <section className="mx-auto max-w-md px-4 py-5">
        <Link className="mb-4 flex items-center gap-2 text-sm font-medium text-[#4b4b47]" href="/">
          <ArrowLeft size={18} /> Back to feed
        </Link>

        <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-5 shadow-sm">
          {/* Avatar + username */}
          <div className="flex items-center gap-4 mb-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-[#f8c0c8] text-2xl font-medium text-[#4b4b47] select-none">
              {(currentUsername ?? name).slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {isOwn && editingUsername ? (
                <div className="flex gap-2 items-center">
                  <input value={newUsername} onChange={e => setNewUsername(e.target.value)} maxLength={30}
                    className="flex-1 rounded-xl border border-[#d8d3ce] px-3 py-1 text-sm font-medium text-[#4b4b47] outline-none focus:border-[#f8c0c8]" />
                  <button onClick={handleSaveUsername} disabled={saving} className="shrink-0 rounded-xl bg-[#f8c0c8] px-3 py-1 text-xs font-medium text-[#4b4b47]">{saving ? "..." : "save"}</button>
                  <button onClick={() => { setEditingUsername(false); setNewUsername(currentUsername ?? name); }} className="text-xs text-[#787775]">cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-medium text-[#4b4b47] truncate">@{currentUsername ?? name}</h1>
                  {isOwn && <button onClick={() => setEditingUsername(true)} className="shrink-0 text-xs text-[#787775] underline">edit</button>}
                </div>
              )}
              {saveMsg && <p className={`text-xs mt-1 ${saveMsgIsError ? "text-red-400" : "text-green-600"}`}>{saveMsg}</p>}
            </div>
          </div>

          {/* Bio */}
          {isOwn ? (
            editingBio ? (
              <div className="mb-4">
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} maxLength={160}
                  className="w-full rounded-xl border border-[#d8d3ce] px-3 py-2 text-sm font-medium text-[#4b4b47] outline-none focus:border-[#f8c0c8] resize-none"
                  placeholder="say something..." />
                <div className="flex gap-2 mt-1">
                  <button onClick={handleSaveBio} disabled={saving} className="rounded-xl bg-[#f8c0c8] px-3 py-1 text-xs font-medium text-[#4b4b47]">{saving ? "..." : "save bio"}</button>
                  <button onClick={() => setEditingBio(false)} className="text-xs text-[#787775]">cancel</button>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-sm font-medium text-[#787775]">{bio || <span className="italic opacity-50">no bio yet</span>}</p>
                <button onClick={() => setEditingBio(true)} className="mt-1 text-xs text-[#787775] underline">{bio ? "edit bio" : "add bio"}</button>
              </div>
            )
          ) : null}

          {/* Stats — stories only */}
          <div className="rounded-2xl bg-[#e1e2e6] p-4">
            <p className="text-3xl font-medium text-[#4b4b47]">{loading ? "—" : stories.length}</p>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">Stories</p>
          </div>
        </div>

        {/* Stories */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch size={19} />
            <h2 className="text-xl font-medium text-[#4b4b47]">{isOwn ? "your stories" : "drama history"}</h2>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-[#787775]">loading...</p>
          ) : stories.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#787775]">no stories yet</p>
          ) : (
            <div className="grid gap-3">
              {stories.map(story => (
                <div key={story.id} className="rounded-3xl bg-[#f8f8f6] p-4 shadow-lg">
                  <Link href={`/story/${story.id}`} className="block">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#787775]">{story.category}</p>
                    <h3 className="mt-1 text-xl font-medium leading-tight text-[#4b4b47]">{story.title}</h3>
                    {story.cliffhanger && <p className="mt-2 rounded-2xl bg-[#f8c0c8] p-3 text-sm font-medium text-[#4b4b47]">{story.cliffhanger}</p>}
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[#4b4b47]">{story.body}</p>
                    <p className="mt-2 text-xs font-medium text-[#787775]">
                      {story.follower_count ?? 0} {(story.follower_count ?? 0) === 1 ? "follower" : "followers"}
                    </p>
                  </Link>
                  {isOwn && (
                    <div className="mt-3 flex gap-3 border-t border-[#e1e2e6] pt-3">
                      <button onClick={() => handleHide(story.id)} className="flex items-center gap-1 text-xs font-medium text-[#787775] hover:text-[#4b4b47]">
                        <EyeOff size={13} /> hide
                      </button>
                      <button onClick={() => handleDelete(story.id)} className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600">
                        <Trash2 size={13} /> delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent comments on your stories — only visible to owner */}
        {isOwn && recentComments.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-xl font-medium text-[#4b4b47]">💬 recent comments</h2>
            </div>
            <div className="grid gap-3">
              {recentComments.map(comment => (
                <Link key={comment.id} href={`/story/${comment.story_id}`} className="block rounded-3xl bg-[#f8f8f6] p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#787775]">@{comment.anonymous_name} on</p>
                  <p className="mt-0.5 text-sm font-medium text-[#4b4b47] truncate">{comment.story_title}</p>
                  <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[#787775]">{comment.body}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Own profile actions */}
        {isOwn && (
          <section className="mt-8 grid gap-3">
            <a href="https://instagram.com/lefeiii" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-3xl border border-[#d8d3ce] bg-[#f8f8f6] p-4 text-sm font-medium text-[#4b4b47]">
              <Instagram size={18} /> connect with the founder @lefeiii
            </a>
            <button onClick={handleLogout}
              className="flex items-center gap-3 w-full rounded-3xl border border-[#d8d3ce] bg-[#f8f8f6] p-4 text-left text-sm font-medium text-[#4b4b47]">
              <LogOut size={18} /> log out
            </button>
            <button onClick={handleDeleteAccount}
              className="w-full rounded-3xl border border-red-200 bg-red-50 p-4 text-left text-sm font-medium text-red-500">
              delete my account
            </button>
          </section>
        )}
      </section>
      <AppNav />
    </main>
  );
}
