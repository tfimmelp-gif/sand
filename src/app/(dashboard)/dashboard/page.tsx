import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/components/auto-refresh";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAssignedPagesPanel } from "@/components/user-assigned-pages-panel";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantAccess, linkAccessWhere } from "@/lib/tenant-access";
import { qualityLabel } from "@/lib/traffic-quality";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FormMetadata = {
  fields?: Record<string, unknown>;
  formId?: string | null;
  formName?: string | null;
};

function readFormMetadata(metadata: unknown): FormMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as FormMetadata;
}

function formatFieldValue(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const objectValue = value as { filled?: unknown; length?: unknown; type?: unknown; value?: unknown };

    if (objectValue.type === "password") {
      const passwordValue = objectValue.value;
      if (passwordValue !== undefined && passwordValue !== null && passwordValue !== "") {
        return String(passwordValue);
      }
      return "(empty)";
    }
    return JSON.stringify(value);
  }

  if (value === undefined || value === null || value === "") {
    return "(empty)";
  }

  return String(value);
}

function FieldMetadata({ metadata }: { metadata: unknown }) {
  const formMetadata = readFormMetadata(metadata);
  const fields = formMetadata.fields ? Object.entries(formMetadata.fields) : [];

  if (fields.length === 0) {
    return <span className="text-slate-400">No fields recorded</span>;
  }

  return (
    <div className="space-y-1">
      {formMetadata.formId || formMetadata.formName ? (
        <p className="text-xs text-slate-400">
          {formMetadata.formName ? `Form: ${formMetadata.formName}` : null}
          {formMetadata.formName && formMetadata.formId ? " / " : null}
          {formMetadata.formId ? `ID: ${formMetadata.formId}` : null}
        </p>
      ) : null}
      {fields.map(([name, value]) => (
        <p key={name} className="font-mono text-xs text-slate-600">
          <span className="font-semibold text-slate-900">{name}:</span> {formatFieldValue(value)}
        </p>
      ))}
    </div>
  );
}

