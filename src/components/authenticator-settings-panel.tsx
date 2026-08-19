"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type AuthenticatorState = {
  enabled: boolean;
  secret: string | null;
  otpauthUrl: string | null;
};

const emptyState: AuthenticatorState = {
  enabled: false,
  secret: null,
  otpauthUrl: null,
};

export function AuthenticatorSettingsPanel() {
  const [state, setState] = useState<AuthenticatorState>(emptyState);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadSettings() {
    const response = await fetch("/api/user/settings/authenticator", { cache: "no-store" });
    if (response.ok) {
      setState((await response.json()) as AuthenticatorState);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function startSetup() {
    setIsSaving(true);
    setMessage("");
    const response = await fetch("/api/user/settings/authenticator", { method: "POST" });
    if (response.ok) {
      setState((await response.json()) as AuthenticatorState);
      setMessage("Add this secret to Google Authenticator, Microsoft Authenticator, Authy, or 1Password, then enter the 6-digit code.");
    } else {
      setMessage("Unable to start authenticator setup.");
    }
    setIsSaving(false);
  }

  async function enable() {
    setIsSaving(true);
    setMessage("");
    const response = await fetch("/api/user/settings/authenticator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (response.ok) {
      setCode("");
      setState((await response.json()) as AuthenticatorState);
      setMessage("Authenticator login code enabled.");
    } else {
      const payload = await response.json().catch(() => ({ error: "Unable to enable authenticator." }));
      setMessage(payload.error ?? "Unable to enable authenticator.");
    }
    setIsSaving(false);
  }

  async function disable() {
    setIsSaving(true);
    setMessage("");
    const response = await fetch("/api/user/settings/authenticator", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (response.ok) {
      setCode("");
      setState((await response.json()) as AuthenticatorState);
      setMessage("Authenticator login code disabled.");
    } else {
      const payload = await response.json().catch(() => ({ error: "Unable to disable authenticator." }));
      setMessage(payload.error ?? "Unable to disable authenticator.");
    }
    setIsSaving(false);
  }

  return (
    <div className="dashboard-subpanel p-4 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase text-indigo-300">Authenticator Login Code</p>
          <p className="mt-1 text-sm text-slate-500">Optional 6-digit TOTP verification for this account.</p>
        </div>
        <span
          className={
            state.enabled
              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
              : "rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700"
          }
        >
          {state.enabled ? "Enabled" : "Optional"}
        </span>
      </div>

      {state.secret && !state.enabled ? (
        <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
          <p className="font-bold">Manual secret</p>
          <p className="mt-1 break-all font-mono text-xs">{state.secret}</p>
          {state.otpauthUrl ? <p className="mt-2 break-all text-xs">{state.otpauthUrl}</p> : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-400"
          placeholder="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
        />
        {state.secret || state.enabled ? (
          <Button type="button" className="h-9 bg-indigo-600 px-3 hover:bg-indigo-500" disabled={isSaving} onClick={() => void enable()}>
            Verify
          </Button>
        ) : (
          <Button type="button" className="h-9 bg-indigo-600 px-3 hover:bg-indigo-500" disabled={isSaving} onClick={() => void startSetup()}>
            Set Up
          </Button>
        )}
        {state.enabled ? (
          <Button type="button" className="h-9 bg-slate-700 px-3 hover:bg-slate-600" disabled={isSaving} onClick={() => void disable()}>
            Disable
          </Button>
        ) : null}
      </div>
      {message ? <p className="mt-2 text-xs font-semibold text-slate-500">{message}</p> : null}
    </div>
  );
}
