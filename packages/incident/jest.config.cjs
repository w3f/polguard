module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.test\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["@swc/jest", {
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: false
        },
        target: "es2021"
      }
    }]
  },
  collectCoverageFrom: [
    "**/*.(t|j)s"
  ],
  coverageDirectory: "./coverage",
  testEnvironment: "node",
  moduleNameMapper: {},
  roots: [
    "<rootDir>/src",
    "<rootDir>/tests"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/tests/integration/"
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/dist/"
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!@w3f/polguard-)"
  ]
}
