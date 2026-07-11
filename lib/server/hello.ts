import type { HelloData } from "@/types/api";

/** 生成一条带时间戳的问候语 */
export async function getHelloMessage(): Promise<HelloData> {
  const now = new Date();
  // 仅在服务端组装，避免客户端时区差异
  const time = now.toLocaleTimeString("zh-CN", { hour12: false });
  return { message: `Hello Next! 当前服务端时间 ${time}` };
}
