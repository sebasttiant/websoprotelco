import { removeRecordedFiles } from "./created-files";
import { E2E_ENVIRONMENT_VARIABLES } from "./environment";

// Safety net for a run that crashed before a test could clean up its own uploads. The database
// itself needs no teardown here: it is a tmpfs container that run-authenticated.ts destroys.
export default function globalTeardown(): void {
  const runId = process.env[E2E_ENVIRONMENT_VARIABLES.RUN_ID];

  if (runId) {
    removeRecordedFiles(runId);
  }
}