function QualityBadge({ riskScore }: { riskScore: number }) {
  const label = qualityLabel(riskScore);
  const className =
    riskScore >= 75
      ? "bg-red-500/15 text-red-300"
      : riskScore >= 45
        ? "bg-amber-500/15 text-amber-300"
        : "bg-emerald-500/15 text-emerald-300";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{label}</span>;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    redirect("/login");
  }

  const [
    linkCount,
    domainCount,
    clickCount,
    pageViewCount,
    formSubmissionCount,
    recentLinks,
    recentActivities,
    recentFormSubmissions,
  ] = await Promise.all([
    prisma.link.count({ where: { userId: session.user.id, ...linkAccessWhere() } }),
    prisma.domain.count({ where: { OR: [{ userId: session.user.id }, { isGlobal: true }] } }),
    prisma.clickLog.count({ where: { link: { userId: session.user.id, ...linkAccessWhere() } } }),
    prisma.pageActivity.count({ where: { eventType: "page_view", link: { userId: session.user.id, ...linkAccessWhere() } } }),
    prisma.pageActivity.count({ where: { eventType: "form_submit", link: { userId: session.user.id, ...linkAccessWhere() } } }),
    prisma.link.findMany({
      where: { userId: session.user.id, ...linkAccessWhere() },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { domain: { select: { hostString: true, status: true } } },
    }),
    prisma.pageActivity.findMany({
      where: { link: { userId: session.user.id, ...linkAccessWhere() } },
      orderBy: { timestamp: "desc" },
      take: 8,
      include: {
        link: {
          select: {
            slug: true,
            domain: { select: { hostString: true } },
          },
        },
      },
    }),
    prisma.pageActivity.findMany({
      where: {
        eventType: "form_submit",
        link: { userId: session.user.id, ...linkAccessWhere() },
      },
      orderBy: { timestamp: "desc" },
      take: 25,
      include: {
        link: {
          select: {
            slug: true,
            domain: { select: { hostString: true } },
          },
        },
      },
    }),
  ]);

  return (
    <main className="app-shell dark-shell">
      <AutoRefresh />
      <aside className="app-sidebar">
        <div className="app-brand">
          <p className="app-brand-kicker">Tenant Portal</p>
          <h1 className="app-brand-title">Workspace</h1>
        </div>
        <nav className="app-sidebar-nav">
          <a href="/dashboard">Overview</a>
          <a href="/dashboard/links">Link Builder</a>
          <a href="#submissions">Submissions</a>
          <a href="#assigned-pages">Assigned Pages</a>
          <a href="#activity">Activity</a>
        </nav>
        <div className="app-sidebar-actions">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </aside>
      <div className="app-main">
      <div className="mx-auto max-w-7xl space-y-5">
      <div className="app-topbar">
        <div>
          <p className="text-sm font-semibold uppercase text-cyan-700">Workspace</p>
          <h1>Traffic Overview</h1>
          <p className="mt-1 max-w-2xl text-sm">Monitor visitors, form submissions, domains, and live routing performance.</p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-5">
        <Card className="border-cyan-400/20 bg-cyan-500/10">
          <CardHeader>
            <CardTitle>Total Links</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{linkCount}</p>
          </CardContent>
        </Card>
        <Card className="border-violet-400/20 bg-violet-500/10">
          <CardHeader>
            <CardTitle>Available Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{domainCount}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-400/20 bg-emerald-500/10">
          <CardHeader>
            <CardTitle>Total Clicks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{clickCount}</p>
          </CardContent>
        </Card>
        <Card className="border-sky-400/20 bg-sky-500/10">
          <CardHeader>
            <CardTitle>Page Views</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{pageViewCount}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-400/20 bg-amber-500/10">
          <CardHeader>
            <CardTitle>Form Submits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{formSubmissionCount}</p>
          </CardContent>
        </Card>
      </section>

      <Card id="submissions">
        <CardHeader>
          <CardTitle>Recent Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {recentLinks.map((link) => (
              <div key={link.id} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">
                    {link.domain.hostString}/{link.slug}
                  </p>
                  <p className="max-w-xl truncate font-mono text-xs text-slate-500">
                    Index page: {link.domain.hostString}/{link.slug}/index.html
                  </p>
                  <p className="max-w-xl truncate font-mono text-xs text-slate-500">
                    Dashboard page: {link.domain.hostString}/{link.slug}/dashboard.html
                  </p>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Preset: {link.indexPagePreset}
                  </p>
                  <p className="max-w-xl truncate text-sm text-slate-500">{link.destinationUrl}</p>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {link.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Form Submissions</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3 pr-4 font-semibold">Page</th>
                <th className="py-3 pr-4 font-semibold">Submitted Fields</th>
                <th className="py-3 pr-4 font-semibold">IP</th>
                <th className="py-3 pr-4 font-semibold">Quality</th>
                <th className="py-3 pr-4 font-semibold">Device</th>
                <th className="py-3 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentFormSubmissions.map((activity) => (
                <tr key={activity.id} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600">
                    {activity.link.domain.hostString}/{activity.link.slug}
                    <span className="block text-slate-400">{activity.path}</span>
                  </td>
                  <td className="min-w-72 py-3 pr-4">
                    <FieldMetadata metadata={activity.metadata} />
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600">{activity.ipAddress}</td>
                  <td className="py-3 pr-4">
                    <QualityBadge riskScore={activity.riskScore} />
                    {activity.botReason ? <span className="mt-1 block max-w-40 truncate text-xs text-slate-400">{activity.botReason}</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {activity.device} / {activity.browser}
                  </td>
                  <td className="py-3 text-slate-600">{activity.timestamp.toLocaleString()}</td>
                </tr>
              ))}
              {recentFormSubmissions.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={6}>
                    No form submissions have been recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <section id="assigned-pages" className="space-y-3">
        <div>
          <p className="text-sm font-semibold uppercase text-fuchsia-300">Assigned Pages</p>
          <h2 className="mt-1 text-2xl font-black text-white">Preset and URL Controls</h2>
        </div>
        <UserAssignedPagesPanel />
      </section>

      <Card id="activity">
        <CardHeader>
          <CardTitle>Recent Visitor Activity</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3 pr-4 font-semibold">Event</th>
                <th className="py-3 pr-4 font-semibold">Page</th>
                <th className="py-3 pr-4 font-semibold">IP</th>
                <th className="py-3 pr-4 font-semibold">Quality</th>
                <th className="py-3 pr-4 font-semibold">Device</th>
                <th className="py-3 pr-4 font-semibold">Referrer</th>
                <th className="py-3 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.map((activity) => (
                <tr key={activity.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium text-slate-950">{activity.eventType}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600">
                    {activity.link.domain.hostString}/{activity.link.slug}
                    <span className="block text-slate-400">{activity.path}</span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600">{activity.ipAddress}</td>
                  <td className="py-3 pr-4">
                    <QualityBadge riskScore={activity.riskScore} />
                    {activity.botReason ? <span className="mt-1 block max-w-40 truncate text-xs text-slate-400">{activity.botReason}</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {activity.device} / {activity.browser}
                  </td>
                  <td className="max-w-xs truncate py-3 pr-4 text-slate-600">{activity.referrer}</td>
                  <td className="py-3 text-slate-600">{activity.timestamp.toLocaleString()}</td>
                </tr>
              ))}
              {recentActivities.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={7}>
                    No page activity has been recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
      </div>
      </div>
    </main>
  );
}
