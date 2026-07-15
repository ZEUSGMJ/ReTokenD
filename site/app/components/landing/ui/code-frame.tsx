import type { LucideIcon } from "lucide-react";
import { Braces, Code2, FileKey2, Info, Terminal } from "lucide-react";
import { createCssVariablesTheme, createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { CopyCodeButton } from "./copy-code-button";
import styles from "./code-frame.module.css";

export type CodeLanguage = "shellscript" | "dotenv" | "json" | "text";

type CodeFrameProps = {
  label: string;
  language: CodeLanguage;
  code: string;
  notes?: string[];
  copyable?: boolean;
  icon?: LucideIcon;
};

const languageIcons: Record<CodeLanguage, LucideIcon> = {
  shellscript: Terminal,
  dotenv: FileKey2,
  json: Braces,
  text: Code2,
};

const retokendTheme = createCssVariablesTheme({
  name: "retokend-css-variables",
  variablePrefix: "--shiki-",
});

const highlighter = createHighlighterCore({
  themes: [retokendTheme],
  langs: [
    import("shiki/langs/shellscript.mjs"),
    import("shiki/langs/dotenv.mjs"),
    import("shiki/langs/json.mjs"),
  ],
  engine: createOnigurumaEngine(import("shiki/wasm")),
});

export async function CodeFrame({
  label,
  language,
  code,
  notes = [],
  copyable = true,
  icon,
}: CodeFrameProps) {
  const source = code.trim();
  const html = (await highlighter).codeToHtml(source, {
    lang: language,
    theme: "retokend-css-variables",
  });
  const LanguageIcon = icon ?? languageIcons[language];

  return (
    <figure className={styles.frame}>
      <figcaption className={styles.header}>
        <div className={styles.identity}>
          <LanguageIcon aria-hidden="true" className={styles.languageIcon} />
          <span className={styles.label}>{label}</span>
        </div>
        {copyable ? <CopyCodeButton code={source} /> : null}
      </figcaption>

      <div
        className={styles.codeRegion}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {notes.length > 0 ? (
        <div className={styles.noteRegion}>
          <Info aria-hidden="true" className={styles.noteIcon} />
          <ul className={styles.notes}>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </figure>
  );
}
