"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

type PagePreset = {
  key: string;
  name: string;
  description: string;
};

type LinkMetric = {
  linkId: string;
  clicks: number;
  uniqueVisitors: number;
  pageViews: number;
  formSubmissions: number;
  botVisits: number;
  highRiskEvents: number;
  lastVisitAt: string | null;
};

export function UserAssignedPagesPanel() {
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [presets, setPresets] = useState<PagePreset[]>([]);
  const [metrics, setMetrics] = useState<LinkMetric[]>([]);
  const [message, setMessage] = useState("");
  const [savingPresetId, setSavingPresetId] = useState("");
  const [rotatingId, setRotatingId] = useState("");
  const [customPrefixes, setCustomPrefixes] = useState<Record<string, string>>({});

  const assignedDomain = domains[0] ?? null;
  const presetNames = useMemo(() => new Map(presets.map((preset) => [preset.key, preset.name])), [presets]);
  const metricByLinkId = useMemo(() => new Map(metrics.map((metric) => [metric.linkId, metric])), [metrics]);

  async function refreshLinks() {
    const [linksResponse, metricsResponse] = await Promise.all([
      fetch("/api/user/links"),
      fetch("/api/user/analytics/by-link"),
    ]);

    if (linksResponse.ok) {
      setLinks(await linksResponse.json());
    }

    if (metricsResponse.ok) {
      setMetrics(await metricsResponse.json());
    }
  }

  useEffect(() => {
    async function load() {
      const [linksResponse, domainsResponse, presetsResponse, metricsResponse] = await Promise.all([
        fetch("/api/user/links"),
        fetch("/api/user/domains"),
        fetch("/api/user/page-presets"),
        fetch("/api/user/analytics/by-link"),
      ]);

      if (linksResponse.ok) {
        setLinks(await linksResponse.json());
      }

      if (domainsResponse.ok) {
        setDomains(await domainsResponse.json());
      }

      if (presetsResponse.ok) {
        setPresets(await presetsResponse.json());
      }

      if (metricsResponse.ok) {
        setMetrics(await metricsResponse.json());
      }
    }

    void load();
  }, []);

  async function assignPreset(linkId: string, indexPagePreset: string) {
    setSavingPresetId(linkId);
    setMessage("");

    const response = await fetch(`/api/user/links/${linkId}/page-preset`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indexPagePreset }),
    });

    if (response.ok) {
      setLinks((currentLinks) =>
        currentLinks.map((link) => (link.id === linkId ? { ...link, indexPagePreset } : link)),
      );
      setMessage("Preset assigned to this URL.");
    } else {
      const payload = await response.json().catch(() => ({ error: "Unable to assign preset." }));
      setMessage(payload.error ?? "Unable to assign preset.");
    }

    setSavingPresetId("");
  }

  async function rotatePrefix(link: LinkRecord, payload: { mode?: "short" | "long"; slug?: string }) {
    setRotatingId(link.id);
    setMessage("");

    const response = await fetch(`/api/user/links/${link.id}/regenerate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const updatedLink = (await response.json()) as LinkRecord;
      setLinks((currentLinks) =>
        currentLinks.map((currentLink) =>
          currentLink.id === link.id
            ? {
                ...currentLink,
                ...updatedLink,
                indexPagePreset: updatedLink.indexPagePreset ?? currentLink.indexPagePreset,
              }
            : currentLink,
        ),
      );
      setCustomPrefixes((current) => ({ ...current, [link.id]: "" }));
      setMessage("URL prefix updated. The assigned domain stayed locked.");
    } else {
      const payload = await response.json().catch(() => ({ error: "Unable to rotate prefix." }));
      setMessage(payload.error ?? "Unable to rotate prefix.");
    }

    setRotatingId("");
    await refreshLinks();
  }

  function rotateCustomPrefix(link: LinkRecord) {
    const customPrefix = (customPrefixes[link.id] ?? "").trim();

    if (!customPrefix) {
      setMessage("Enter a custom prefix first.");
      return;
    }

    void rotatePrefix(link, { slug: customPrefix });
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
        <Card className="border-fuchsia-400/20 bg-fuchsia-500/10">
          <CardHeader>
            <CardTitle>Assigned Domain</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-lg font-black text-white">
              {assignedDomain ? assignedDomain.hostString : "No domain assigned yet"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-md bg-white/10 px-2 py-1 text-slate-200">
                Status: {assignedDomain?.status ?? "Waiting"}
              </span>
              <span className="rounded-md bg-fuchsia-500/15 px-2 py-1 text-fuchsia-200">
                Domain locked by admin
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-300">
              Your dashboard stays here. Public traffic uses this assigned domain plus the URL prefix you manage below.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-400/20 bg-cyan-500/10">
          <CardHeader>
            <CardTitle>Admin Page Presets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {presets.map((preset) => (
                <div key={preset.key} className="rounded-md border border-white/10 bg-slate-950/30 p-3">
                  <p className="font-semibold text-white">{preset.name}</p>
                  <p className="mt-1 text-xs text-slate-300">{preset.description}</p>
                </div>
              ))}
              {presets.length === 0 ? <p className="text-sm text-slate-300">No page presets are available yet.</p> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-violet-400/20 bg-violet-500/10">
        <CardHeader>
          <CardTitle>Managed URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        {message ? <p className="rounded-md bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200">{message}</p> : null}

        <div className="space-y-4">
          {links.map((link) => {
            const host = link.domain?.hostString ?? assignedDomain?.hostString ?? "unassigned-domain";

            const metric = metricByLinkId.get(link.id);

            return (
              <article key={link.id} className="rounded-lg border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/10">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-bold uppercase text-violet-200">Public URL</p>
                  <p className="truncate font-mono text-base font-black text-cyan-200">
                    {host}/{link.slug}
                  </p>
                  <div className="mt-2 grid gap-1 font-mono text-xs text-slate-400">
                    <span className="truncate">index.html: {host}/{link.slug}/index.html</span>
                    <span className="truncate">dashboard.html: {host}/{link.slug}/dashboard.html</span>
                    <span className="truncate">destination: {link.destinationUrl}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4 xl:grid-cols-7">
                    <span className="rounded-md bg-cyan-500/10 px-2 py-1 text-cyan-200">
                      {metric?.clicks ?? 0} clicks
                    </span>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-200">
                      {metric?.pageViews ?? 0} page visits
                    </span>
                    <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-200">
                      {metric?.formSubmissions ?? 0} forms
                    </span>
                    <span className="rounded-md bg-red-500/10 px-2 py-1 text-red-200">
                      {metric?.botVisits ?? 0} bots
                    </span>
                    <span className="rounded-md bg-violet-500/10 px-2 py-1 text-violet-200">
                      {metric?.uniqueVisitors ?? 0} unique IPs
                    </span>
                    <span className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-200">
                      {metric?.highRiskEvents ?? 0} high risk
                    </span>
                    <span className="col-span-2 rounded-md bg-white/5 px-2 py-1 text-slate-300 xl:col-span-1">
                      Last visit: {metric?.lastVisitAt ? new Date(metric.lastVisitAt).toLocaleString() : "No visits yet"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.3fr]">
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-400">Displayed page preset</label>
                    <select
                      value={link.indexPagePreset}
                      onChange={(event) => void assignPreset(link.id, event.target.value)}
                      className="mt-1 w-full rounded-md border p-2"
                      disabled={savingPresetId === link.id}
                    >
                      {presets.map((preset) => (
                        <option key={preset.key} value={preset.key}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-400">
                      Active: {presetNames.get(link.indexPagePreset) ?? link.indexPagePreset}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Regenerate prefix</p>
                    <div className="mt-1 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]">
                      <Button
                        type="button"
                        className="bg-cyan-600 hover:bg-cyan-500"
                        disabled={rotatingId === link.id}
                        onClick={() => void rotatePrefix(link, { mode: "short" })}
                      >
                        Short
                      </Button>
                      <Button
                        type="button"
                        className="bg-violet-600 hover:bg-violet-500"
                        disabled={rotatingId === link.id}
                        onClick={() => void rotatePrefix(link, { mode: "long" })}
                      >
                        Long
                      </Button>
                      <input
                        value={customPrefixes[link.id] ?? ""}
                        onChange={(event) => setCustomPrefixes((current) => ({ ...current, [link.id]: event.target.value }))}
                        placeholder="custom-prefix"
                        className="h-10 rounded-md border px-3 text-sm"
                        maxLength={80}
                      />
                      <Button
                        type="button"
                        className="bg-fuchsia-500 hover:bg-fuchsia-400"
                        disabled={rotatingId === link.id}
                        onClick={() => rotateCustomPrefix(link)}
                      >
                        {rotatingId === link.id ? "Saving..." : "Custom"}
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Short is 8 characters. Long is 32. Custom allows letters, numbers, dashes, and underscores.</p>
                  </div>
                </div>
              </article>
            );
          })}
          {links.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              {assignedDomain
                ? "No managed URLs are available yet. Create one in Link Builder or ask the admin to assign one."
                : "No assigned domain yet. Ask the admin to assign an active domain before creating URLs."}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
