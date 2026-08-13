export interface SeedUser {
  email: string;
  password: string;
  role: "admin" | "staff";
}

const LOCAL_SEED_ENVIRONMENTS = {
  DEVELOPMENT: "development",
  TEST: "test",
} as const;

export interface SeedEnvironment {
  NODE_ENV?: string;
  ALLOW_LOCAL_SEED_USERS?: string;
  LOCAL_SEED_ADMIN_EMAIL?: string;
  LOCAL_SEED_ADMIN_PASSWORD?: string;
  LOCAL_SEED_STAFF_EMAIL?: string;
  LOCAL_SEED_STAFF_PASSWORD?: string;
}

function requireLocalSeedValue(env: SeedEnvironment, name: keyof SeedEnvironment): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to seed local/test users.`);
  }
  return value;
}

export function getSeedUsers(env: SeedEnvironment = process.env): readonly SeedUser[] {
  const environment = env.NODE_ENV;
  if (environment !== LOCAL_SEED_ENVIRONMENTS.DEVELOPMENT && environment !== LOCAL_SEED_ENVIRONMENTS.TEST) {
    throw new Error("Refusing to seed users outside NODE_ENV=development or NODE_ENV=test.");
  }

  if (environment === LOCAL_SEED_ENVIRONMENTS.DEVELOPMENT && env.ALLOW_LOCAL_SEED_USERS !== "true") {
    throw new Error("Refusing to seed development users without ALLOW_LOCAL_SEED_USERS=true.");
  }

  return [
    {
      email: requireLocalSeedValue(env, "LOCAL_SEED_ADMIN_EMAIL").toLowerCase(),
      password: requireLocalSeedValue(env, "LOCAL_SEED_ADMIN_PASSWORD"),
      role: "admin",
    },
    {
      email: requireLocalSeedValue(env, "LOCAL_SEED_STAFF_EMAIL").toLowerCase(),
      password: requireLocalSeedValue(env, "LOCAL_SEED_STAFF_PASSWORD"),
      role: "staff",
    },
  ];
}
