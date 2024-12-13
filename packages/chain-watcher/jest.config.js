module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.test\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  collectCoverageFrom: [
    "**/*.(t|j)s"
  ],
  coverageDirectory: "../../coverage/core",
  testEnvironment: "node",
  moduleNameMapper: {
    '^@service/(.*)$': '<rootDir>/src/service/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
  },
  roots: [
    "<rootDir>/src",
    "<rootDir>/tests"
  ],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  globals: {
    "ts-jest": {
      "tsconfig": "tsconfig.json"
    }
  }
};