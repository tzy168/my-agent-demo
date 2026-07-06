import "server-only";

import { prisma } from "@/lib/server/db";

/** 查询最新一条问候语 */
export async function findLatestGreeting() {
  return prisma.greeting.findFirst({
    orderBy: { createdAt: "desc" },
    select: { message: true },
  });
}

/** 写入问候语 */
export async function createGreeting(message: string) {
  return prisma.greeting.create({
    data: { message },
    select: { message: true },
  });
}
