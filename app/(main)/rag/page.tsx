import Rag from "@/components/Rag";

export default function RagPage() {
  // page-fill 占满顶栏下方剩余高度；内部 rag-hits / rag-chat-list 各自滚动
  return (
    <div className="page-fill">
      <Rag />
    </div>
  );
}
