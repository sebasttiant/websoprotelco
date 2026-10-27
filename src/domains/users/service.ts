import { hashPassword, verifyPassword } from "@/server/auth/password";

import * as repository from "./repository";
import type { AccountRow, AdminUserRow, ProfileRow } from "./repository";
import type {
  AccountOverview,
  AdminCreateUserInput,
  AdminDeleteUserInput,
  AdminUpdateUserInput,
  AdminUserSummary,
  PasswordChangeInput,
  ProfileDetails,
  ProfileUpdateInput,
} from "./schemas";

export type PasswordChangeOutcome = "updated" | "invalid-current-password";

export type CreateUserOutcome = { status: "created"; id: string } | { status: "email-taken" };

export type UpdateUserOutcome =
  | { status: "updated" }
  | { status: "not-found" }
  | { status: "email-taken" }
  | { status: "forbidden-self" }
  | { status: "forbidden-last-admin" };

export type DeleteUserOutcome =
  | { status: "deleted" }
  | { status: "not-found" }
  | { status: "forbidden-self" }
  | { status: "forbidden-last-admin" };

function mapAdminUserSummary(row: AdminUserRow): AdminUserSummary {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function mapAccountOverview(row: AccountRow): AccountOverview {
  return {
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

function mapProfileDetails(row: ProfileRow): ProfileDetails {
  return {
    email: row.email,
    fullName: row.full_name,
  };
}

export async function getUsersForAdmin(): Promise<AdminUserSummary[]> {
  const rows = await repository.findAllUsersForAdmin();
  return rows.map(mapAdminUserSummary);
}

// Creates a user with an admin-chosen role. The password is hashed here; the plaintext never
  // leaves this call. A taken email returns "email-taken" rather than throwing, so the modal can
  // report it inline instead of the caller seeing a 500.
export async function createUser(input: AdminCreateUserInput): Promise<CreateUserOutcome> {
  const passwordHash = await hashPassword(input.password);

  const id = await repository.insertAdminUser({
    fullName: input.fullName,
    email: input.email,
    passwordHash,
    role: input.role,
  });

  return id ? { status: "created", id } : { status: "email-taken" };
}

/**
 * Admin directory update. `actorUserId` is the signed-in admin performing the change.
 * Refuses to lock the actor out of their own account, and refuses to leave the system
 * without at least one active admin.
 */
export async function updateUser(
  actorUserId: string,
  input: AdminUpdateUserInput,
): Promise<UpdateUserOutcome> {
  const existing = await repository.findAdminUserById(input.id);
  if (!existing) return { status: "not-found" };

  const demotingOrDisablingAdmin =
    existing.role === "admin" &&
    existing.is_active &&
    (input.role !== "admin" || !input.isActive);

  if (input.id === actorUserId && (input.role !== "admin" || !input.isActive)) {
    return { status: "forbidden-self" };
  }

  if (demotingOrDisablingAdmin) {
    const activeAdmins = await repository.countActiveAdmins();
    if (activeAdmins <= 1) return { status: "forbidden-last-admin" };
  }

  if (await repository.emailTakenByOtherUser(input.email, input.id)) {
    return { status: "email-taken" };
  }

  const password = input.password?.trim() ?? "";
  const passwordHash = password.length > 0 ? await hashPassword(password) : undefined;

  const updated = await repository.updateAdminUser({
    id: input.id,
    fullName: input.fullName,
    email: input.email,
    role: input.role,
    isActive: input.isActive,
    passwordHash,
  });

  return updated ? { status: "updated" } : { status: "not-found" };
}

/** Hard delete. Same self / last-admin guards as update. */
export async function deleteUser(
  actorUserId: string,
  input: AdminDeleteUserInput,
): Promise<DeleteUserOutcome> {
  if (input.id === actorUserId) return { status: "forbidden-self" };

  const existing = await repository.findAdminUserById(input.id);
  if (!existing) return { status: "not-found" };

  if (existing.role === "admin" && existing.is_active) {
    const activeAdmins = await repository.countActiveAdmins();
    if (activeAdmins <= 1) return { status: "forbidden-last-admin" };
  }

  const deleted = await repository.deleteAdminUser(input.id);
  return deleted ? { status: "deleted" } : { status: "not-found" };
}

// Scoped read: returns the account for exactly the id it is given. Callers must
// pass the session user's own id so a customer can only ever see their own data.
export async function getAccountOverview(userId: string): Promise<AccountOverview | null> {
  const row = await repository.findAccountById(userId);
  return row ? mapAccountOverview(row) : null;
}

// Scoped read: same ownership contract as getAccountOverview.
export async function getProfileDetails(userId: string): Promise<ProfileDetails | null> {
  const row = await repository.findProfileById(userId);
  return row ? mapProfileDetails(row) : null;
}

export async function updateProfile(userId: string, input: ProfileUpdateInput): Promise<void> {
  await repository.updateProfileById(userId, input.name);
}

// Re-verifies the caller's current password before writing a new hash. If the
// current password is wrong, this returns "invalid-current-password" and NO new
// hash is written.
export async function changePassword(userId: string, input: PasswordChangeInput): Promise<PasswordChangeOutcome> {
  const storedHash = await repository.findPasswordHashById(userId);

  if (!storedHash || !(await verifyPassword(input.currentPassword, storedHash))) {
    return "invalid-current-password";
  }

  const newHash = await hashPassword(input.newPassword);
  await repository.updatePasswordHashById(userId, newHash);

  return "updated";
}
