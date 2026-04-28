"use client";

import { useState } from "react";

type LoginScreenProps = {
  notice?: string;
  onLogin: (password: string) => Promise<string | null>;
};

export function LoginScreen({ notice, onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const loginError = await onLogin(password);

      if (loginError) {
        setError(loginError);
        return;
      }

      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(128,191,255,0.22),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_25%),linear-gradient(180deg,#050816_0%,#080b12_45%,#030406_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.15),transparent)] blur-3xl" />

      <section className="relative w-full max-w-md rounded-4xl border border-white/12 bg-white/8 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-3xl">
        <div className="mb-4 space-y-4">
          <span className="inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs tracking-[0.24em] text-white/60 uppercase">
            Native Transfer
          </span>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Transfer
          </h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40 focus:bg-black/40"
              placeholder="password"
              autoComplete="current-password"
            />
          </label>

          {error || notice ? (
            <p className="text-sm text-rose-300">{error || notice}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(154,220,255,0.82))] px-4 py-3 text-sm font-medium text-slate-900 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "loading..." : "enter"}
          </button>
        </form>
      </section>
    </main>
  );
}
