export const modelConfig = {
  ollama: {
    // ollama 服务器地址
    host: process.env.OLLAMA_HOST || "http://localhost:11434",
    // 聊天模型
    chatModel: process.env.OLLAMA_CHAT_MODEL || "qwen3.5:4b",
    // 嵌入模型
    embedModel: process.env.OLLAMA_EMBED_MODEL || "mxbai-embed-large:latest",
    // 温度，温度越高，模型生成结果越随机
    temperature: process.env.OLLAMA_TEMPERATURE || 0.3,
  },
  deepseek: {
    // DeepSeek OpenAI 兼容接口
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    chatModel: process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat",
    temperature: process.env.DEEPSEEK_TEMPERATURE || 0.3,
    // 服务端兜底；优先用请求体 / 设置页传入的 apiKey
    apiKey: process.env.DEEPSEEK_API_KEY || "",
  },
};
