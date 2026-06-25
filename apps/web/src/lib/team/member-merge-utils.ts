import type { TeamRole } from "@/lib/profile/types";

/** Active membership wins over a stale pending invite row. */
export function mergeMemberStatus(
  a?: "pending" | "active",
  b?: "pending" | "active",
  acceptedAt?: string
): "pending" | "active" {
  if (a === "active" || b === "active") return "active";
  if (acceptedAt) return "active";
  if (a === "pending" || b === "pending") return "pending";
  return "active";
}

/** Only the team owner email may have the owner role. */
export function mergeMemberRole(
  email: string,
  ownerEmail: string | null | undefined,
  role: TeamRole,
  prevRole?: TeamRole
): TeamRole {
  const key = email.trim().toLowerCase();
  const owner = ownerEmail?.trim().toLowerCase();
  if (owner && key === owner) return "owner";

  const picked = role || prevRole || "editor";
  if (picked === "owner") {
    return prevRole && prevRole !== "owner" ? prevRole : "editor";
  }
  return picked;
}
