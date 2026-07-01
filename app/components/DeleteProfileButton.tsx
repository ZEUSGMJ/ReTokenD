"use client";

import { Button } from "@/components/ui/button";
import { deleteProfile } from "@/app/actions";

export function DeleteProfileButton({ profile }: { profile: string }) {
  return (
    <form
      action={deleteProfile}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete profile "${profile}"? This permanently removes its token and settings.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="profile" value={profile} />
      <Button type="submit" variant="outline" size="sm" className="text-destructive">
        Delete
      </Button>
    </form>
  );
}
