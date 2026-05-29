import { supabase } from "./supabase";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  bio?: string;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (!data) return null;
  return { id: user.id, email: user.email!, username: data.username, bio: data.bio };
}

export async function signUp(email: string, password: string, username: string) {
  if (!supabase) throw new Error("No Supabase connection");
  // Check username taken
  const { data: existing } = await supabase
    .from("users").select("id").eq("username", username).single();
  if (existing) throw new Error("Username already taken");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("Signup failed");

  const { error: profileError } = await supabase
    .from("users").insert({ id: data.user.id, username });
  if (profileError) throw profileError;
  return data.user;
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("No Supabase connection");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function updateUsername(newUsername: string) {
  if (!supabase) throw new Error("No Supabase connection");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  const { data: existing } = await supabase
    .from("users").select("id").eq("username", newUsername).neq("id", user.id).single();
  if (existing) throw new Error("Username already taken");
  const { error } = await supabase.from("users").update({ username: newUsername }).eq("id", user.id);
  if (error) throw error;
}

export async function updateBio(bio: string) {
  if (!supabase) throw new Error("No Supabase connection");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  const { error } = await supabase.from("users").update({ bio }).eq("id", user.id);
  if (error) throw error;
}

export async function deleteAccount() {
  if (!supabase) throw new Error("No Supabase connection");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  // Delete user profile (stories set null via cascade)
  await supabase.from("users").delete().eq("id", user.id);
  // Sign out
  await supabase.auth.signOut();
}
