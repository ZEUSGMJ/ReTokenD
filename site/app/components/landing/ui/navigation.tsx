"use client";

import { useState } from "react";
import { GITHUB_URL, NAV_LINKS } from "../content";
import { ExternalLink } from "./external-link";

export function Navigation() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-4 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] px-4">
      <div className="flex items-center gap-4 rounded-pill border border-rule bg-paper/70 px-4 py-2.5 backdrop-blur-xl sm:gap-6 sm:px-5">
        <a href="#top" className="whitespace-nowrap font-display text-base font-semibold text-ink">
          ReToken<span className="text-accent">D</span>
        </a>

        <nav className="hidden items-center gap-5 text-sm text-ink-2 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="whitespace-nowrap hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>

        <ExternalLink
          href={GITHUB_URL}
          className="ml-auto hidden items-center gap-1 whitespace-nowrap rounded-pill border border-rule px-3 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent sm:inline-flex"
        >
          GitHub
        </ExternalLink>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="nav-menu"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-pill border border-rule text-ink md:hidden"
        >
          <span className="sr-only">Menu</span>
          <span aria-hidden="true" className="text-lg leading-none">
            {open ? "×" : "☰"}
          </span>
        </button>
      </div>

      {open ? (
        <div
          id="nav-menu"
          className="mt-2 flex flex-col gap-1 rounded-card border border-rule bg-paper/95 p-3 backdrop-blur-xl md:hidden"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-[calc(var(--radius-card)-0.5rem)] px-3 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          <ExternalLink
            href={GITHUB_URL}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-1 rounded-[calc(var(--radius-card)-0.5rem)] px-3 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink"
          >
            GitHub
          </ExternalLink>
        </div>
      ) : null}
    </header>
  );
}
