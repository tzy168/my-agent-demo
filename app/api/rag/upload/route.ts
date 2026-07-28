import {
  clearRagStore,
  errorResponse,
  ingestText,
  successResponse,
} from "@/lib/server";

const ALLOWED_EXT = new Set([".txt", ".md", ".markdown"]);
const MAX_BYTES = 1 * 1024 * 1024; // 1MB，demo 足够

/**
 * POST multipart/form-data
 * - @param file: 文本文件
 * - @param clear: 可选，"1" 表示上传前清空知识库
 * - @returns 上传并索引成功
 */
export async function POST(request: Request) {
  console.log('Rag upload step 1：request');

  try {
    const form = await request.formData();
    const file = form.get("file");
    const clear = form.get("clear");

    if (!(file instanceof File)) {
      return errorResponse("请上传文件（字段名 file）", -1, 400);
    }

    // 获取文件名
    const name = file.name.toLowerCase();
    // 获取文件扩展名
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";

    // 文件校验
    if (!ALLOWED_EXT.has(ext)) {
      return errorResponse("仅支持 .txt / .md / .markdown", -1, 400);
    }
    if (file.size > MAX_BYTES) {
      return errorResponse("文件不能超过 1MB", -1, 400);
    }

    // 是否清空之前上传的
    if (clear === "1" || clear === "true") {
      clearRagStore();
    }

    // 将文件内容转为字符串
    const text = await file.text();
    const data = await ingestText(text, file.name);
    return successResponse(data, "上传并索引成功");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "上传失败";
    return errorResponse(message);
  }
}
