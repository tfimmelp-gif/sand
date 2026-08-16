"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatExpiry } from "@/lib/expiration";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  assignedDomainId?: string | null;
  assignedDomainExpiresAt?: string | null;
  tenantAccessActive: boolean;
  tenantAccessExpiresAt?: string | null;
  autoRotationEnabled: boolean;
  autoRotationMode: "SHORT" | "LONG";
  autoRotationIntervalHours?: number | null;
  nextAutoRotationAt?: string | null;
  lastAutoRotationAt?: string | null;
  assignedDomain?: {
    id: string;
    hostString: string;
    status: string;
  } | null;
  createdAt: string;
  _count?: {
    links: number;
    domains: number;
  };
};

type GlobalDomain = {
  id: string;
  hostString: string;
  status: string;
  isGlobal: boolean;
  createdAt: string;
  _count?: {
    links: number;
  };
  assignedUsers?: Array<{
    id: string;
    email: string;
  }>;
};

type ManagedLink = {
  id: string;
  slug: string;
  destinationUrl: string;
  indexPagePreset: string;
  redirectSource: "ADMIN_DESTINATION" | "PRESET_CONTROLLED";
  expiresAt?: string | null;
  status: string;
  user?: {
    id: string;
    email: string;
  };
  domain?: {
    id: string;
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
  folderPath: string;
  htmlContent: string;
  files: Array<{
    id?: string;
    filePath: string;
    contentType: string;
    content: string;
    contentEncoding?: string;
  }>;
};

type DomainDnsStatus = {
  domain: string;
  expectedA: string | null;
  expectedCname: string | null;
  aRecords: string[];
  aaaaRecords: string[];
  cnameRecords: string[];
  resolves: boolean;
  pointsToServer: boolean;
  recommendedRecord: string;
  error?: string;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizePagePreset(preset: PagePreset): PagePreset {
  return {
    ...preset,
    files: asArray(preset.files),
  };
}

const noStoreFetch: RequestInit = { cache: "no-store" };

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [globalDomains, setGlobalDomains] = useState<GlobalDomain[]>([]);
  const [managedLinks, setManagedLinks] = useState<ManagedLink[]>([]);
  const [pagePresets, setPagePresets] = useState<PagePreset[]>([]);
  const [editingPresetKey, setEditingPresetKey] = useState("minimal");
  const [editingPreset, setEditingPreset] = useState<PagePreset | null>(null);
  const [editingFilePath, setEditingFilePath] = useState("index.html");
  const [presetZipFile, setPresetZipFile] = useState<File | null>(null);
  const [isUploadingPresetZip, setIsUploadingPresetZip] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [globalDomainHost, setGlobalDomainHost] = useState("");
  const [linkTenantId, setLinkTenantId] = useState("");
  const [linkDomainId, setLinkDomainId] = useState("");
  const [linkPagePreset, setLinkPagePreset] = useState("minimal");
  const [linkRedirectSource, setLinkRedirectSource] = useState<"ADMIN_DESTINATION" | "PRESET_CONTROLLED">("ADMIN_DESTINATION");
  const [linkExpiryBundle, setLinkExpiryBundle] = useState("none");
  const [linkSlug, setLinkSlug] = useState("");
  const [linkDestination, setLinkDestination] = useState("");
  const [message, setMessage] = useState("");
  const [domainMessage, setDomainMessage] = useState("");
  const [linkMessage, setLinkMessage] = useState("");
  const [presetMessage, setPresetMessage] = useState("");
  const [assigningDomainUserId, setAssigningDomainUserId] = useState("");
  const [savingLinkPresetId, setSavingLinkPresetId] = useState("");
  const [savingLinkRedirectId, setSavingLinkRedirectId] = useState("");
  const [savingTenantAccessUserId, setSavingTenantAccessUserId] = useState("");
  const [tenantAccessBundles, setTenantAccessBundles] = useState<Record<string, string>>({});
  const [rotationPolicies, setRotationPolicies] = useState<
    Record<string, { enabled: boolean; mode: "SHORT" | "LONG"; intervalHours: string }>
  >({});
  const [domainExpiryBundles, setDomainExpiryBundles] = useState<Record<string, string>>({});
  const [linkExpiryBundles, setLinkExpiryBundles] = useState<Record<string, string>>({});
  const [linkEdits, setLinkEdits] = useState<Record<string, { destinationUrl: string; slug: string }>>({});
  const [savingLinkExpiryId, setSavingLinkExpiryId] = useState("");
  const [savingManagedLinkId, setSavingManagedLinkId] = useState("");
  const [deletingManagedLinkId, setDeletingManagedLinkId] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [dnsStatuses, setDnsStatuses] = useState<Record<string, DomainDnsStatus>>({});
  const [checkingDnsDomainId, setCheckingDnsDomainId] = useState("");
  const activeGlobalDomains = useMemo(() => globalDomains.filter((domain) => domain.status === "ACTIVE"), [globalDomains]);
  const selectedTenant = useMemo(() => users.find((user) => user.id === linkTenantId), [linkTenantId, users]);
  const selectedTenantAssignedDomain = useMemo(
    () =>
      selectedTenant?.assignedDomainId
        ? activeGlobalDomains.find((domain) => domain.id === selectedTenant.assignedDomainId)
        : null,
    [activeGlobalDomains, selectedTenant],
  );

  function domainAssignmentLabel(domain: GlobalDomain) {
    const assignedUsers = domain.assignedUsers ?? [];

    if (assignedUsers.length === 0) {
      return "Unassigned";
    }

    if (assignedUsers.length === 1) {
      return `Assigned to ${assignedUsers[0].email}`;
    }

    return `Reused by ${assignedUsers.length} tenants`;
  }

  async function fetchUsers() {
    const response = await fetch("/api/admin/users", noStoreFetch);
    if (response.ok) {
      setUsers(asArray<AdminUser>(await response.json()));
    }
  }

  async function fetchGlobalDomains() {
    const response = await fetch("/api/admin/domains", noStoreFetch);
    if (response.ok) {
      setGlobalDomains(asArray<GlobalDomain>(await response.json()));
    }
  }

  async function fetchManagedLinks() {
    const response = await fetch("/api/admin/links", noStoreFetch);
    if (response.ok) {
      setManagedLinks(asArray<ManagedLink>(await response.json()));
    }
  }

  async function fetchPagePresets() {
    const response = await fetch("/api/admin/page-presets", noStoreFetch);
    if (response.ok) {
      const presets = asArray<PagePreset>(await response.json()).map(normalizePagePreset);
      setPagePresets(presets);
      const activePreset = presets.find((preset) => preset.key === editingPresetKey) ?? presets[0] ?? null;
      setEditingPreset(activePreset ? { ...activePreset } : null);
      if (activePreset) {
        setEditingPresetKey(activePreset.key);
      }
    }
  }

  async function refreshAdminData() {
    await Promise.all([fetchUsers(), fetchGlobalDomains(), fetchManagedLinks(), fetchPagePresets()]);
  }

  async function refreshAdminLiveData() {
    await Promise.all([fetchUsers(), fetchGlobalDomains(), fetchManagedLinks()]);
  }

  async function handleProvisionUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      setEmail("");
      setPassword("");
      setMessage("Tenant workspace provisioned.");
      await fetchUsers();
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Provisioning failed." }));
    setMessage(payload.error ?? "Provisioning failed.");
  }

  async function handleCreateGlobalDomain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDomainMessage("");
    const normalizedDomain = globalDomainHost.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");

    if (globalDomains.some((domain) => domain.hostString === normalizedDomain)) {
      setDomainMessage("That global domain is already registered.");
      return;
    }

    const response = await fetch("/api/admin/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostString: normalizedDomain, status: "ACTIVE" }),
    });

    if (response.ok) {
      setGlobalDomainHost("");
      setDomainMessage("Global domain added.");
      await fetchGlobalDomains();
      return;
    }

    const responseText = await response.text();
    try {
      const payload = JSON.parse(responseText) as { error?: string };
      setDomainMessage(payload.error ?? `Unable to add global domain. (${response.status})`);
    } catch {
      setDomainMessage(responseText || `Unable to add global domain. (${response.status})`);
    }
  }

  async function handleCreateManagedLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLinkMessage("");

    const response = await fetch("/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: linkTenantId,
        domainId: linkDomainId,
        slug: linkSlug,
        destinationUrl: linkDestination,
        indexPagePreset: linkPagePreset,
        redirectSource: linkRedirectSource,
        expiryBundle: linkExpiryBundle,
      }),
    });

    if (response.ok) {
      setLinkSlug("");
      setLinkDestination("");
      setLinkRedirectSource("ADMIN_DESTINATION");
      setLinkExpiryBundle("none");
      setLinkMessage("Tenant link created and assigned.");
      await Promise.all([fetchManagedLinks(), fetchUsers()]);
      return;
    }

    const responseText = await response.text();
    try {
      const payload = JSON.parse(responseText) as { error?: string };
      setLinkMessage(payload.error ?? `Unable to create tenant link. (${response.status})`);
    } catch {
      setLinkMessage(responseText ? `Unable to create tenant link. (${response.status}) ${responseText.slice(0, 180)}` : `Unable to create tenant link. (${response.status})`);
    }
  }

  async function handleLinkExpiryChange(linkId: string) {
    setSavingLinkExpiryId(linkId);
    setLinkMessage("");

    const response = await fetch(`/api/admin/links/${linkId}/expiry`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiryBundle: linkExpiryBundles[linkId] ?? "none" }),
    });

    if (response.ok) {
      const updatedLink = (await response.json()) as ManagedLink;
      setManagedLinks((currentLinks) => currentLinks.map((link) => (link.id === updatedLink.id ? updatedLink : link)));
      setLinkMessage("URL expiry updated.");
      setSavingLinkExpiryId("");
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to update URL expiry." }));
    setLinkMessage(payload.error ?? "Unable to update URL expiry.");
    setSavingLinkExpiryId("");
  }

  async function handleManagedLinkPresetChange(linkId: string, indexPagePreset: string) {
    setSavingLinkPresetId(linkId);
    setLinkMessage("");

    const response = await fetch(`/api/admin/links/${linkId}/page-preset`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indexPagePreset }),
    });

    if (response.ok) {
      const updatedLink = (await response.json()) as ManagedLink;
      setManagedLinks((currentLinks) =>
        currentLinks.map((link) => (link.id === updatedLink.id ? updatedLink : link)),
      );
      setLinkMessage("Link page preset updated. Refresh the public link to see the selected index.html.");
      setSavingLinkPresetId("");
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to update link preset." }));
    setLinkMessage(payload.error ?? "Unable to update link preset.");
    setSavingLinkPresetId("");
  }

  async function handleManagedLinkRedirectSourceChange(
    linkId: string,
    redirectSource: "ADMIN_DESTINATION" | "PRESET_CONTROLLED",
  ) {
    setSavingLinkRedirectId(linkId);
    setLinkMessage("");

    const response = await fetch(`/api/admin/links/${linkId}/redirect-source`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirectSource }),
    });

    if (response.ok) {
      const updatedLink = (await response.json()) as ManagedLink;
      setManagedLinks((currentLinks) => currentLinks.map((link) => (link.id === updatedLink.id ? updatedLink : link)));
      setLinkMessage("Redirect source updated.");
      setSavingLinkRedirectId("");
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to update redirect source." }));
    setLinkMessage(payload.error ?? "Unable to update redirect source.");
    setSavingLinkRedirectId("");
  }

  async function handleManagedLinkSave(link: ManagedLink) {
    const edit = linkEdits[link.id] ?? { slug: link.slug, destinationUrl: link.destinationUrl };
    setSavingManagedLinkId(link.id);
    setLinkMessage("");

    const response = await fetch(`/api/admin/links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: edit.slug,
        destinationUrl: edit.destinationUrl,
      }),
    });

    if (response.ok) {
      const updatedLink = (await response.json()) as ManagedLink;
      setManagedLinks((currentLinks) => currentLinks.map((currentLink) => (currentLink.id === updatedLink.id ? updatedLink : currentLink)));
      setLinkEdits((current) => {
        const next = { ...current };
        delete next[link.id];
        return next;
      });
      setLinkMessage("Tenant link updated.");
      setSavingManagedLinkId("");
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to update tenant link." }));
    setLinkMessage(payload.error ?? "Unable to update tenant link.");
    setSavingManagedLinkId("");
  }

  async function handleManagedLinkDelete(link: ManagedLink) {
    const confirmed = window.confirm(`Delete ${link.domain?.hostString ?? "domain"}/${link.slug}? This removes the tenant link and its old prefixes.`);

    if (!confirmed) {
      return;
    }

    setDeletingManagedLinkId(link.id);
    setLinkMessage("");

    const response = await fetch(`/api/admin/links/${link.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setManagedLinks((currentLinks) => currentLinks.filter((currentLink) => currentLink.id !== link.id));
      setLinkMessage("Tenant link deleted.");
      setDeletingManagedLinkId("");
      await Promise.all([fetchManagedLinks(), fetchUsers()]);
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to delete tenant link." }));
    setLinkMessage(payload.error ?? "Unable to delete tenant link.");
    setDeletingManagedLinkId("");
  }

  useEffect(() => {
    setIsAuthorized(true);
    setIsCheckingAuth(false);
  }, []);

  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshAdminLiveData();
      }
    }

    void refreshAdminData();
    const intervalId = window.setInterval(refreshWhenVisible, 10_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isAuthorized]);

  useEffect(() => {
    const activePreset = pagePresets.find((preset) => preset.key === editingPresetKey) ?? null;
    setEditingPreset(activePreset ? { ...activePreset } : null);
    setEditingFilePath("index.html");
  }, [editingPresetKey, pagePresets]);

  useEffect(() => {
    const tenantUsers = users.filter((user) => user.role === "WORKSPACE_USER");

    if (!linkTenantId && tenantUsers.length > 0) {
      setLinkTenantId(tenantUsers[0].id);
    }

    if (selectedTenantAssignedDomain && linkDomainId !== selectedTenantAssignedDomain.id) {
      setLinkDomainId(selectedTenantAssignedDomain.id);
      return;
    }

    if (!linkDomainId && activeGlobalDomains.length > 0) {
      setLinkDomainId(activeGlobalDomains[0].id);
    }

    if (!linkPagePreset && pagePresets.length > 0) {
      setLinkPagePreset(pagePresets[0].key);
    }
  }, [activeGlobalDomains, globalDomains, linkDomainId, linkPagePreset, linkTenantId, pagePresets, selectedTenantAssignedDomain, users]);

  async function handleSavePreset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPresetMessage("");

    if (!editingPreset) {
      setPresetMessage("Choose a preset first.");
      return;
    }

    const response = await fetch("/api/admin/page-presets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingPreset),
    });

    if (response.ok) {
      setPresetMessage("index.html preset saved.");
      await fetchPagePresets();
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to save preset." }));
    setPresetMessage(payload.error ?? "Unable to save preset.");
  }

  async function handleUploadPresetZip() {
    setPresetMessage("");

    if (!editingPreset || !presetZipFile) {
      setPresetMessage("Choose a preset and upload a .zip package.");
      return;
    }

    setIsUploadingPresetZip(true);
    const formData = new FormData();
    formData.set("key", editingPreset.key);
    formData.set("name", editingPreset.name);
    formData.set("description", editingPreset.description);
    formData.set("archive", presetZipFile);

    const response = await fetch("/api/admin/page-presets", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const preset = normalizePagePreset(await response.json());
      setEditingPreset(preset);
      setEditingFilePath("index.html");
      setPresetZipFile(null);
      setPresetMessage("Preset ZIP uploaded. index.html, dashboard.html, and assets are now served together.");
      await fetchPagePresets();
      setIsUploadingPresetZip(false);
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to upload preset ZIP." }));
    setPresetMessage(payload.error ?? "Unable to upload preset ZIP.");
    setIsUploadingPresetZip(false);
  }

  async function handleAssignTenantDomain(userId: string, assignedDomainId: string) {
    setAssigningDomainUserId(userId);
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        assignedDomainId: assignedDomainId || null,
        assignedDomainExpiryBundle: domainExpiryBundles[userId] ?? "none",
      }),
    });

    if (response.ok) {
      setMessage("Tenant domain assignment updated.");
      await fetchUsers();
      setAssigningDomainUserId("");
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to assign domain." }));
    setMessage(payload.error ?? "Unable to assign domain.");
    setAssigningDomainUserId("");
  }

  async function handleTenantAccessBundle(userId: string, tenantAccessActive = true) {
    setSavingTenantAccessUserId(userId);
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        tenantAccessActive,
        tenantAccessBundle: tenantAccessActive ? tenantAccessBundles[userId] ?? "1m" : "none",
      }),
    });

    if (response.ok) {
      setMessage(tenantAccessActive ? "Tenant access bundle approved." : "Tenant access deactivated.");
      await fetchUsers();
      setSavingTenantAccessUserId("");
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to update tenant access." }));
    setMessage(payload.error ?? "Unable to update tenant access.");
    setSavingTenantAccessUserId("");
  }

  async function handleRotationPolicy(user: AdminUser) {
    setSavingTenantAccessUserId(user.id);
    setMessage("");
    const policy = rotationPolicies[user.id] ?? {
      enabled: user.autoRotationEnabled,
      mode: user.autoRotationMode ?? "SHORT",
      intervalHours: String(user.autoRotationIntervalHours ?? 24),
    };

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        autoRotationEnabled: policy.enabled,
        autoRotationMode: policy.mode,
        autoRotationIntervalHours: Number(policy.intervalHours),
      }),
    });

    if (response.ok) {
      setMessage(policy.enabled ? "Auto-rotation policy saved." : "Auto-rotation disabled.");
      await fetchUsers();
      setSavingTenantAccessUserId("");
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Unable to save auto-rotation policy." }));
    setMessage(payload.error ?? "Unable to save auto-rotation policy.");
    setSavingTenantAccessUserId("");
  }

  async function handleCheckDomainDns(domain: GlobalDomain) {
    setCheckingDnsDomainId(domain.id);

    const response = await fetch(`/api/admin/domains/dns-status?domain=${encodeURIComponent(domain.hostString)}`);

    if (response.ok) {
      const status = (await response.json()) as DomainDnsStatus;
      setDnsStatuses((current) => ({ ...current, [domain.id]: status }));
      setCheckingDnsDomainId("");
      return;
    }

    const payload = (await response.json().catch(() => ({ error: "Unable to check DNS." }))) as { error?: string };
    setDnsStatuses((current) => ({
      ...current,
      [domain.id]: {
        domain: domain.hostString,
        expectedA: null,
        expectedCname: null,
        aRecords: [],
        aaaaRecords: [],
        cnameRecords: [],
        resolves: false,
        pointsToServer: false,
        recommendedRecord: "A",
        error: payload.error ?? "Unable to check DNS.",
      },
    }));
    setCheckingDnsDomainId("");
  }

  const selectedPresetFile =
    editingFilePath === "index.html"
      ? {
          filePath: "index.html",
          content: editingPreset?.htmlContent ?? "",
          contentEncoding: "utf8",
          contentType: "text/html; charset=utf-8",
        }
      : editingPreset?.files.find((file) => file.filePath === editingFilePath);
  const isSelectedPresetTextFile = !selectedPresetFile || (selectedPresetFile.contentEncoding ?? "utf8") === "utf8";

  if (isCheckingAuth) {
    return (
      <main className="dark-dashboard flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#020617_0%,#111827_48%,#0f172a_100%)] p-6">
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm font-semibold text-slate-200 shadow-xl shadow-black/20">
          Checking super admin access...
        </div>
      </main>
    );
  }

  return (
    <main className="dark-dashboard space-y-6 bg-[radial-gradient(circle_at_top_left,#1d4ed8_0%,transparent_32%),linear-gradient(135deg,#020617_0%,#111827_48%,#0f172a_100%)] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-sky-300">Super Admin</p>
          <h1 className="mt-1 text-4xl font-black text-white">System Infrastructure Manager</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Provision tenants, manage branded domains, assign links, and edit hosted preset folders from one control surface.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <SignOutButton callbackUrl="/admin/login" />
          <div className="dashboard-icon">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
              <path d="M9 12l2 2 4-5" />
            </svg>
          </div>
        </div>
      </div>

      <nav className="sticky top-0 z-10 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-slate-950/80 p-3 text-sm font-bold text-slate-200 shadow-xl shadow-black/20 backdrop-blur">
        <a className="rounded-md px-3 py-2 hover:bg-white/10" href="#tenant-access">
          Tenant Access
        </a>
        <a className="rounded-md px-3 py-2 hover:bg-white/10" href="#managed-links">
          Managed URLs
        </a>
        <a className="rounded-md px-3 py-2 hover:bg-white/10" href="#presets">
          Presets
        </a>
        <a className="rounded-md px-3 py-2 hover:bg-white/10" href="#domain-pool">
          Domains
        </a>
      </nav>

      <Card id="tenant-access">
        <CardHeader className="bg-sky-500/10">
          <CardTitle className="flex items-center gap-3">
            <span className="dashboard-icon h-8 w-8 text-sky-300">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8v6" />
                <path d="M22 11h-6" />
              </svg>
            </span>
            Provision New Tenant Workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProvisionUser} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="text-sm font-medium text-slate-700">
              Tenant Email Account
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Initial Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                minLength={8}
                required
              />
            </label>
            <Button type="submit">Issue Login Access</Button>
          </form>
          {message ? <p className="mt-4 text-sm font-medium text-slate-600">{message}</p> : null}
        </CardContent>
      </Card>

      <Card id="managed-links">
        <CardHeader className="bg-violet-500/10">
          <CardTitle className="flex items-center gap-3">
            <span className="dashboard-icon h-8 w-8 text-violet-300">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </span>
            Managed Tenant Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleCreateManagedLink} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Tenant
                <select
                  value={linkTenantId}
                  onChange={(event) => setLinkTenantId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
                  required
                >
                  {users
                    .filter((user) => user.role === "WORKSPACE_USER")
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.email}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Locked Domain
                <select
                  value={linkDomainId}
                  onChange={(event) => setLinkDomainId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
                  required
                >
                  {activeGlobalDomains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.hostString}
                    </option>
                  ))}
                </select>
                <span className={selectedTenantAssignedDomain ? "mt-1 block text-xs text-slate-500" : "mt-1 block text-xs text-amber-300"}>
                  {selectedTenantAssignedDomain
                    ? `Assigned domain: ${selectedTenantAssignedDomain.hostString}`
                    : "Assign an active domain to this tenant first."}
                </span>
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
              <label className="text-sm font-medium text-slate-700">
                URL Prefix
                <input
                  value={linkSlug}
                  onChange={(event) => setLinkSlug(event.target.value)}
                  placeholder="welcome"
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Page Preset
                <select
                  value={linkPagePreset}
                  onChange={(event) => setLinkPagePreset(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
                  required
                >
                  {pagePresets.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Redirect Source
                <select
                  value={linkRedirectSource}
                  onChange={(event) => setLinkRedirectSource(event.target.value as "ADMIN_DESTINATION" | "PRESET_CONTROLLED")}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
                >
                  <option value="ADMIN_DESTINATION">Admin URL</option>
                  <option value="PRESET_CONTROLLED">Preset redirect</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr_auto] lg:items-end">
              <label className="text-sm font-medium text-slate-700">
                URL Expiry
                <select
                  value={linkExpiryBundle}
                  onChange={(event) => setLinkExpiryBundle(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
                >
                  <option value="none">No expiry</option>
                  <option value="1w">1 week</option>
                  <option value="2w">2 weeks</option>
                  <option value="1m">1 month</option>
                  <option value="3m">3 months</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Admin Destination URL
                <input
                  type="url"
                  value={linkDestination}
                  onChange={(event) => setLinkDestination(event.target.value)}
                  placeholder="https://example.com"
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                  required
                />
              </label>
              <Button type="submit" className="h-10" disabled={!linkTenantId || !linkDomainId || !selectedTenantAssignedDomain}>
                Assign Link
              </Button>
            </div>
          </form>
          {linkMessage ? <p className="mt-4 text-sm font-medium text-slate-600">{linkMessage}</p> : null}

          <div className="grid gap-4">
            {managedLinks.map((link) => {
              const host = link.domain?.hostString ?? "unassigned-domain";
              const userEmail = link.user?.email ?? "Unknown tenant";
              const edit = linkEdits[link.id] ?? { slug: link.slug, destinationUrl: link.destinationUrl };
              const hasEditChanges = edit.slug !== link.slug || edit.destinationUrl !== link.destinationUrl;

              return (
                <article key={link.id} className="rounded-md border border-white/10 bg-white/5 p-3">
                  <div className="grid gap-3 xl:grid-cols-[1fr_1.7fr]">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">{link.status}</span>
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">{link._count?.clicks ?? 0} clicks</span>
                        <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{userEmail}</span>
                      </div>
                      <p className="truncate font-mono text-sm font-semibold text-blue-700">{host}/{link.slug}</p>
                      <div className="grid gap-0.5 font-mono text-[11px] text-slate-500">
                        <span className="truncate">index.html: {host}/{link.slug}/index.html</span>
                        <span className="truncate">dashboard.html: {host}/{link.slug}/dashboard.html</span>
                        <span className="truncate">admin URL: {link.destinationUrl}</span>
                      </div>
                      {(link.slugAliases ?? []).length > 0 ? (
                        <div className="rounded-md border border-amber-400/20 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                          <p className="font-bold uppercase">Previous prefixes still active</p>
                          {(link.slugAliases ?? []).map((alias) => (
                            <p key={alias.id} className="mt-1 truncate font-mono">
                              {host}/{alias.slug} until {new Date(alias.expiresAt).toLocaleString()}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-[11px] font-semibold uppercase text-slate-500">URL access: {formatExpiry(link.expiresAt)}</p>
                    </div>

                    <div className="grid gap-2 md:grid-cols-6">
                      <label className="text-[11px] font-semibold uppercase text-slate-500 md:col-span-2">
                        Prefix
                        <input
                          value={edit.slug}
                          onChange={(event) =>
                            setLinkEdits((current) => ({
                              ...current,
                              [link.id]: { ...edit, slug: event.target.value },
                            }))
                          }
                          className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm normal-case text-slate-900 outline-none focus:border-sky-400"
                        />
                      </label>
                      <label className="text-[11px] font-semibold uppercase text-slate-500 md:col-span-4">
                        Destination URL
                        <input
                          value={edit.destinationUrl}
                          onChange={(event) =>
                            setLinkEdits((current) => ({
                              ...current,
                              [link.id]: { ...edit, destinationUrl: event.target.value },
                            }))
                          }
                          className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm normal-case text-slate-900 outline-none focus:border-sky-400"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Page Preset
                        <select
                          value={link.indexPagePreset}
                          onChange={(event) => void handleManagedLinkPresetChange(link.id, event.target.value)}
                          className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm normal-case text-slate-900 outline-none focus:border-sky-400"
                          disabled={savingLinkPresetId === link.id}
                        >
                          {pagePresets.map((preset) => (
                            <option key={preset.key} value={preset.key}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Redirect Source
                        <select
                          value={link.redirectSource ?? "ADMIN_DESTINATION"}
                          onChange={(event) =>
                            void handleManagedLinkRedirectSourceChange(
                              link.id,
                              event.target.value as "ADMIN_DESTINATION" | "PRESET_CONTROLLED",
                            )
                          }
                          className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm normal-case text-slate-900 outline-none focus:border-sky-400"
                          disabled={savingLinkRedirectId === link.id}
                        >
                          <option value="ADMIN_DESTINATION">Admin URL</option>
                          <option value="PRESET_CONTROLLED">Preset redirect</option>
                        </select>
                      </label>
                      <div className="grid gap-1">
                        <label className="text-xs font-semibold uppercase text-slate-500">
                          Expiry Bundle
                          <select
                            value={linkExpiryBundles[link.id] ?? "none"}
                            onChange={(event) => setLinkExpiryBundles((current) => ({ ...current, [link.id]: event.target.value }))}
                            className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm normal-case text-slate-900 outline-none focus:border-sky-400"
                          >
                            <option value="none">No expiry</option>
                            <option value="1w">1 week</option>
                            <option value="2w">2 weeks</option>
                            <option value="1m">1 month</option>
                            <option value="3m">3 months</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-3 gap-2 md:col-span-3">
                        <Button
                          type="button"
                          className="h-8 bg-sky-600 px-3 text-xs hover:bg-sky-500"
                          disabled={!hasEditChanges || savingManagedLinkId === link.id}
                          onClick={() => void handleManagedLinkSave(link)}
                        >
                          {savingManagedLinkId === link.id ? "Saving" : "Save"}
                        </Button>
                        <Button
                          type="button"
                          className="h-8 bg-violet-600 px-3 text-xs hover:bg-violet-500"
                          disabled={savingLinkExpiryId === link.id}
                          onClick={() => void handleLinkExpiryChange(link.id)}
                        >
                          Set Expiry
                        </Button>
                        <Button
                          type="button"
                          className="h-8 bg-rose-600 px-3 text-xs hover:bg-rose-500"
                          disabled={deletingManagedLinkId === link.id}
                          onClick={() => void handleManagedLinkDelete(link)}
                        >
                          {deletingManagedLinkId === link.id ? "Deleting" : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
            );
            })}
          </div>
        </CardContent>
      </Card>

      <Card id="presets">
        <CardHeader className="bg-emerald-500/10">
          <CardTitle className="flex items-center gap-3">
            <span className="dashboard-icon h-8 w-8 text-emerald-300">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
              </svg>
            </span>
            index.html Preset Contents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePreset} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Preset
              <select
                value={editingPresetKey}
                onChange={(event) => setEditingPresetKey(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
              >
                {pagePresets.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-950">Upload preset folder ZIP</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    ZIP must contain root-level index.html and dashboard.html. CSS, JS, images, fonts, media, PDFs, and nested asset folders are preserved and served from the generated tenant URL.
                  </p>
                </div>
                <label className="block min-w-0 flex-1 text-sm font-medium text-emerald-950">
                  Preset ZIP
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={(event) => setPresetZipFile(event.target.files?.[0] ?? null)}
                    className="mt-1 block w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-emerald-700 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white"
                  />
                </label>
                <Button type="button" onClick={() => void handleUploadPresetZip()} disabled={!editingPreset || !presetZipFile || isUploadingPresetZip}>
                  {isUploadingPresetZip ? "Uploading..." : "Upload ZIP"}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Folder
                <input
                  value={editingPreset?.folderPath ?? ""}
                  disabled
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-slate-500"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                File
                <select
                  value={editingFilePath}
                  onChange={(event) => setEditingFilePath(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
                >
                  <option value="index.html">index.html</option>
                  {(editingPreset?.files ?? []).map((file) => (
                    <option key={file.filePath} value={file.filePath}>
                      {file.filePath}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Display Name
                <input
                  value={editingPreset?.name ?? ""}
                  onChange={(event) =>
                    setEditingPreset((preset) => (preset ? { ...preset, name: event.target.value } : preset))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Description
                <input
                  value={editingPreset?.description ?? ""}
                  onChange={(event) =>
                    setEditingPreset((preset) => (preset ? { ...preset, description: event.target.value } : preset))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                  required
                />
              </label>
            </div>
            {isSelectedPresetTextFile ? (
              <label className="block text-sm font-medium text-slate-700">
                {editingFilePath} Content
                <textarea
                  value={selectedPresetFile?.content ?? ""}
                  onChange={(event) => {
                    const nextContent = event.target.value;

                    setEditingPreset((preset) => {
                      if (!preset) {
                        return preset;
                      }

                      if (editingFilePath === "index.html") {
                        return { ...preset, htmlContent: nextContent };
                      }

                      return {
                        ...preset,
                        files: preset.files.map((file) =>
                          file.filePath === editingFilePath ? { ...file, content: nextContent } : file,
                        ),
                      };
                    });
                  }}
                  className="mt-1 min-h-80 w-full rounded-md border border-slate-300 p-3 font-mono text-xs outline-none focus:border-slate-900"
                  spellCheck={false}
                  required
                />
              </label>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-bold text-slate-900">{editingFilePath}</p>
                <p className="mt-1">Binary asset stored from ZIP. It will be served as {selectedPresetFile?.contentType ?? "application/octet-stream"}.</p>
                <p className="mt-1 text-xs text-slate-500">Upload a new ZIP package to replace this file.</p>
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Package files</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">index.html</span>
                {(editingPreset?.files ?? []).map((file) => (
                  <span key={file.filePath} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {file.filePath}
                    {file.contentEncoding === "base64" ? " · asset" : ""}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Folder files are served beside the generated page. Use relative paths like ./styles.css from index.html.
              Available placeholders: {"{{host}}"}, {"{{slug}}"}, {"{{shortUrl}}"}, {"{{destinationUrl}}"}, {"{{adminDestinationUrl}}"}.
              Use Redirect Source on each URL to decide whether {"{{destinationUrl}}"} follows the admin URL or lets the preset control redirects.
            </p>
            <Button type="submit" disabled={!editingPreset}>
              Save Text Changes
            </Button>
            {presetMessage ? <p className="text-sm font-medium text-slate-600">{presetMessage}</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card id="domain-pool">
        <CardHeader className="bg-cyan-500/10">
          <CardTitle className="flex items-center gap-3">
            <span className="dashboard-icon h-8 w-8 text-cyan-300">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 0 20" />
                <path d="M12 2a15.3 15.3 0 0 0 0 20" />
              </svg>
            </span>
            Domain Pool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateGlobalDomain} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="text-sm font-medium text-slate-700">
              Platform-Owned Domain
              <input
                value={globalDomainHost}
                onChange={(event) => setGlobalDomainHost(event.target.value)}
                placeholder="go.yourplatform.com"
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                required
              />
            </label>
            <Button type="submit">Add Global Domain</Button>
          </form>
          {domainMessage ? <p className="mt-4 text-sm font-medium text-slate-600">{domainMessage}</p> : null}

          <div className="mt-5 divide-y divide-slate-100">
            {globalDomains.map((domain) => (
              <div key={domain.id} className="grid gap-4 py-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-start">
                <div>
                  <p className="font-semibold text-slate-950">{domain.hostString}</p>
                  <p className="text-sm text-slate-500">
                    {domain._count?.links ?? 0} links assigned / {domainAssignmentLabel(domain)}
                  </p>
                  {domain.assignedUsers && domain.assignedUsers.length > 0 ? (
                    <p className="mt-1 max-w-2xl truncate text-xs text-slate-400">
                      Tenants: {domain.assignedUsers.map((user) => user.email).join(", ")}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                  <p className="font-bold uppercase text-cyan-200">DNS required</p>
                  <p className="mt-2">
                    Root domain: add an <span className="font-mono font-bold">A</span> record to your production server IP.
                  </p>
                  <p className="mt-1">
                    Subdomain: add <span className="font-mono font-bold">CNAME</span> to platform host, or an{" "}
                    <span className="font-mono font-bold">A</span> record to server IP.
                  </p>
                  {dnsStatuses[domain.id] ? (
                    <div className="mt-3 space-y-1">
                      <p className={dnsStatuses[domain.id].pointsToServer ? "font-bold text-emerald-300" : "font-bold text-amber-300"}>
                        {dnsStatuses[domain.id].error
                          ? dnsStatuses[domain.id].error
                          : dnsStatuses[domain.id].pointsToServer
                            ? "DNS points to this platform."
                            : dnsStatuses[domain.id].resolves
                              ? "DNS resolves, but not to the configured platform target."
                              : "DNS does not resolve yet."}
                      </p>
                      <p className="font-mono">A: {dnsStatuses[domain.id].aRecords.join(", ") || "none"}</p>
                      <p className="font-mono">CNAME: {dnsStatuses[domain.id].cnameRecords.join(", ") || "none"}</p>
                      <p className="font-mono">
                        Expected: {dnsStatuses[domain.id].expectedA ?? dnsStatuses[domain.id].expectedCname ?? "set PUBLIC_SERVER_IP"}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {domain.status}
                  </span>
                  <span className="w-fit rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {(domain.assignedUsers?.length ?? 0) > 1 ? "Reused" : (domain.assignedUsers?.length ?? 0) === 1 ? "Assigned" : "Open"}
                  </span>
                  <Button
                    type="button"
                    className="h-8 bg-cyan-600 px-3 hover:bg-cyan-500"
                    disabled={checkingDnsDomainId === domain.id}
                    onClick={() => void handleCheckDomainDns(domain)}
                  >
                    {checkingDnsDomainId === domain.id ? "Checking" : "Check DNS"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-amber-500/10">
          <CardTitle className="flex items-center gap-3">
            <span className="dashboard-icon h-8 w-8 text-amber-300">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 8h10" />
                <path d="M7 12h4" />
                <path d="M13 12h4" />
                <path d="M7 16h10" />
              </svg>
            </span>
            Tenant Workspaces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {users.map((user) => (
              <article key={user.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr_1.1fr_1.2fr]">
                  <div className="space-y-3">
                    <div>
                      <p className="truncate font-semibold text-slate-950">{user.email}</p>
                      <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{user.role}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <span className="rounded-md bg-blue-50 px-2 py-2 font-semibold text-blue-700">{user._count?.links ?? 0} links</span>
                      <span className="rounded-md bg-slate-50 px-2 py-2 font-semibold text-slate-600">{user._count?.domains ?? 0} domains</span>
                      <span className="rounded-md bg-slate-50 px-2 py-2 font-semibold text-slate-600">{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {user.role === "WORKSPACE_USER" ? (
                    <div className="rounded-md border border-white/10 bg-slate-950/20 p-3">
                      <p className="text-xs font-bold uppercase text-sky-300">Assigned Domain</p>
                      <label className="mt-3 block text-sm font-medium text-slate-700">
                        Domain
                        <select
                          value={user.assignedDomainId ?? ""}
                          onChange={(event) => void handleAssignTenantDomain(user.id, event.target.value)}
                          className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-sky-400"
                          disabled={assigningDomainUserId === user.id}
                        >
                          <option value="">No domain assigned</option>
                          {activeGlobalDomains.map((domain) => (
                            <option key={domain.id} value={domain.id}>
                              {domain.hostString} ({domainAssignmentLabel(domain)})
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <select
                          value={domainExpiryBundles[user.id] ?? "none"}
                          onChange={(event) => setDomainExpiryBundles((current) => ({ ...current, [user.id]: event.target.value }))}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-sky-400"
                        >
                          <option value="none">No domain expiry</option>
                          <option value="1w">1 week</option>
                          <option value="2w">2 weeks</option>
                          <option value="1m">1 month</option>
                          <option value="3m">3 months</option>
                        </select>
                        <Button
                          type="button"
                          className="h-9 bg-sky-600 px-3 hover:bg-sky-500"
                          disabled={assigningDomainUserId === user.id}
                          onClick={() => void handleAssignTenantDomain(user.id, user.assignedDomainId ?? "")}
                        >
                          Save Time
                        </Button>
                      </div>
                      <p className="mt-3 text-xs text-slate-400">
                        {user.assignedDomain
                          ? `${user.assignedDomain.hostString} / ${formatExpiry(user.assignedDomainExpiresAt)}`
                          : "No active domain assigned."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-white/10 bg-slate-950/20 p-3 text-sm text-slate-400">System access does not require domain assignment.</div>
                  )}

                  {user.role === "WORKSPACE_USER" ? (
                    <div className="rounded-md border border-white/10 bg-slate-950/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase text-emerald-300">Tenant Panel</p>
                        <span
                          className={
                            user.tenantAccessActive
                              ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                              : "inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                          }
                        >
                          {user.tenantAccessActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{formatExpiry(user.tenantAccessExpiresAt)}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <select
                          value={tenantAccessBundles[user.id] ?? "1m"}
                          onChange={(event) => setTenantAccessBundles((current) => ({ ...current, [user.id]: event.target.value }))}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-sky-400"
                        >
                          <option value="1w">1 week</option>
                          <option value="2w">2 weeks</option>
                          <option value="1m">1 month</option>
                          <option value="3m">3 months</option>
                        </select>
                        <Button
                          type="button"
                          className="h-9 bg-emerald-600 px-3 hover:bg-emerald-500"
                          disabled={savingTenantAccessUserId === user.id}
                          onClick={() => void handleTenantAccessBundle(user.id, true)}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          className="h-9 bg-red-600 px-3 hover:bg-red-500"
                          disabled={savingTenantAccessUserId === user.id}
                          onClick={() => void handleTenantAccessBundle(user.id, false)}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-white/10 bg-slate-950/20 p-3 text-sm text-slate-400">Super admin panel access is unlimited.</div>
                  )}

                  {user.role === "WORKSPACE_USER" ? (
                    <div className="rounded-md border border-white/10 bg-slate-950/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase text-violet-300">Auto-Rotation</p>
                        <span
                          className={
                            user.autoRotationEnabled
                              ? "inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700"
                              : "inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700"
                          }
                        >
                          {user.autoRotationEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        Next: {user.nextAutoRotationAt ? new Date(user.nextAutoRotationAt).toLocaleString() : "Not scheduled"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Last: {user.lastAutoRotationAt ? new Date(user.lastAutoRotationAt).toLocaleString() : "Never"}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[0.8fr_1fr]">
                        <select
                          value={(rotationPolicies[user.id]?.enabled ?? user.autoRotationEnabled) ? "on" : "off"}
                          onChange={(event) =>
                            setRotationPolicies((current) => ({
                              ...current,
                              [user.id]: {
                                enabled: event.target.value === "on",
                                mode: current[user.id]?.mode ?? user.autoRotationMode ?? "SHORT",
                                intervalHours: current[user.id]?.intervalHours ?? String(user.autoRotationIntervalHours ?? 24),
                              },
                            }))
                          }
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-sky-400"
                        >
                          <option value="off">Disabled</option>
                          <option value="on">Enabled</option>
                        </select>
                        <select
                          value={rotationPolicies[user.id]?.mode ?? user.autoRotationMode ?? "SHORT"}
                          onChange={(event) =>
                            setRotationPolicies((current) => ({
                              ...current,
                              [user.id]: {
                                enabled: current[user.id]?.enabled ?? user.autoRotationEnabled,
                                mode: event.target.value as "SHORT" | "LONG",
                                intervalHours: current[user.id]?.intervalHours ?? String(user.autoRotationIntervalHours ?? 24),
                              },
                            }))
                          }
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-sky-400"
                        >
                          <option value="SHORT">Short prefix</option>
                          <option value="LONG">Long prefix</option>
                        </select>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <select
                          value={rotationPolicies[user.id]?.intervalHours ?? String(user.autoRotationIntervalHours ?? 24)}
                          onChange={(event) =>
                            setRotationPolicies((current) => ({
                              ...current,
                              [user.id]: {
                                enabled: current[user.id]?.enabled ?? user.autoRotationEnabled,
                                mode: current[user.id]?.mode ?? user.autoRotationMode ?? "SHORT",
                                intervalHours: event.target.value,
                              },
                            }))
                          }
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-sky-400"
                        >
                          <option value="1">Every 1 hour</option>
                          <option value="6">Every 6 hours</option>
                          <option value="12">Every 12 hours</option>
                          <option value="24">Every 1 day</option>
                          <option value="72">Every 3 days</option>
                          <option value="168">Every 7 days</option>
                        </select>
                        <Button
                          type="button"
                          className="h-9 bg-violet-600 px-3 hover:bg-violet-500"
                          disabled={savingTenantAccessUserId === user.id}
                          onClick={() => void handleRotationPolicy(user)}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
