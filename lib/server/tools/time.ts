import { tool } from "@langchain/core/tools";
import { z } from "zod";

/** 获取服务器当前时间（Asia/Shanghai） */
export const getNowTimeTool = tool(
  async () =>
    new Date().toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour12: false,
    }),
  {
    name: "get_now_time",
    description:
      "获取当前日期和时间。当用户询问现在几点、今天几号或当前时间时必须调用。",
    schema: z.object({}),
  },
);
