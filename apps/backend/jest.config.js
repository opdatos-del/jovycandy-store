const {
  assertLocalIntegrationEnvironment,
  assertTestType,
} = require("./integration-tests/ephemeral-postgres.cjs");

const testType = assertTestType(process.env.TEST_TYPE);
const isIntegration = testType.startsWith("integration:");
const launcherConnection = {};

if (isIntegration) {
  assertLocalIntegrationEnvironment(process.env);
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("DB_") || key.startsWith("PG") || key.startsWith("DATABASE_") || key.startsWith("JOVY_EPHEMERAL_POSTGRES_")) {
      launcherConnection[key] = value;
    }
  }
}

const { loadEnv } = require("@medusajs/utils");
loadEnv("test", process.cwd());

if (isIntegration) {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("DB_") || key.startsWith("PG") || key.startsWith("DATABASE_") || key.startsWith("JOVY_EPHEMERAL_POSTGRES_")) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, launcherConnection);
  assertLocalIntegrationEnvironment(process.env);
}

module.exports = {
  preset: "@medusajs/test-utils",
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  moduleNameMapper: {
    "^@jovy/(.*)$": "<rootDir>/src/$1",
    "^@admin/(.*)$": "<rootDir>/src/admin/$1",
  },
  setupFiles: ["./integration-tests/setup.js"],
};

if (isIntegration) {
  module.exports.globalSetup = "./integration-tests/verify-integration-postgres.cjs";
}

if (testType === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"];
} else if (testType === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"];
} else {
  // Unit tests stay pure: `*.integration.test.ts` boots modules against a real
  // PostgreSQL database made by @medusajs/test-utils, so it only runs under
  // `test:integration:modules`.
  module.exports.testMatch = ["**/src/**/__tests__/**/*.[jt]s"];
  module.exports.testPathIgnorePatterns = ["/node_modules/", "\\.integration\\.test\\.[jt]s$"];
}
