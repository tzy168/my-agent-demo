export const modelConfig = {
  ollama: {
    // ollama 服务器地址
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    // 聊天模型
    chatModel: process.env.OLLAMA_CHAT_MODEL || 'qwen3.5:4b',
    // 嵌入模型
    embedModel: process.env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large:latest',
    // 温度，温度越高，模型生成结果越随机
    temperature: process.env.OLLAMA_TEMPERATURE || 0.3,
  }
}