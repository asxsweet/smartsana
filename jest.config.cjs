module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: ["backend/server/src/**/*.js"],
};
