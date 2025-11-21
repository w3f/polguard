# Package Publishing Guide

This project contains both public and private packages:

**Public packages**:
- `@w3f/polguard-common`: Common types, interfaces, constants and utilities
- `@w3f/polguard-config`: Configuration processing and validation

**Private packages**:
- `@w3f/polguard-incident`: Central control service
- `@w3f/polguard-chain`: Blockchain monitoring service
- `@w3f/polguard-matrix`: Matrix notification service

## Publishing Workflow

### 1. NPM Authentication

Before publishing, make sure you're authenticated with npm:

```bash
yarn npm login
yarn npm whoami
```

### 2. Building and Testing

Before publishing, ensure all tests pass and packages build correctly:

```bash
yarn build
yarn test
```

### 3. Version Management

We use semantic versioning for our public packages. To update versions:

```bash
# Update package version (patch, minor, or major)
yarn version patch
```

### 4. Publishing Process

Public packages must be published in the correct order due to dependencies: types, then config.

```bash
yarn build
yarn npm publish
```
