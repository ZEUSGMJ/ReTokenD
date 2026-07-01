"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createProfile, type CreateProfileState } from "@/app/actions";

const initialState: CreateProfileState = {};

export function AddProfileForm() {
  const [state, action, pending] = useActionState(createProfile, initialState);

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          name="profileId"
          placeholder="e.g. portfolio"
          pattern="[a-z0-9\-]{1,32}"
          required
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="sm" disabled={pending}>
          Create
        </Button>
      </div>
      {state.error === "invalid_profile" ? (
        <p className="text-xs text-destructive">
          Invalid profile id. Use lowercase letters, numbers, and hyphens (max 32 characters).
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens. Authorize it with Spotify after creating.
        </p>
      )}
    </form>
  );
}
