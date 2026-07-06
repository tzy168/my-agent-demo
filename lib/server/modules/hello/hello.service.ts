import "server-only";

import { createGreeting, findLatestGreeting } from "./hello.repository";
import type { HelloResult } from "./hello.types";

const DEFAULT_MESSAGE = "Hello Next!";

/** 获取 Hello 问候语（优先读库，无数据时写入默认值） */
export async function getHelloMessage(): Promise<HelloResult> {
  const existing = await findLatestGreeting();
  if (existing) {
    return { message: existing.message };
  }

  const created = await createGreeting(DEFAULT_MESSAGE);
  return { message: created.message };
}
