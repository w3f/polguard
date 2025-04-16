# Package Publishing Guide

## Overview

This project contains both public and private packages:

Public packages:
- `@w3f/monitoring-types`
- `@w3f/monitoring-config`

Private packages:
- `@w3f/monitoring-api`
- `@w3f/monitoring-chain`
- `@w3f/monitoring-telemetry`
- `@w3f/monitoring-matrix`

## Publishing Workflow

### 1. NPM Authentication

Before publishing, make sure you're authenticated with npm:

```bash
# Login to npm with yarn (not with npm login directly)
yarn npm login

# Verify you're logged in
yarn npm whoami

# If you're using 2FA, you'll need to provide an OTP when publishing
```

### 2. Building and Testing

Before publishing, ensure all tests pass and packages build correctly:

```bash
# Build all packages
yarn build:all

# Run all tests
yarn test:all

# Test specific packages
yarn test:config
```

### 3. Version Management

We use semantic versioning for our public packages. To update versions:

```bash
# Update types package version (patch, minor, or major)
yarn version:types patch

# Update config package version
yarn version:config patch
```

### 4. Publishing Process

Public packages must be published in the correct order due to dependencies:

```bash
# 1. Build and publish types
yarn build:types
yarn publish:types

# 2. Build and publish config
yarn build:config
yarn publish:config
```