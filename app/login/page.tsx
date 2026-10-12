"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f1e9e1] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-medium text-[#4f3325]">locket</h1>
          <p className="mt-1 text-sm font-medium text-[#6b4a3a] uppercase tracking-widest">anonymous stories</p>
        </div>
        <div className="rounded-[2rem] border border-[#c8b7a7] bg-[#f1e9e1] p-6 shadow-sm">
          <h2 className="text-xl font-medium text-[#4f3325] mb-5">welcome back</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-widest text-[#6b4a3a] block mb-1">email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-[#c8b7a7] bg-white px-4 py-3 text-sm font-medium text-[#4f3325] outline-none focus:border-[#c88d7d]"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-widest text-[#6b4a3a] block mb-1">password</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-[#c8b7a7] bg-white px-4 py-3 text-sm font-medium text-[#4f3325] outline-none focus:border-[#c88d7d]"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-xs font-medium text-red-500 text-center">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full rounded-2xl bg-[#c88d7d] py-3 text-sm font-medium text-[#4f3325] disabled:opacity-60"
            >
              {loading ? "logging in..." : "log in"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs font-medium text-[#6b4a3a]">
            no account?{" "}
            <Link href="/signup" className="text-[#4f3325] underline">sign up</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
