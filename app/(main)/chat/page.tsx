import Chat from "@/components/Chat";

export default function ChatPage() {
  // page-fill 占满顶栏下方剩余高度，供 chat-panel 贴底布局
  return (
    <div className="page-fill flex flex-col min-h-0">
      <Chat />
    </div>
  );
}
