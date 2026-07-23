export const ROLES = ["admin", "staff", "customer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "admin:access",
  "catalog:read",
  "catalog:write",
  "quote:read",
  "quote:write",
  "settings:read",
  "settings:write",
  "leads:read",
  "leads:write",
  "inventory:read",
  "inventory:write",
  "documents:read",
  "documents:write",
  "design:read",
  "design:write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_SET: ReadonlySet<string> = new Set(ROLES);

const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  admin: PERMISSIONS,
  staff: [
    "catalog:read",
    "quote:read",
    "quote:write",
    "leads:read",
    "leads:write",
    "inventory:read",
    "inventory:write",
    "documents:read",
    "documents:write",
  ],
  customer: [],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_SET.has(value);
}

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  // `role` is typed `Role` but callers can still smuggle an invalid runtime value through
  // an `as Role` cast, so the guard is re-checked here to keep this fail-closed at runtime.
  if (!isRole(role)) {
    return false;
  }

  return permissionsForRole(role).includes(permission);
}
