/** 多轮对话里一条已完成的消息（不含本轮正在输入的 msg） */
export type ChatHistoryItem = {
  role: "human" | "ai";
  content: string;
};
