"use client";

import { Button } from "@/components/ui/button";
import { saveScopes } from "@/app/actions";
import type { ScopeGroup } from "@/lib/spotify";

export function ScopeSettings({
  catalog,
  selected,
  profile,
}: {
  catalog: ScopeGroup[];
  selected: string[];
  profile: string;
}) {
  const selectedSet = new Set(selected);

  return (
    <form action={saveScopes} className="flex flex-col gap-5">
      <input type="hidden" name="profile" value={profile} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {catalog.map((group) => (
          <fieldset key={group.group} className="flex flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.group}
            </legend>
            {group.scopes.map((scope) => (
              <label
                key={scope.id}
                className="flex items-start gap-2 text-sm leading-tight"
              >
                <input
                  type="checkbox"
                  name="scopes"
                  value={scope.id}
                  defaultChecked={selectedSet.has(scope.id)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="font-medium">{scope.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {scope.id}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Changes apply the next time you Re-authorize. Unchecking everything requests no scopes.
        </p>
        <Button type="submit" size="sm">
          Save scopes
        </Button>
      </div>
    </form>
  );
}
