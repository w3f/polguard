# Package Publishing Guide

## Overview

This project contains both public and private packages:

**Public packages**:
- `@w3f/monitoring-types`: Common types, interfaces, and constants
- `@w3f/monitoring-config`: Configuration processing and validation

**Private packages**:
- `@w3f/monitoring-api`: Central control service
- `@w3f/monitoring-chain`: Blockchain monitoring service
- `@w3f/monitoring-telemetry`: Telemetry monitoring service
- `@w3f/monitoring-matrix`: Matrix notification service

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
yarn build:all
yarn test:all
yarn test:config
```

### 3. Version Management

We use semantic versioning for our public packages. To update versions:

```bash
# Update package version (patch, minor, or major)
yarn version:types patch
yarn version:config patch
```

### 4. Publishing Process

Public packages must be published in the correct order due to dependencies:

```bash
yarn build:types
yarn publish:types

yarn build:config
yarn publish:config
```
