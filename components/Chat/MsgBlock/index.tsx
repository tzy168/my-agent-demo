import Loader from "@/components/Loader";
import MarkdownIt from "markdown-it";

type MsgRole = "human" | "ai";

type MsgBlockProps = {
  role: MsgRole;
  content: string;
  loading: boolean;
};

// 关闭原生 HTML，降低模型/用户内容注入 XSS 的风险
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

/** 单条对话气泡：AI 靠左，Human 靠右；内容经 markdown-it 渲染 */
const MsgBlock = ({ role, content, loading }: MsgBlockProps) => {
  const isHuman = role === "human";
  const html = md.render(content ?? "");
  // 尚无正文时用 Loader，不能塞进 dangerouslySetInnerHTML
  const showLoader = loading && !isHuman && !content.trim();

  return (
    <div className={isHuman ? "msg-row-end" : "msg-row-start"}>
      <div className={isHuman ? "msg-bubble-human" : "msg-bubble-ai"}>
        {showLoader ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div><Loader /></div>
            <div>思考中...</div>
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
};

export default MsgBlock;
export type { MsgRole, MsgBlockProps };
