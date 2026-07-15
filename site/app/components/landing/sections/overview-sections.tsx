import { FEATURES, STATS } from "../content";
import { ExternalLink } from "../ui/external-link";

function KeyFactsSection() {
  return (
    <section aria-label="Key facts" className="border-y border-rule">
      <div className="mx-auto grid max-w-6xl grid-cols-2 px-5 min-[60rem]:grid-cols-4">
        {STATS.map(([num, label], index) => (
          <div
            key={label}
            className={`flex flex-col gap-1 border-rule py-8 min-[60rem]:px-6 ${
              index >= 2 ? "border-t min-[60rem]:border-t-0" : ""
            } ${index > 0 ? "min-[60rem]:border-l" : ""}`}
          >
            <span className="tabular-nums font-display text-3xl font-semibold text-ink sm:text-4xl">
              {num}
            </span>
            <span className="text-sm text-ink-2">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section id="why" className="mx-auto max-w-6xl px-5 pb-16 pt-20 border-x border-b border-rule">
      <h2 className="font-display text-2xl font-semibold text-ink">Why this exists</h2>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">
        Spotify&apos;s{" "}
        <ExternalLink
          href="https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration"
          icon={false}
          className="text-ink underline decoration-accent decoration-1 underline-offset-2 hover:text-accent"
        >
          refresh-token expiration policy
        </ExternalLink>
        {" "}
        limits refresh tokens to six months for apps created on or after June 18, 2026, and applies
        the same limit to existing apps from July 20, 2026. Refreshing an access token doesn&apos;t
        extend the window. I use the same account across several projects, so an expiry meant
        re-authorizing and updating each project&apos;s env by hand. I didn&apos;t want to keep doing that.
      </p>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 pb-16 pt-4 border-x border-b border-rule">
      <h2 className="mb-8 font-display text-2xl font-semibold text-ink">What it does</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;

          return (
            <div
              key={feature.name}
              className="card-hover flex min-w-0 flex-col gap-3 rounded-card border border-rule bg-paper-2 p-6"
            >
              <div className="flex items-center gap-2.5">
                <Icon aria-hidden="true" className="size-5 shrink-0 text-accent" />
                <span className="font-display text-base font-semibold text-ink">
                  {feature.name}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink-2">{feature.blurb}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function OverviewSections() {
  return (
    <>
      <KeyFactsSection />
      <WhySection />
      <FeaturesSection />
    </>
  );
}
