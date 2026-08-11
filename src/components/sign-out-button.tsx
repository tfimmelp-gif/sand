"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignOutButton({ callbackUrl = "/login" }: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      onClick={() => void signOut({ callbackUrl })}
    >
      Logout
    </Button>
  );
}
