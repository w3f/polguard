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
    '^@service/(.*)$': '<rootDir>/src/service/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@w3f/polguard-common$': '<rootDir>/../common/src'
  },
  roots: [
    "<rootDir>/src",
    "<rootDir>/tests"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/"
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/dist/"
  ],
  transformIgnorePatterns: [
    "/node_modules/",
    "/dist/"
  ]
}
