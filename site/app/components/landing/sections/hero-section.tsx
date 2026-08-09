import { GITHUB_URL } from "../content";
import { ExternalLink } from "../ui/external-link";

function DashboardPreview() {
  return (
    <figure className="min-w-0">
      <div
        className="flex flex-col gap-4 rounded-card border border-rule bg-paper-2 p-5 text-sm text-ink"
        style={{
          boxShadow:
            "0 24px 60px -24px color-mix(in oklch, var(--color-paper) 92%, transparent)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="font-mono text-base font-medium text-ink">default</span>
            <span className="text-xs text-ink-2">ZEUSGMJ</span>
          </span>
          <span className="rounded-pill bg-accent/15 px-2.5 py-1 font-mono text-xs font-semibold text-accent">
            Valid
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-[calc(var(--radius-card)-0.375rem)] py-4">
          <span className="tabular-nums font-mono text-2xl font-semibold text-ink">
            139d 07h 33m 12s
          </span>
          <span className="text-xs text-ink-2">until refresh token expires</span>
          <div
            role="progressbar"
            aria-label="Refresh token lifetime remaining"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={76}
            aria-valuetext="76% of refresh token lifetime remaining"
            className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-accent/20"
          >
            <div
              className="h-full origin-left rounded-pill bg-accent"
              style={{ transform: "scaleX(0.76)" }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="uppercase tracking-wide text-faint">Issued at</div>
            <div className="text-ink-2">Jun 1, 2026, 11:24 AM</div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-faint">Expires at</div>
            <div className="text-ink-2">Dec 1, 2026, 11:24 AM</div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-faint">Last refresh</div>
            <div className="text-ink-2">Jul 14, 2026, 6:47 PM</div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-faint">Days left</div>
            <div className="text-ink-2">139</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-pill border border-rule px-3 py-1.5 font-medium text-ink">
            Reauthorize
          </span>
          <span className="rounded-pill border border-rule px-3 py-1.5 font-medium text-ink-2">
            Test notification
          </span>
          <span className="rounded-pill border border-rule px-3 py-1.5 font-medium text-ink-2">
            Disable
          </span>
        </div>
        <div className="flex flex-col gap-2 text-xs">
          <div className="rounded-lg border border-rule px-3 py-2 text-ink-2">
            Spotify app (shared)
          </div>
          <div className="rounded-lg border border-rule px-3 py-2 text-ink-2">Scopes</div>
        </div>
      </div>
      <figcaption className="mt-3 font-mono text-xs text-faint">
        A profile in the dashboard.
      </figcaption>
    </figure>
  );
}

export function HeroSection() {
  return (
    <section
      id="top"
      className="mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-10 lg:pt-24"
    >
      <div className="min-w-0">
        <h1 className="min-w-0 max-w-2xl font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink wrap-anywhere sm:text-5xl lg:text-6xl">
          One place for your <span className="text-accent">Spotify refresh tokens</span>.
        </h1>
        <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink">
          I built ReTokenD because I was tired of replacing Spotify tokens in every project that
          used them. It keeps refresh tokens in one place, gives those projects short-lived access
          tokens through a single endpoint, and handles reauthorization from one dashboard.
        </p>
        <p className="mt-4 max-w-[60ch] font-mono text-sm text-faint">
          Spotify applies a six-month refresh-token lifetime to new apps from June 18, 2026 and
          existing apps from July 20, 2026. Refreshing does not extend the window.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#setup" className="pill-cta">
            How to run it
          </a>
          <ExternalLink href={GITHUB_URL} className="pill-secondary">
            Source on GitHub
          </ExternalLink>
        </div>
      </div>

      <DashboardPreview />
    </section>
  );
}
