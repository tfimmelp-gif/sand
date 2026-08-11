import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.clickLog.findMany({
    where: {
      timestamp: { gte: since },
      link: { userId: session.user.id },
    },
    select: { timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  const buckets = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.now() - (23 - index) * 60 * 60 * 1000);
    return {
      hour: `${date.getHours().toString().padStart(2, "0")}:00`,
      clicks: 0,
    };
  });

  for (const row of rows) {
    const ageHours = Math.floor((Date.now() - row.timestamp.getTime()) / (60 * 60 * 1000));
    const index = 23 - ageHours;
    if (index >= 0 && index < buckets.length) {
      buckets[index].clicks += 1;
    }
  }

  return NextResponse.json(buckets);
}
