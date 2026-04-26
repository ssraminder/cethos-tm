import fs from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface Props {
  role: "admin" | "pm" | "translator";
}

const components: Components = {
  h1: (props) => (
    <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--color-navy)] mt-0 mb-3" {...props} />
  ),
  h2: (props) => (
    <h2 className="text-xl font-bold tracking-tight text-[color:var(--color-navy)] mt-10 mb-3 pt-4 border-t border-[color:var(--color-border-soft)] first:border-0 first:pt-0 first:mt-0" {...props} />
  ),
  h3: (props) => (
    <h3 className="text-base font-bold text-[color:var(--color-navy)] mt-6 mb-2" {...props} />
  ),
  h4: (props) => (
    <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate-500)] mt-5 mb-1.5" {...props} />
  ),
  p: (props) => (
    <p className="my-3 text-[color:var(--color-slate-700)] leading-relaxed" {...props} />
  ),
  strong: (props) => (
    <strong className="font-bold text-[color:var(--color-navy)]" {...props} />
  ),
  a: (props) => (
    <a className="text-[color:var(--color-teal-700)] hover:underline" {...props} />
  ),
  ul: (props) => (
    <ul className="my-3 ml-5 list-disc text-[color:var(--color-slate-700)] space-y-1" {...props} />
  ),
  ol: (props) => (
    <ol className="my-3 ml-5 list-decimal text-[color:var(--color-slate-700)] space-y-1" {...props} />
  ),
  li: (props) => (
    <li className="leading-relaxed" {...props} />
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className={`${className} block`} {...rest}>{children}</code>;
    }
    return (
      <code
        className="font-mono text-[12.5px] bg-[color:var(--color-slate-100)] border border-[color:var(--color-border-soft)] rounded px-1.5 py-0.5 text-[color:var(--color-navy)]"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre
      className="bg-[color:var(--color-navy)] text-[#E2E8F0] rounded-lg p-4 overflow-x-auto text-[12.5px] leading-relaxed my-4 font-mono"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="border-l-[3px] border-[color:var(--color-teal)] bg-[color:var(--color-teal-50)] px-4 py-2.5 my-4 text-[color:var(--color-slate-700)] rounded-r-md [&>p:last-child]:mb-0"
      {...props}
    />
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  img: (props: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="block max-w-full border border-[color:var(--color-border)] rounded-lg shadow-[var(--shadow-soft)] my-5"
      alt={props.alt ?? ""}
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-[color:var(--color-slate-50)]" {...props} />,
  th: (props) => (
    <th
      className="border border-[color:var(--color-border)] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-slate-600)]"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border border-[color:var(--color-border)] px-3 py-2 align-top text-[color:var(--color-slate-700)]" {...props} />
  ),
  hr: () => <hr className="border-0 border-t border-[color:var(--color-border-soft)] my-7" />,
};

/**
 * Server component: reads the role's training markdown and renders it
 * with Cethos-themed components (overriding Tailwind v4 preflight).
 * Image paths in the markdown should already be rooted at /training/<role>/.
 */
export function TrainingDoc({ role }: Props) {
  const filePath = path.join(process.cwd(), "src", "content", "training", `${role}.md`);
  const md = fs.readFileSync(filePath, "utf8");

  return (
    <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-8 max-w-4xl">
      <article className="training-doc">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{md}</ReactMarkdown>
      </article>
    </div>
  );
}
