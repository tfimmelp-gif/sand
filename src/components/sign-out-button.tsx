"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignOutButton({ callbackUrl = "/login", preserveSession = false }: { callbackUrl?: string; preserveSession?: boolean }) {
  function handleLogout() {
    if (preserveSession) {
      window.location.assign(callbackUrl);
      return;
    }

    void signOut({ callbackUrl });
  }

  return (
    <Button
      type="button"
      className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      onClick={handleLogout}
    >
      Logout
    </Button>
  );
}
