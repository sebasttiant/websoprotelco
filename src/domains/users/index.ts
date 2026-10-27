// Public surface of the users domain. Consumers (admin users page, account pages,
// components) must import from here rather than reaching into ./schemas, ./repository,
// ./service, or ./actions directly.

export type {
  AccountOverview,
  AdminCreateUserInput,
  AdminDeleteUserInput,
  AdminUpdateUserInput,
  AdminUserSummary,
  AssignableRole,
  PasswordChangeInput,
  ProfileDetails,
  ProfileUpdateInput,
} from "./schemas";

export { assignableRoleSchema } from "./schemas";

export {
  createUser,
  deleteUser,
  getAccountOverview,
  getProfileDetails,
  getUsersForAdmin,
  updateUser,
} from "./service";

export {
  changePassword,
  createUser as createUserAction,
  deleteUser as deleteUserAction,
  updateProfile,
  updateUser as updateUserAction,
  type AccountActionState,
  type CreateUserActionState,
  type ManageUserActionState,
} from "./actions";
