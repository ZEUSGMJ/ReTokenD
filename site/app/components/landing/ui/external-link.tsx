import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";

type ExternalLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
  children: ReactNode;
  // Trailing external-link glyph; omit for inline text links.
  icon?: boolean;
};

export function ExternalLink({ href, children, icon = true, ...rest }: ExternalLinkProps) {
  return (
    <a {...rest} href={href} target="_blank" rel="noreferrer">
      {children}
      {icon ? <ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
    </a>
  );
}
