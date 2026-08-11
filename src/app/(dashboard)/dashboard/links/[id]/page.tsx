import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

function topCounts(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value || "Unknown", (counts.get(value || "Unknown") ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? <p className="text-sm text-slate-500">No click data yet.</p> : null}
        {rows.map((row) => (
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
        ))}
      </CardContent>
    </Card>
  );
}

export default async function LinkAnalyticsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const link = await prisma.link.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      domain: {
        select: {
          hostString: true,
          status: true,
        },
      },
      clicks: {
        orderBy: { timestamp: "desc" },
        take: 500,
      },
    },
  });

  if (!link) {
    notFound();
  }

  const clicks = link.clicks;
  const totalClicks = clicks.length;
  const uniqueVisitors = totalClicks;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Link Analytics</p>
          <h1 className="break-all text-3xl font-bold text-slate-950">
            {link.domain.hostString}/{link.slug}
          </h1>
          <p className="mt-2 max-w-3xl truncate text-sm text-slate-500">{link.destinationUrl}</p>
        </div>
        <SignOutButton />
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Clicks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{totalClicks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Unique Visitors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{uniqueVisitors}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Domain Health</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{link.domain.status}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Breakdown title="Top Countries" rows={topCounts(clicks.map((click) => click.country))} />
        <Breakdown title="Top Referrers" rows={topCounts(clicks.map((click) => click.referrer))} />
        <Breakdown title="Device Types" rows={topCounts(clicks.map((click) => click.device))} />
      </section>
    </main>
  );
}
