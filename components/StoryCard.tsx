"use client";

import { ArrowLeft, EyeOff, GitBranch, Instagram, Trash2 } from "lucide-react";
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
  const [saving, setSaving] = useState(false);

  const isOwn = currentUsername === name;

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    client.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setCurrentUserId(data.user.id);
      client.from("users").select("username, bio").eq("id", data.user.id).single()
        .then(({ data: profile }) => {
          if (profile) { setCurrentUsername(profile.username); if (profile.username === name) setBio(profile.bio ?? ""); }
        });
    });

    // Load stories
    client.from("stories").select("*").eq("anonymous_name", name).eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setStories(data ?? []);
        setLoading(false);
      });
  }, [name]);

  async function handleSaveUsername() {
    const client = supabase;
    if (!client) return;
    if (!client || !currentUserId) return;
    if (!/^[a-zA-Z0-9._-]{2,30}$/.test(newUsername)) { setSaveMsg("letters, numbers, . _ - only (2-30 chars)"); return; }
    setSaving(true);
    const { data: taken } = await client.from("users").select("id").eq("username", newUsername).neq("id", currentUserId).single();
    if (taken) { setSaveMsg("username already taken"); setSaving(false); return; }
    const { error } = await client.from("users").update({ username: newUsername }).eq("id", currentUserId);
    if (error) {
      setSaveMsg("could not update username");
    } else {
      // Also update anonymous_name on all their stories so they stay in sync
      await client.from("stories").update({ anonymous_name: newUsername }).eq("anonymous_name", name);
      setSaveMsg("username updated!");
      setEditingUsername(false);
      router.push(`/profile/${encodeURIComponent(newUsername)}`);
    }
    setSaving(false);
  }

  async function handleSaveBio() {
    const client = supabase;
    if (!client) return;
    if (!client || !currentUserId) return;
    setSaving(true);
    const { error } = await client.from("users").update({ bio }).eq("id", currentUserId);
    setSaveMsg(error ? "could not update bio" : "bio saved!");
    setEditingBio(false); setSaving(false);
  }

  async function handleHide(storyId: string) {
    const client = supabase;
    if (!client) return;
    if (!client || !confirm("Hide this story from your profile?")) return;
    await client.from("stories").update({ is_hidden: true }).eq("id", storyId);
    setStories(prev => prev.filter(s => s.id !== storyId));
  }

  async function handleDelete(storyId: string) {
    const client = supabase;
    if (!client) return;
    if (!client || !confirm("Delete this story permanently? This cannot be undone.")) return;
    await client.from("stories").delete().eq("id", storyId);
    setStories(prev => prev.filter(s => s.id !== storyId));
  }

  async function handleDeleteAccount() {
    const client = supabase;
    if (!client) return;
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
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {isOwn && editingUsername ? (
                <div className="flex gap-2 items-center">
                  <input value={newUsername} onChange={e => setNewUsername(e.target.value)} maxLength={30}
                    className="flex-1 rounded-xl border border-[#d8d3ce] px-3 py-1 text-sm font-medium text-[#4b4b47] outline-none focus:border-[#f8c0c8]" />
                  <button onClick={handleSaveUsername} disabled={saving} className="shrink-0 rounded-xl bg-[#f8c0c8] px-3 py-1 text-xs font-medium text-[#4b4b47]">{saving ? "..." : "save"}</button>
                  <button onClick={() => setEditingUsername(false)} className="text-xs text-[#787775]">cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-medium text-[#4b4b47] truncate">@{name}</h1>
                  {isOwn && <button onClick={() => setEditingUsername(true)} className="shrink-0 text-xs text-[#787775] underline">edit</button>}
                </div>
              )}
              {saveMsg && <p className="text-xs text-green-600 mt-1">{saveMsg}</p>}
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

        {/* Own profile actions */}
        {isOwn && (
          <section className="mt-8 grid gap-3">
            <a href="https://instagram.com/lefeiii" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-3xl border border-[#d8d3ce] bg-[#f8f8f6] p-4 text-sm font-medium text-[#4b4b47]">
              <Instagram size={18} /> connect with the founder @lefeiii
            </a>
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
