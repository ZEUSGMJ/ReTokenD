import { Badge } from "@/components/ui/badge";
import type { TokenStatus } from "@/lib/lifecycle";

export type { TokenStatus };

export function StatusBadge({ status }: { status: TokenStatus }) {
  switch (status) {
    case "valid":
      return (
        <Badge variant="default" className="bg-green-600 text-white">
          Valid
        </Badge>
      );
    case "expiring-soon":
      return (
        <Badge variant="default" className="bg-amber-500 text-white">
          Expiring soon
        </Badge>
      );
    case "expired-or-reauth-required":
      return <Badge variant="destructive">Reauth required</Badge>;
  }
}
