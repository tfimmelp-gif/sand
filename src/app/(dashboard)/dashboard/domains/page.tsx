"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";

type Domain = {
  id: string;
  hostString: string;
  status: string;
  isGlobal: boolean;
  createdAt: string;
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hostString, setHostString] = useState("");
  const [message, setMessage] = useState("");
  const [verifyingId, setVerifyingId] = useState("");
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "yourplatform.com";

  async function loadDomains() {
    const response = await fetch("/api/user/domains");
    if (response.ok) {
      setDomains(await response.json());
    }
  }

  async function handleVerifyDomain(id: string) {
    setVerifyingId(id);
    setMessage("");

    const response = await fetch(`/api/domains/verify/${id}`);
    const payload = await response.json().catch(() => ({ error: "Verification failed." }));

    if (response.ok) {
      setMessage("Domain verified and activated.");
      await loadDomains();
    } else {
      setMessage(payload.error ?? `DNS does not point to ${payload.expected ?? appDomain} yet.`);
    }

    setVerifyingId("");
  }

  useEffect(() => {
    void loadDomains();
  }, []);

  async function handleCreateDomain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/user/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostString }),
    });

    if (response.ok) {
      setHostString("");
      setMessage("Domain added. Caddy can issue TLS after DNS points to the platform.");
      await loadDomains();
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to add domain." }));
    setMessage(payload.error ?? "Unable to add domain.");
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Domains</p>
          <h1 className="text-3xl font-bold text-slate-950">Custom Domain Setup</h1>
        </div>
        <SignOutButton />
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Domain</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateDomain} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Hostname
                <input
                  value={hostString}
                  onChange={(event) => setHostString(event.target.value)}
                  placeholder="links.customer.com"
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                  required
                />
              </label>
              <Button type="submit">Add Domain</Button>
              {message ? <p className="text-sm font-medium text-slate-600">{message}</p> : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DNS Record</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-[100px_1fr] gap-3 rounded-md border border-slate-200 p-3">
                <span className="font-semibold text-slate-500">Type</span>
                <span>CNAME</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-3 rounded-md border border-slate-200 p-3">
                <span className="font-semibold text-slate-500">Name</span>
                <span>@ or your subdomain label</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-3 rounded-md border border-slate-200 p-3">
                <span className="font-semibold text-slate-500">Value</span>
                <span className="font-mono">{appDomain}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Registered Domains</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {domains.map((domain) => (
              <div key={domain.id} className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{domain.hostString}</p>
                  <p className="text-sm text-slate-500">{domain.isGlobal ? "Global domain" : "Workspace domain"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {domain.status}
                  </span>
                  {!domain.isGlobal ? (
                    <Button
                      type="button"
                      className="h-8 px-3"
                      onClick={() => void handleVerifyDomain(domain.id)}
                      disabled={verifyingId === domain.id}
                    >
                      {verifyingId === domain.id ? "Checking" : "Verify"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
