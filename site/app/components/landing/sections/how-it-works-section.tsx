import type { ReactNode } from "react";
import { STEPS } from "../content";

function FlowNode({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-rule bg-paper-2 p-6">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-faint">{label}</span>
      <span className="font-display text-lg font-semibold text-ink">{title}</span>
      <div className="text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

function FlowConnector({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div className="flex flex-row items-center justify-center gap-3 px-2 py-3 lg:flex-col lg:gap-2 lg:py-2">
      <span className="whitespace-nowrap font-mono text-[11px] text-ink-2">{top}</span>
      <span aria-hidden="true" className="h-px w-8 bg-rule lg:h-8 lg:w-px" />
      <span className="whitespace-nowrap font-mono text-[11px] text-faint">{bottom}</span>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 pb-24 pt-20 border-x border-b border-rule">
      <h2 className="font-display text-2xl font-semibold text-ink">How it works</h2>
      <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-ink-2">
        One service between your projects and Spotify.
      </p>

      <div className="mt-10 flex flex-col gap-0 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch lg:gap-0">
        <FlowNode label="consumers" title="Your projects">
          Any bot, dashboard, or widget that uses the Spotify API calls{" "}
          <code className="font-mono text-ink">GET /api/token</code> with a bearer secret instead of
          storing its own refresh token.
        </FlowNode>
        <FlowConnector top="access token" bottom="short-lived" />
        <FlowNode label="this service" title="ReTokenD">
          Stores refresh tokens in Redis, fetches access tokens on demand, and tracks the
          six-month countdown for each profile.{" "}
          <span className="font-medium text-ink">The refresh tokens never leave this box.</span>
        </FlowNode>
        <FlowConnector top="token refresh" bottom="oauth" />
        <FlowNode label="upstream" title="Spotify">
          Uses standard OAuth. When the window closes, re-authorize from the dashboard. Each
          project gets a working token on its next request.
        </FlowNode>
      </div>

      <ol className="mt-16 grid gap-10 sm:grid-cols-3">
        {STEPS.map(([num, title, body]) => (
          <li key={num} className="flex flex-col gap-2 border-t border-rule pt-4">
            <span className="tabular-nums font-mono text-2xl font-semibold text-accent">
              {num}
            </span>
            <span className="font-display font-semibold text-ink">{title}</span>
            <span className="text-sm leading-relaxed text-ink-2">{body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
