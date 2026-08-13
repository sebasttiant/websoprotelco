import { getE2eAdminCredentials, seedE2eAdmin } from "./e2e-admin";

seedE2eAdmin(getE2eAdminCredentials()).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
