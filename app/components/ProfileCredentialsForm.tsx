"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  clearProfileCredentials,
  saveProfileCredentials,
  type CredentialsState,
} from "@/app/actions";

const initialState: CredentialsState = {};

const ERROR_TEXT: Record<string, string> = {
  invalid_profile: "Invalid profile.",
  missing_client_id: "Client ID is required.",
  missing_client_secret: "Client secret is required the first time.",
};

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ProfileCredentialsForm({
  profile,
  clientId,
  hasCustomApp,
}: {
  profile: string;
  clientId: string | null;
  hasCustomApp: boolean;
}) {
  const [state, action, pending] = useActionState(saveProfileCredentials, initialState);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {hasCustomApp
          ? "Custom Spotify app configured. Leave the secret blank to keep the current one."
          : "Using the shared app from environment variables. Set a client ID and secret to use a dedicated app for this profile."}
      </p>

      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="profile" value={profile} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Client ID</span>
          <input
            name="clientId"
            defaultValue={clientId ?? ""}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Client Secret</span>
          <input
            name="clientSecret"
            type="password"
            autoComplete="off"
            placeholder={hasCustomApp ? "•••••••• (leave blank to keep current)" : "Client secret"}
            className={inputClass}
          />
        </label>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            Save credentials
          </Button>
          {state.ok && <span className="text-xs text-emerald-500">Saved.</span>}
          {state.error && (
            <span className="text-xs text-destructive">
              {ERROR_TEXT[state.error] ?? "Could not save."}
            </span>
          )}
        </div>
      </form>

      {hasCustomApp && (
        <form action={clearProfileCredentials}>
          <input type="hidden" name="profile" value={profile} />
          <Button type="submit" variant="outline" size="sm">
            Use shared app (clear)
          </Button>
        </form>
      )}
    </div>
  );
}
