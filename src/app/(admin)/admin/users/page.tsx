"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  assignedDomainId?: string | null;
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
  status: string;
  user: {
    id: string;
    email: string;
  };
  domain: {
    id: string;
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
  folderPath: string;
  htmlContent: string;
  files: Array<{
    id?: string;
    filePath: string;
    contentType: string;
    content: string;
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

export default function SuperAdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [globalDomains, setGlobalDomains] = useState<GlobalDomain[]>([]);
  const [managedLinks, setManagedLinks] = useState<ManagedLink[]>([]);
  const [pagePresets, setPagePresets] = useState<PagePreset[]>([]);
  const [editingPresetKey, setEditingPresetKey] = useState("minimal");
  const [editingPreset, setEditingPreset] = useState<PagePreset | null>(null);
  const [editingFilePath, setEditingFilePath] = useState("index.html");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [globalDomainHost, setGlobalDomainHost] = useState("");
  const [linkTenantId, setLinkTenantId] = useState("");
  const [linkDomainId, setLinkDomainId] = useState("");
  const [linkPagePreset, setLinkPagePreset] = useState("minimal");
  const [linkSlug, setLinkSlug] = useState("");
  const [linkDestination, setLinkDestination] = useState("");
  const [message, setMessage] = useState("");
  const [domainMessage, setDomainMessage] = useState("");
  const [linkMessage, setLinkMessage] = useState("");
  const [presetMessage, setPresetMessage] = useState("");
  const [assigningDomainUserId, setAssigningDomainUserId] = useState("");
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
    const response = await fetch("/api/admin/users");
    if (response.ok) {
      setUsers(await response.json());
    }
  }

  async function fetchGlobalDomains() {
    const response = await fetch("/api/admin/domains");
    if (response.ok) {
      setGlobalDomains(await response.json());
    }
  }

  async function fetchManagedLinks() {
    const response = await fetch("/api/admin/links");
    if (response.ok) {
      setManagedLinks(await response.json());
    }
  }

  async function fetchPagePresets() {
    const response = await fetch("/api/admin/page-presets");
    if (response.ok) {
      const presets = (await response.json()) as PagePreset[];
      setPagePresets(presets);
      const activePreset = presets.find((preset) => preset.key === editingPresetKey) ?? presets[0] ?? null;
      setEditingPreset(activePreset ? { ...activePreset } : null);
      if (activePreset) {
        setEditingPresetKey(activePreset.key);
      }
    }
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
      }),
    });

    if (response.ok) {
      setLinkSlug("");
      setLinkDestination("");
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

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminSession() {
      const response = await fetch("/api/auth/session");
      const session = response.ok ? ((await response.json()) as { user?: { role?: string } }) : null;

      if (!isMounted) {
        return;
      }

      if (session?.user?.role !== "SUPER_ADMIN") {
        router.replace("/admin/login");
        return;
      }

      setIsAuthorized(true);
      setIsCheckingAuth(false);
    }

    void verifyAdminSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

    void fetchUsers();
    void fetchGlobalDomains();
    void fetchManagedLinks();
    void fetchPagePresets();
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

  async function handleAssignTenantDomain(userId: string, assignedDomainId: string) {
    setAssigningDomainUserId(userId);
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        assignedDomainId: assignedDomainId || null,
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

      <Card>
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

      <Card>
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
        <CardContent>
          <form onSubmit={handleCreateManagedLink} className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_2fr_auto] lg:items-end">
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
              Domain
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
              {selectedTenantAssignedDomain ? (
                <span className="mt-1 block text-xs text-slate-500">
                  Locked to assigned domain: {selectedTenantAssignedDomain.hostString}
                </span>
              ) : (
                <span className="mt-1 block text-xs text-amber-300">
                  Assign an active domain to this tenant first.
                </span>
              )}
            </label>
            <label className="text-sm font-medium text-slate-700">
              Slug
              <input
                value={linkSlug}
                onChange={(event) => setLinkSlug(event.target.value)}
                placeholder="welcome"
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              index.html Preset
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
              Destination URL
              <input
                type="url"
                value={linkDestination}
                onChange={(event) => setLinkDestination(event.target.value)}
                placeholder="https://example.com"
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
                required
              />
            </label>
            <Button type="submit" disabled={!linkTenantId || !linkDomainId || !selectedTenantAssignedDomain}>
              Assign Link
            </Button>
          </form>
          {linkMessage ? <p className="mt-4 text-sm font-medium text-slate-600">{linkMessage}</p> : null}

          <div className="mt-5 divide-y divide-slate-100">
            {managedLinks.map((link) => (
              <div key={link.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-blue-700">
                    {link.domain.hostString}/{link.slug}
                  </p>
                  <p className="truncate font-mono text-xs text-slate-500">
                    Index page: {link.domain.hostString}/{link.slug}/index.html
                  </p>
                  <p className="truncate font-mono text-xs text-slate-500">
                    Dashboard page: {link.domain.hostString}/{link.slug}/dashboard.html
                  </p>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Preset: {pagePresets.find((preset) => preset.key === link.indexPagePreset)?.name ?? link.indexPagePreset}
                  </p>
                  <p className="truncate font-mono text-xs text-slate-500">{link.destinationUrl}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>{link.user.email}</span>
                  <span>{link._count?.clicks ?? 0} clicks</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {link.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
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
            <label className="block text-sm font-medium text-slate-700">
              {editingFilePath} Content
              <textarea
                value={
                  editingFilePath === "index.html"
                    ? (editingPreset?.htmlContent ?? "")
                    : (editingPreset?.files.find((file) => file.filePath === editingFilePath)?.content ?? "")
                }
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
            <p className="text-sm text-slate-500">
              Folder files are served beside the generated page. Use relative paths like ./styles.css from index.html.
              Available placeholders: {"{{host}}"}, {"{{slug}}"}, {"{{shortUrl}}"}, {"{{destinationUrl}}"}
            </p>
            <Button type="submit" disabled={!editingPreset}>
              Save Preset HTML
            </Button>
            {presetMessage ? <p className="text-sm font-medium text-slate-600">{presetMessage}</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
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
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3 pr-4 font-semibold">Email</th>
                <th className="py-3 pr-4 font-semibold">Role</th>
                <th className="py-3 pr-4 font-semibold">Assigned Domain</th>
                <th className="py-3 pr-4 font-semibold">Links</th>
                <th className="py-3 pr-4 font-semibold">Domains</th>
                <th className="py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium text-slate-950">{user.email}</td>
                  <td className="py-3 pr-4 text-slate-600">{user.role}</td>
                  <td className="py-3 pr-4 text-slate-600">
                    {user.role === "WORKSPACE_USER" ? (
                      <>
                        <select
                          value={user.assignedDomainId ?? ""}
                          onChange={(event) => void handleAssignTenantDomain(user.id, event.target.value)}
                          className="h-9 min-w-48 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-sky-400"
                          disabled={assigningDomainUserId === user.id}
                        >
                          <option value="">No domain assigned</option>
                          {activeGlobalDomains.map((domain) => (
                            <option key={domain.id} value={domain.id}>
                              {domain.hostString} ({domainAssignmentLabel(domain)})
                            </option>
                          ))}
                        </select>
                      {user.assignedDomain ? (
                        <span className="mt-1 block text-xs text-slate-400">
                          Active domain: {user.assignedDomain.hostString}
                        </span>
                      ) : null}
                      </>
                    ) : (
                      <span className="text-slate-500">System access</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{user._count?.links ?? 0}</td>
                  <td className="py-3 pr-4 text-slate-600">{user._count?.domains ?? 0}</td>
                  <td className="py-3 text-slate-600">{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
