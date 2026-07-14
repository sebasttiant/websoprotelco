// Public surface of the users domain. Consumers (admin users page, account pages,
// components) must import from here rather than reaching into ./schemas, ./repository,
// ./service, or ./actions directly.

export type {
  AccountOverview,
  AdminUserSummary,
  PasswordChangeInput,
  ProfileDetails,
  ProfileUpdateInput,
} from "./schemas";

export { getAccountOverview, getProfileDetails, getUsersForAdmin } from "./service";

export { changePassword, updateProfile, type AccountActionState } from "./actions";
