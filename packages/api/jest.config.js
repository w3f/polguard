module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.test\\.ts$",
  transform: {
    "^.+\\.ts$": ["@swc/jest", {
      jsc: {
        parser: {
          syntax: "typescript",
          decorators: true,
          tsx: false
        },
        target: "es2021",
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true
        }
      }
    }]
  },
  collectCoverageFrom: [
    "**/*.(t|j)s"
  ],
  coverageDirectory: "./coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    '^@w3f/monitoring-types$': '<rootDir>/../types/src'
  },
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
    "/node_modules/",
    "/dist/"
  ]
}
