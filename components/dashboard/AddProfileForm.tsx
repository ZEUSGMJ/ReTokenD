"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProfile, type CreateProfileState } from "@/app/actions";

const initialState: CreateProfileState = {};

export function AddProfileForm() {
  const [state, action, pending] = useActionState(createProfile, initialState);

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          name="profileId"
          placeholder="e.g. portfolio"
          pattern="[a-z0-9\-]{1,32}"
          required
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={pending}>
          Create
        </Button>
      </div>
      {state.error === "invalid_profile" ? (
        <p className="text-xs text-destructive">
          Profile IDs can only use lowercase letters, numbers, and hyphens, up to 32 characters.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Use lowercase letters, numbers, and hyphens. Connect the profile to Spotify after you
          create it.
        </p>
      )}
    </form>
  );
}
