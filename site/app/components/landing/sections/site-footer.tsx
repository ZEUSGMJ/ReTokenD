import { GITHUB_URL } from "../content";
import { ExternalLink } from "../ui/external-link";

export function ClosingSection() {
  return (
    <section className="relative overflow-hidden border-y border-rule">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, color-mix(in oklch, var(--color-accent) 8%, transparent), transparent)",
        }}
      />
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-24 text-center">
        <p className="mx-auto max-w-[65ch] text-lg leading-relaxed text-ink-2">
          I built ReTokenD for my own projects and released it under GPL-3.0. The code and setup
          guide are on GitHub.
        </p>
        <ExternalLink href={GITHUB_URL} className="pill-cta mt-8 inline-flex">
          ReTokenD on GitHub
        </ExternalLink>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-5 py-10 text-center">
        <p className="font-display text-lg font-semibold text-ink-2">ReTokenD</p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-faint">
          GPL-3.0 · not affiliated with Spotify ·{" "}
          <ExternalLink
            href={GITHUB_URL}
            className="inline-flex items-center gap-1 whitespace-nowrap text-faint underline decoration-1 underline-offset-2 hover:text-accent"
          >
            github.com/ZEUSGMJ/ReTokenD
          </ExternalLink>
        </p>
      </div>
    </footer>
  );
}
