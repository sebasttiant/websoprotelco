// Public surface of the users domain. Consumers (admin users page, account pages,
// components) must import from here rather than reaching into ./schemas, ./repository,
// ./service, or ./actions directly.

export type {
  AccountOverview,
  AdminCreateUserInput,
  AdminUserSummary,
  AssignableRole,
  PasswordChangeInput,
  ProfileDetails,
  ProfileUpdateInput,
} from "./schemas";

export { assignableRoleSchema } from "./schemas";

export { createUser, getAccountOverview, getProfileDetails, getUsersForAdmin } from "./service";

export {
  changePassword,
  createUser as createUserAction,
  updateProfile,
  type AccountActionState,
  type CreateUserActionState,
} from "./actions";
