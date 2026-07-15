"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, LoaderCircle, TriangleAlert } from "lucide-react";
import styles from "./code-frame.module.css";

type CopyStatus = "idle" | "copying" | "copied" | "error";

const statusContent = {
  idle: { label: "Copy", icon: Copy },
  copying: { label: "Copying", icon: LoaderCircle },
  copied: { label: "Copied", icon: Check },
  error: { label: "Copy failed", icon: TriangleAlert },
} satisfies Record<CopyStatus, { label: string; icon: typeof Copy }>;

export function CopyCodeButton({ code }: { code: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { label, icon: StatusIcon } = statusContent[status];

  function clearResetTimer() {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }

  function scheduleReset() {
    clearResetTimer();
    resetTimer.current = setTimeout(() => setStatus("idle"), 2500);
  }

  useEffect(() => clearResetTimer, []);

  async function copyCode() {
    if (status === "copying") return;

    setStatus("copying");
    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    scheduleReset();
  }

  return (
    <button
      type="button"
      className={styles.copyButton}
      data-state={status}
      disabled={status === "copying"}
      aria-label="Copy code to clipboard"
      onClick={copyCode}
    >
      <StatusIcon
        aria-hidden="true"
        className={`${styles.copyIcon} ${status === "copying" ? styles.copyIconLoading : ""}`}
      />
      <span className={styles.copyLabel} aria-live="polite">
        {label}
      </span>
    </button>
  );
}
