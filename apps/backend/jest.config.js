const { loadEnv } = require("@medusajs/utils");
loadEnv("test", process.cwd());

module.exports = {
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
  },
  setupFiles: ["./integration-tests/setup.js"],
};

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"];
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"];
} else if (process.env.TEST_TYPE === "unit") {
  // Unit tests stay pure: `*.integration.test.ts` boots modules against a real
  // PostgreSQL database made by @medusajs/test-utils, so it only runs under
  // `test:integration:modules`.
  module.exports.testMatch = ["**/src/**/__tests__/**/*.[jt]s"];
  module.exports.testPathIgnorePatterns = ["/node_modules/", "\\.integration\\.test\\.[jt]s$"];
}
