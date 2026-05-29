"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signUp } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const usernameValid = /^[a-zA-Z0-9._-]{2,30}$/.test(username);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!usernameValid) {
      setError("Username can only contain letters, numbers, . _ - (2-30 chars)");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, username);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f3f0] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-medium text-[#4b4b47]">locket</h1>
          <p className="mt-1 text-sm font-medium text-[#787775] uppercase tracking-widest">anonymous stories</p>
        </div>
        <div className="rounded-[2rem] border border-[#d8d3ce] bg-[#f8f8f6] p-6 shadow-sm">
          <h2 className="text-xl font-medium text-[#4b4b47] mb-1">create your account</h2>
          <p className="text-xs font-medium text-[#787775] mb-5">your username shows on stories. your email stays private.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-widest text-[#787775] block mb-1">username</label>
              <input
                type="text" required value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full rounded-2xl border border-[#d8d3ce] bg-white px-4 py-3 text-sm font-medium text-[#4b4b47] outline-none focus:border-[#f8c0c8]"
                placeholder="DramaBunny"
                maxLength={30}
              />
              <p className="mt-1 text-xs text-[#787775]">letters, numbers, . _ - only · 2–30 chars</p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-widest text-[#787775] block mb-1">email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-[#d8d3ce] bg-white px-4 py-3 text-sm font-medium text-[#4b4b47] outline-none focus:border-[#f8c0c8]"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-widest text-[#787775] block mb-1">password</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                className="w-full rounded-2xl border border-[#d8d3ce] bg-white px-4 py-3 text-sm font-medium text-[#4b4b47] outline-none focus:border-[#f8c0c8]"
                placeholder="at least 6 characters"
              />
            </div>
            {error && <p className="text-xs font-medium text-red-500 text-center">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full rounded-2xl bg-[#f8c0c8] py-3 text-sm font-medium text-[#4b4b47] disabled:opacity-60"
            >
              {loading ? "creating account..." : "create account"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs font-medium text-[#787775]">
            already have one?{" "}
            <Link href="/login" className="text-[#4b4b47] underline">log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
