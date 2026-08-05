import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { postRequest } from "../utils";

const searchApi = async ({
  query,
  maxResults = 10,
}: {
  query: string;
  maxResults?: number;
}) => {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return "web_search 未配置 TAVILY_API_KEY";

  // postRequest 内部会 JSON.stringify，这里传对象即可，勿再 stringify
  const data = await postRequest({
    url: "https://api.tavily.com/search",
    data: {
      api_key: key,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
    },
  });
  console.log("🚀 ~ searchApi ~ data:", data)

  if (data?.success === false) {
    return `web_search 失败: ${data.message ?? "请求失败"}`;
  }
  // Tavily 校验失败时返回 { detail: [...] }
  if (data?.detail) {
    return `web_search 失败: ${JSON.stringify(data.detail)}`;
  }

  const results = data?.results ?? [];
  if (!results.length) return "未找到相关结果";
  return results
    .slice(0, maxResults)
    .map(
      (r: { title: string; url: string; content: string }, i: number) =>
        `${i + 1}. [${r.title}](${r.url})\n   ${(r.content ?? "").slice(0, 200)}`,
    )
    .join("\n");
};

/** web_search 工具 */
export const webSearchTool = tool(
  async ({ query, maxResults }) => searchApi({ query, maxResults }),
  {
    name: "web_search",
    description:
      "搜索公开网页获取最新信息。当用户问新闻、时事、价格、文档版本等需要联网的事实时必须调用。",
    // schema: 给模型看的说明书
    schema: z.object({
      query: z.string().describe("搜索关键词"),
      maxResults: z.number().int().min(1).max(10).optional().default(3),
    }),
  },
);
