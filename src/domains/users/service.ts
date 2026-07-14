import { hashPassword, verifyPassword } from "@/server/auth/password";

import * as repository from "./repository";
import type { AccountRow, AdminUserRow, ProfileRow } from "./repository";
import type {
  AccountOverview,
  AdminUserSummary,
  PasswordChangeInput,
  ProfileDetails,
  ProfileUpdateInput,
} from "./schemas";

export type PasswordChangeOutcome = "updated" | "invalid-current-password";

function mapAdminUserSummary(row: AdminUserRow): AdminUserSummary {
  return {
    id: row.id,
    email: row.email,
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
