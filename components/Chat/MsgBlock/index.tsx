import MarkdownIt from "markdown-it";

type MsgRole = "human" | "ai";

type MsgBlockProps = {
  role: MsgRole;
  content: string;
};

// 关闭原生 HTML，降低模型/用户内容注入 XSS 的风险
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

/** 单条对话气泡：AI 靠左，Human 靠右；内容经 markdown-it 渲染 */
const MsgBlock = ({ role, content }: MsgBlockProps) => {
  const isHuman = role === "human";
  const html = md.render(content ?? "");
  console.log('html', html);

  return (
    <div className={isHuman ? "msg-row-end" : "msg-row-start"}>
      <div
        className={isHuman ? "msg-bubble-human" : "msg-bubble-ai"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

export default MsgBlock;
export type { MsgRole, MsgBlockProps };
