"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

type Domain = {
  id: string;
  hostString: string;
  status: string;
  isGlobal: boolean;
};

type LinkRecord = {
  id: string;
  slug: string;
  destinationUrl: string;
  indexPagePreset: string;
  status: string;
  domain?: {
    hostString: string;
    status: string;
  };
  _count?: {
    clicks: number;
  };
};

type TimeseriesPoint = {
  hour: string;
  clicks: number;
};

type PagePreset = {
  key: string;
  name: string;
  description: string;
};

type AnalyticsSummary = {
  totalClicks: number;
  uniqueVisitors: number;
  activeLinks: number;
  domainHealth: number;
  topCountries: Array<{ label: string; count: number }>;
  topReferrers: Array<{ label: string; count: number }>;
  topDevices: Array<{ label: string; count: number }>;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function UserWorkspaceLinksPage() {
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [slug, setSlug] = useState("");
  const [destination, setDestination] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("minimal");
  const [presets, setPresets] = useState<PagePreset[]>([]);
  const [historicalData, setHistoricalData] = useState<TimeseriesPoint[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [message, setMessage] = useState("");
  const [regeneratingId, setRegeneratingId] = useState("");
  const [savingPresetId, setSavingPresetId] = useState("");
  const [customPrefixes, setCustomPrefixes] = useState<Record<string, string>>({});

  async function refreshLinks() {
    const response = await fetch("/api/user/links");
    if (response.ok) {
      setLinks(asArray<LinkRecord>(await response.json()));
    }
  }

  useEffect(() => {
    async function load() {
      const [linksResponse, domainsResponse, analyticsResponse, summaryResponse, presetsResponse] = await Promise.all([
        fetch("/api/user/links"),
        fetch("/api/user/domains"),
        fetch("/api/user/analytics/timeseries"),
        fetch("/api/user/analytics/summary"),
        fetch("/api/user/page-presets"),
      ]);

      if (linksResponse.ok) {
        setLinks(asArray<LinkRecord>(await linksResponse.json()));
      }

      if (domainsResponse.ok) {
        const domainData = asArray<Domain>(await domainsResponse.json());
        setDomains(domainData);
        if (domainData.length > 0) {
          setSelectedDomain(domainData[0].id);
        }
      }

      if (analyticsResponse.ok) {
        setHistoricalData(asArray<TimeseriesPoint>(await analyticsResponse.json()));
      }

      if (summaryResponse.ok) {
        setSummary(await summaryResponse.json());
      }

      if (presetsResponse.ok) {
        const presetData = asArray<PagePreset>(await presetsResponse.json());
        setPresets(presetData);
        if (presetData.length > 0) {
          setSelectedPreset(presetData[0].key);
        }
      }
    }

    void load();
  }, []);

  async function handleCreateLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/user/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        destinationUrl: destination,
        domainId: selectedDomain,
        indexPagePreset: selectedPreset,
      }),
    });

    if (response.ok) {
      setSlug("");
      setDestination("");
      setMessage("Link deployed. The index.html page is ready.");
      await refreshLinks();
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to create link." }));
    setMessage(payload.error ?? "Unable to create link.");
  }

  async function handlePresetChange(link: LinkRecord, nextPreset: string) {
    setSavingPresetId(link.id);
    setMessage("");

    const response = await fetch(`/api/user/links/${link.id}/page-preset`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indexPagePreset: nextPreset }),
    });

    if (response.ok) {
      setMessage("Index page preset updated.");
      await refreshLinks();
      setSavingPresetId("");
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to update index page preset." }));
    setMessage(payload.error ?? "Unable to update index page preset.");
    setSavingPresetId("");
  }

  async function handleRegenerateLink(link: LinkRecord, payload: { mode?: "short" | "long"; slug?: string }) {
    setRegeneratingId(link.id);
    setMessage("");

    const response = await fetch(`/api/user/links/${link.id}/regenerate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      setCustomPrefixes((current) => ({ ...current, [link.id]: "" }));
      setMessage("Link prefix regenerated.");
      await refreshLinks();
      setRegeneratingId("");
      return;
    }

    const errorPayload = await response.json().catch(() => ({ error: "Unable to regenerate link." }));
    setMessage(errorPayload.error ?? "Unable to regenerate link.");
    setRegeneratingId("");
  }

  function handleCustomRegenerate(link: LinkRecord) {
    const customPrefix = (customPrefixes[link.id] ?? "").trim();

    if (!customPrefix) {
      setMessage("Enter a custom prefix first.");
      return;
    }

    void handleRegenerateLink(link, { slug: customPrefix });
  }

  return (
    <main className="dark-dashboard space-y-6 bg-[radial-gradient(circle_at_top_left,#7c3aed_0%,transparent_30%),linear-gradient(135deg,#020617_0%,#111827_48%,#0f172a_100%)] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-violet-300">Routing</p>
          <h1 className="mt-1 text-4xl font-black text-white">Link Builder</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Create routed links, assign page presets, and watch campaign traffic move through the workspace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>

      <Card className="border-violet-400/20 bg-violet-500/10">
        <CardHeader>
          <CardTitle>Aggregate Routing Throughput</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" fontSize={12} stroke="#667085" />
              <YAxis fontSize={12} stroke="#667085" />
              <Tooltip />
              <Line type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="border-cyan-400/20 bg-cyan-500/10">
          <CardHeader>
            <CardTitle>Total Clicks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary?.totalClicks ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-fuchsia-400/20 bg-fuchsia-500/10">
          <CardHeader>
            <CardTitle>Unique Visitors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary?.uniqueVisitors ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-400/20 bg-emerald-500/10">
          <CardHeader>
            <CardTitle>Active Links</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary?.activeLinks ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-400/20 bg-amber-500/10">
          <CardHeader>
            <CardTitle>Domain Health</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary?.domainHealth ?? 100}%</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Generate Live Link</CardTitle>
          </CardHeader>
          <CardContent>
            {domains.length === 0 ? (
              <div className="mb-4 rounded-md border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                No domain has been assigned to this workspace yet. Ask the admin to assign a domain before creating links.
              </div>
            ) : null}
            <form onSubmit={handleCreateLink} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Domain Base
                <select
                  value={selectedDomain}
                  onChange={(event) => setSelectedDomain(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
                  required
                >
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.hostString}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Routing Key / Slug
                <input
                  type="text"
                  placeholder="promo2026"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Target Destination
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                index.html Page Preset
                <select
                  value={selectedPreset}
                  onChange={(event) => setSelectedPreset(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
                  required
                >
                  {presets.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" className="w-full" disabled={!selectedDomain}>
                Deploy Router Node
              </Button>
              {message ? <p className="text-sm font-medium text-slate-600">{message}</p> : null}
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Traffic Shunts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {links.map((link) => (
                <div key={link.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <a className="block truncate font-semibold text-blue-700" href={`/dashboard/links/${link.id}`}>
                      {link.domain?.hostString}/{link.slug}
                    </a>
                    <p className="max-w-xl truncate font-mono text-xs text-slate-500">
                      Index page: {link.domain?.hostString}/{link.slug}/index.html
                    </p>
                    <p className="max-w-xl truncate font-mono text-xs text-slate-500">
                      Dashboard page: {link.domain?.hostString}/{link.slug}/dashboard.html
                    </p>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Preset: {presets.find((preset) => preset.key === link.indexPagePreset)?.name ?? link.indexPagePreset}
                    </p>
                    <p className="max-w-xl truncate font-mono text-xs text-slate-500">{link.destinationUrl}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={link.indexPagePreset}
                      onChange={(event) => void handlePresetChange(link, event.target.value)}
                      className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                      disabled={savingPresetId === link.id}
                    >
                      {presets.map((preset) => (
                        <option key={preset.key} value={preset.key}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm font-semibold text-slate-600">{link._count?.clicks ?? 0} clicks</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {link.status}
                    </span>
                    <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[auto_auto_11rem_auto]">
                      <Button
                        type="button"
                        className="h-8 bg-cyan-600 px-3 hover:bg-cyan-500"
                        onClick={() => void handleRegenerateLink(link, { mode: "short" })}
                        disabled={regeneratingId === link.id}
                      >
                        Short
                      </Button>
                      <Button
                        type="button"
                        className="h-8 bg-violet-600 px-3 hover:bg-violet-500"
                        onClick={() => void handleRegenerateLink(link, { mode: "long" })}
                        disabled={regeneratingId === link.id}
                      >
                        Long
                      </Button>
                      <input
                        value={customPrefixes[link.id] ?? ""}
                        onChange={(event) => setCustomPrefixes((current) => ({ ...current, [link.id]: event.target.value }))}
                        placeholder="custom-prefix"
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                        maxLength={80}
                      />
                      <Button
                        type="button"
                        className="h-8 bg-fuchsia-500 px-3 hover:bg-fuchsia-400"
                        onClick={() => handleCustomRegenerate(link)}
                        disabled={regeneratingId === link.id}
                      >
                        {regeneratingId === link.id ? "Saving" : "Custom"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          ["Top Countries", summary?.topCountries ?? []],
          ["Top Referrers", summary?.topReferrers ?? []],
          ["Device Types", summary?.topDevices ?? []],
        ].map(([title, rows]) => (
          <Card key={title as string}>
            <CardHeader>
              <CardTitle>{title as string}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(rows as Array<{ label: string; count: number }>).map((row) => {
                const max = Math.max(...(rows as Array<{ count: number }>).map((item) => item.count), 1);
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{row.label}</span>
                      <span className="text-slate-500">{row.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-blue-600"
                        style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </section>
      </div>
    </main>
  );
}
