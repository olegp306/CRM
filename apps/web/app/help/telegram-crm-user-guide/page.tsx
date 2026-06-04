import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { CopyCodeBlock } from "./copy-code-block";

export const metadata = {
  title: "Telegram CRM User Guide",
  description: "How to use the CRM Telegram bot for leads, search, updates, notes, and reminders."
};

const quickGuideLinks = [
  { href: "#guide-create", label: "Create" },
  { href: "#guide-search", label: "Search" },
  { href: "#guide-update", label: "Update" },
  { href: "#guide-reminder", label: "Reminder" }
] as const;

export default async function TelegramCrmUserGuidePage() {
  const markdown = await readTelegramCrmUserGuide();
  const blocks = parseMarkdownBlocks(markdown);

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6 text-foreground">
      <article className="mx-auto grid max-w-4xl gap-4 rounded-lg border border-border bg-white p-4 shadow-sm sm:p-6">
        <div className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CRM Telegram guide</p>
          <h1 className="mt-2 text-2xl font-semibold">Инструкция Telegram CRM</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Откройте эту страницу с кнопки Guide в Telegram. Команды и примеры можно выделять и копировать прямо отсюда.
          </p>
          <nav aria-label="Quick guide sections" className="mt-4 flex flex-nowrap gap-2 overflow-x-auto">
            {quickGuideLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-emerald-50 hover:text-emerald-900"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <MarkdownBlocks blocks={blocks} />
      </article>
    </main>
  );
}

async function readTelegramCrmUserGuide(): Promise<string> {
  const candidates = [
    join(process.cwd(), "docs", "TELEGRAM_CRM_USER_GUIDE_RU.md"),
    join(process.cwd(), "..", "..", "docs", "TELEGRAM_CRM_USER_GUIDE_RU.md")
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch {
      // Try the next monorepo/runtime cwd candidate.
    }
  }

  throw new Error("Telegram CRM user guide Markdown was not found.");
}

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "orderedList"; items: string[] }
  | { type: "code"; text: string }
  | { type: "tip"; children: MarkdownBlock[] }
  | { type: "table"; rows: string[][] };

function MarkdownBlocks({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <div className="grid gap-4">
      {blocks.map((block, index) => (
        <MarkdownBlockView key={index} block={block} />
      ))}
    </div>
  );
}

function MarkdownBlockView({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case "heading":
      return createHeading(block.level, block.text);
    case "paragraph":
      return <p className="text-sm leading-6">{renderInlineMarkdown(block.text)}</p>;
    case "list":
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
          {block.items.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-6">
          {block.items.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
    case "code":
      return <CopyCodeBlock text={block.text} />;
    case "tip":
      return (
        <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Хороший пример</p>
          <MarkdownBlocks blocks={block.children} />
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex === 0 ? "bg-muted font-semibold" : "border-t border-border"}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function createHeading(level: 1 | 2 | 3 | 4, text: string): ReactNode {
  const id = getGuideHeadingId(text) ?? undefined;
  const className = {
    1: "text-2xl font-semibold",
    2: "mt-3 scroll-mt-4 text-xl font-semibold",
    3: "mt-2 scroll-mt-4 text-lg font-semibold",
    4: "mt-1 scroll-mt-4 text-base font-semibold"
  }[level];

  if (level === 1) return <h1 id={id} className={className}>{text}</h1>;
  if (level === 2) return <h2 id={id} className={className}>{text}</h2>;
  if (level === 3) return <h3 id={id} className={className}>{text}</h3>;
  return <h4 id={id} className={className}>{text}</h4>;
}

function getGuideHeadingId(text: string): string | null {
  if (/Создание нового лида/i.test(text)) return "guide-create";
  if (/Поиск лида/i.test(text)) return "guide-search";
  if (/Редактирование лида/i.test(text)) return "guide-update";
  if (/Напоминания/i.test(text)) return "guide-reminder";
  return null;
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({ type: "code", text: codeLines.join("\n") });
      index += 1;
      continue;
    }

    if (line.startsWith("> [!TIP]")) {
      const tipLines: string[] = [];
      index += 1;
      while (index < lines.length && (lines[index] ?? "").startsWith(">")) {
        tipLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "tip", children: parseMarkdownBlocks(tipLines.join("\n")) });
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3 | 4, text: heading[2] });
      index += 1;
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      const tableLines: string[] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith("|") && (lines[index] ?? "").endsWith("|")) {
        tableLines.push(lines[index] ?? "");
        index += 1;
      }
      const rows = tableLines
        .filter((tableLine) => !/^\|\s*-+/.test(tableLine))
        .map((tableLine) =>
          tableLine
            .slice(1, -1)
            .split("|")
            .map((cell) => cell.trim())
        );
      blocks.push({ type: "table", rows });
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith("- ")) {
        items.push((lines[index] ?? "").slice(2).trim());
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\d+\.\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "orderedList", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() &&
      !/^(#{1,4})\s+/.test(lines[index] ?? "") &&
      !(lines[index] ?? "").startsWith("```") &&
      !(lines[index] ?? "").startsWith("> [!TIP]") &&
      !(lines[index] ?? "").startsWith("- ") &&
      !/^\d+\.\s+/.test(lines[index] ?? "") &&
      !((lines[index] ?? "").startsWith("|") && (lines[index] ?? "").endsWith("|"))
    ) {
      paragraphLines.push((lines[index] ?? "").trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return <span key={index}>{part}</span>;
  });
}
