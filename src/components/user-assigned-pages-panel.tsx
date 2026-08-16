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
  slugAliases?: Array<{
    id: string;
    slug: string;
    expiresAt: string;
  }>;
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

type DiscordWebhookSettings = {
  enabled: boolean;
  maskedUrl: string | null;
};

type RotationPolicy = {
  autoRotationEnabled: boolean;
  autoRotationMode: "SHORT" | "LONG";
  autoRotationIntervalHours?: number | null;
  nextAutoRotationAt?: string | null;
  lastAutoRotationAt?: string | null;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const noStoreFetch: RequestInit = { cache: "no-store" };

export function UserAssignedPagesPanel() {
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [presets, setPresets] = useState<PagePreset[]>([]);
  const [metrics, setMetrics] = useState<LinkMetric[]>([]);
  const [message, setMessage] = useState("");
  const [savingPresetId, setSavingPresetId] = useState("");
  const [webhookSettings, setWebhookSettings] = useState<DiscordWebhookSettings>({ enabled: false, maskedUrl: null });
  const [rotationPolicy, setRotationPolicy] = useState<RotationPolicy>({
    autoRotationEnabled: false,
    autoRotationMode: "SHORT",
    autoRotationIntervalHours: null,
    nextAutoRotationAt: null,
    lastAutoRotationAt: null,
  });
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [rotatingId, setRotatingId] = useState("");
  const [customPrefixes, setCustomPrefixes] = useState<Record<string, string>>({});

  const assignedDomain = domains[0] ?? null;
  const presetNames = useMemo(() => new Map(presets.map((preset) => [preset.key, preset.name])), [presets]);
  const metricByLinkId = useMemo(() => new Map(metrics.map((metric) => [metric.linkId, metric])), [metrics]);

  async function refreshPanelData() {
    const [linksResponse, domainsResponse, presetsResponse, metricsResponse, webhookResponse, rotationResponse] = await Promise.all([
      fetch("/api/user/links", noStoreFetch),
      fetch("/api/user/domains", noStoreFetch),
      fetch("/api/user/page-presets", noStoreFetch),
      fetch("/api/user/analytics/by-link", noStoreFetch),
      fetch("/api/user/settings/discord-webhook", noStoreFetch),
      fetch("/api/user/rotation-policy", noStoreFetch),
    ]);

    if (linksResponse.ok) {
      setLinks(asArray<LinkRecord>(await linksResponse.json()));
    }

    if (domainsResponse.ok) {
      setDomains(asArray<Domain>(await domainsResponse.json()));
    }

    if (presetsResponse.ok) {
      setPresets(asArray<PagePreset>(await presetsResponse.json()));
    }

    if (metricsResponse.ok) {
      setMetrics(asArray<LinkMetric>(await metricsResponse.json()));
    }

    if (webhookResponse.ok) {
      setWebhookSettings((await webhookResponse.json()) as DiscordWebhookSettings);
    }

    if (rotationResponse.ok) {
      setRotationPolicy((await rotationResponse.json()) as RotationPolicy);
    }
  }

  async function refreshLinks() {
    const [linksResponse, metricsResponse] = await Promise.all([
      fetch("/api/user/links", noStoreFetch),
      fetch("/api/user/analytics/by-link", noStoreFetch),
    ]);

    if (linksResponse.ok) {
      setLinks(asArray<LinkRecord>(await linksResponse.json()));
    }

    if (metricsResponse.ok) {
      setMetrics(asArray<LinkMetric>(await metricsResponse.json()));
    }
  }

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshPanelData();
      }
    }

    void refreshPanelData();
    const intervalId = window.setInterval(refreshWhenVisible, 10_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
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

  async function saveWebhook() {
    setSavingWebhook(true);
    setMessage("");

    const response = await fetch("/api/user/settings/discord-webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl }),
    });

    if (response.ok) {
      setWebhookSettings((await response.json()) as DiscordWebhookSettings);
      setWebhookUrl("");
      setMessage(webhookUrl.trim() ? "Discord webhook saved." : "Discord webhook removed.");
    } else {
      const payload = await response.json().catch(() => ({ error: "Unable to save Discord webhook." }));
      setMessage(payload.error ?? "Unable to save Discord webhook.");
    }

    setSavingWebhook(false);
  }

  async function testWebhook() {
    setSavingWebhook(true);
    setMessage("");

    const response = await fetch("/api/user/settings/discord-webhook", { method: "POST" });

    if (response.ok) {
      setMessage("Discord test message sent.");
    } else {
      const payload = await response.json().catch(() => ({ error: "Unable to send Discord test." }));
      setMessage(payload.error ?? "Unable to send Discord test.");
    }

    setSavingWebhook(false);
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

        <Card className="border-violet-400/20 bg-violet-500/10">
          <CardHeader>
            <CardTitle>Automatic Prefix Rotation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-md bg-white/10 px-2 py-1 text-slate-200">
                {rotationPolicy.autoRotationEnabled ? "Enabled by admin" : "Disabled by admin"}
              </span>
              <span className="rounded-md bg-violet-500/15 px-2 py-1 text-violet-200">
                {rotationPolicy.autoRotationMode === "LONG" ? "Long prefixes" : "Short prefixes"}
              </span>
              <span className="rounded-md bg-cyan-500/15 px-2 py-1 text-cyan-200">
                Every {rotationPolicy.autoRotationIntervalHours ?? "-"} hours
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
              <p>Next rotation: {rotationPolicy.nextAutoRotationAt ? new Date(rotationPolicy.nextAutoRotationAt).toLocaleString() : "Not scheduled"}</p>
              <p>Last rotation: {rotationPolicy.lastAutoRotationAt ? new Date(rotationPolicy.lastAutoRotationAt).toLocaleString() : "Never"}</p>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Old prefixes remain available during the grace window shown on each managed URL.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
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

      <Card className="border-indigo-400/20 bg-indigo-500/10">
        <CardHeader>
          <CardTitle>Discord Form Webhook</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
            <label className="text-sm font-medium text-slate-300">
              Tenant-wide webhook URL
              <input
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder={webhookSettings.maskedUrl ?? "https://discord.com/api/webhooks/..."}
                className="mt-1 h-10 w-full rounded-md border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-indigo-300"
              />
            </label>
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-500" disabled={savingWebhook} onClick={() => void saveWebhook()}>
              {webhookUrl.trim() ? "Save Webhook" : "Remove Webhook"}
            </Button>
            <Button type="button" className="bg-cyan-600 hover:bg-cyan-500" disabled={savingWebhook || !webhookSettings.enabled} onClick={() => void testWebhook()}>
              Test
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Status: {webhookSettings.enabled ? `Enabled (${webhookSettings.maskedUrl})` : "Disabled"}. Form submissions are stored first, then sent to Discord from the server.
          </p>
        </CardContent>
      </Card>

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
              <article key={link.id} className="rounded-md border border-white/10 bg-white/5 p-3 shadow-md shadow-black/10">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-bold uppercase text-violet-200">Public URL</p>
                  <p className="truncate font-mono text-sm font-black text-cyan-200">
                    {host}/{link.slug}
                  </p>
                  <div className="mt-2 grid gap-1 font-mono text-xs text-slate-400">
                    <span className="truncate">index.html: {host}/{link.slug}/index.html</span>
                    <span className="truncate">dashboard.html: {host}/{link.slug}/dashboard.html</span>
                    <span className="truncate">destination: {link.destinationUrl}</span>
                  </div>
                  {(link.slugAliases ?? []).length > 0 ? (
                    <div className="mt-3 rounded-md border border-amber-400/20 bg-amber-500/10 p-2 text-xs text-amber-200">
                      <p className="font-bold uppercase">Previous prefixes still active</p>
                      {(link.slugAliases ?? []).map((alias) => (
                        <p key={alias.id} className="mt-1 truncate font-mono">
                          {host}/{alias.slug} until {new Date(alias.expiresAt).toLocaleString()}
                        </p>
                      ))}
                    </div>
                  ) : null}
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

                <div className="mt-3 grid gap-3 lg:grid-cols-[0.8fr_1.3fr]">
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
                        className="h-8 bg-cyan-600 px-3 text-xs hover:bg-cyan-500"
                        disabled={rotatingId === link.id}
                        onClick={() => void rotatePrefix(link, { mode: "short" })}
                      >
                        Short
                      </Button>
                      <Button
                        type="button"
                        className="h-8 bg-violet-600 px-3 text-xs hover:bg-violet-500"
                        disabled={rotatingId === link.id}
                        onClick={() => void rotatePrefix(link, { mode: "long" })}
                      >
                        Long
                      </Button>
                      <input
                        value={customPrefixes[link.id] ?? ""}
                        onChange={(event) => setCustomPrefixes((current) => ({ ...current, [link.id]: event.target.value }))}
                        placeholder="custom-prefix"
                        className="h-8 rounded-md border px-2 text-sm"
                        maxLength={80}
                      />
                      <Button
                        type="button"
                        className="h-8 bg-fuchsia-500 px-3 text-xs hover:bg-fuchsia-400"
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
