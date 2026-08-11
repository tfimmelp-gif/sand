"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type LoginPanelProps = {
  expectedRole: "SUPER_ADMIN" | "WORKSPACE_USER";
  eyebrow: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  successPath: string;
};

export function LoginPanel({ expectedRole, eyebrow, title, subtitle, buttonLabel, successPath }: LoginPanelProps) {
  const router = useRouter();
  const isAdmin = expectedRole === "SUPER_ADMIN";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      expectedRole,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setError(expectedRole === "SUPER_ADMIN" ? "Invalid admin credentials." : "Invalid tenant credentials.");
      return;
    }

    router.push(successPath);
  }

  return (
    <main
      className={
        isAdmin
          ? "flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#fff7ed_0%,#eef2ff_52%,#f0fdfa_100%)] px-4"
          : "flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#ecfeff_0%,#f5f3ff_48%,#fff7ed_100%)] px-4"
      }
    >
      <section className="w-full max-w-md overflow-hidden rounded-lg border border-white/80 bg-white/90 shadow-xl shadow-slate-300/40 backdrop-blur">
        <div className={isAdmin ? "border-b border-orange-100 bg-orange-50/80 p-5" : "border-b border-cyan-100 bg-cyan-50/80 p-5"}>
          <p className={isAdmin ? "text-xs font-bold uppercase text-orange-600" : "text-xs font-bold uppercase text-cyan-700"}>
            {eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="p-5">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Email
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                type="text"
                inputMode="email"
                autoComplete="username"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Password
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                type="password"
                autoComplete="current-password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={isLoading}
              className={isAdmin ? "flex h-10 w-full items-center justify-center rounded-md bg-orange-600 font-bold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-65" : "flex h-10 w-full items-center justify-center rounded-md bg-cyan-700 font-bold text-white shadow-sm shadow-cyan-200 transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-65"}
            >
              {isLoading ? "Signing in" : buttonLabel}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
