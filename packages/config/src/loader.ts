import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Chain, AppLogger, MonitoringGroup } from '@w3f/polguard-common';
import { ConfigProcessor } from './config-processor';

type MonitoringSnapshot = {
  groups: MonitoringGroup[];
  byChain: Map<Chain, MonitoringGroup[]>;
  fingerprint: string;
};

export interface MonitoringGroupsResult {
  groups: MonitoringGroup[];
  fingerprint: string;
}

// ============================================================================
// MODULE STATE
let cachedSnapshot: MonitoringSnapshot | null = null;
let loadPromise: Promise<MonitoringSnapshot> | null = null;

// ============================================================================
// PUBLIC API
export async function getMonitoringGroups(
  chain: Chain,
  dir: string,
  logger: AppLogger,
): Promise<MonitoringGroupsResult> {
  const snapshot = await loadSnapshot(dir, logger);
  return {
    groups: (snapshot.byChain.get(chain) || []).filter(group => group.monitors.length > 0),
    fingerprint: snapshot.fingerprint,
  };
}

// ============================================================================
// SNAPSHOT LOADING & CACHING
export async function loadSnapshot(dir: string, logger: AppLogger): Promise<MonitoringSnapshot> {
  // Coalesce concurrent loads
  if (loadPromise) {
    return loadPromise;
  }

  // Always check fingerprint if we have a cached snapshot
  if (cachedSnapshot) {
    try {
      const currentFingerprint = await computeFingerprint(dir);
      if (currentFingerprint === cachedSnapshot.fingerprint) {
        // No changes, return cached snapshot silently
        return cachedSnapshot;
      }
      // Fingerprint changed, proceed to reload
    } catch (error) {
      // If fingerprint check fails, try to reload. If reload fails, we'll use stale.
      logger.warn(`Fingerprint check failed: ${error.message}`);
    }
  }

  loadPromise = doLoad(dir, logger);
  try {
    const snapshot = await loadPromise;
    cachedSnapshot = snapshot;
    return snapshot;
  } finally {
    loadPromise = null;
  }
}

async function doLoad(dir: string, logger: AppLogger): Promise<MonitoringSnapshot> {
  try {
    // Validate directory is provided
    if (!dir) {
      throw new Error('Monitoring configs directory must be configured in service config');
    }

    // Validate directory exists
    if (!fs.existsSync(dir)) {
      throw new Error(
        `Config directory does not exist: ${dir}\n` +
          `For local development, ensure the directory exists or update the service config.\n` +
          `For Docker/K8s deployments, ensure the volume is mounted correctly.`,
      );
    }

    const fingerprint = await computeFingerprint(dir);
    const configFiles = findConfigFiles(dir);

    if (configFiles.length === 0) {
      throw new Error(`No config files found in ${dir}\n` + `Make sure the directory contains .yaml or .yml files.`);
    }

    const groups = ConfigProcessor.processConfigs(configFiles);
    const snapshot = buildSnapshot(groups, fingerprint);

    if (!cachedSnapshot) {
      logConfigLoad(snapshot, logger);
    } else if (cachedSnapshot.fingerprint !== fingerprint) {
      logConfigUpdate(cachedSnapshot, snapshot, logger);
    }

    return snapshot;
  } catch (error) {
    if (cachedSnapshot) {
      logger.warn(`Failed to refresh config, serving stale snapshot: ${error.message}`);
      return cachedSnapshot;
    }

    logger.error(`Failed to load config with no fallback available: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// FINGERPRINT COMPUTATION
async function computeFingerprint(dir: string): Promise<string> {
  const configFiles = findConfigFiles(dir);
  const hashes = configFiles
    .sort()
    .map(file => {
      const content = fs.readFileSync(file);
      return crypto.createHash('sha256').update(file).update(content).digest('hex');
    })
    .join('');

  return crypto.createHash('sha256').update(hashes).digest('hex');
}

function findConfigFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  let configFiles: string[] = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (file.startsWith('.')) {
      continue;
    }

    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      configFiles = configFiles.concat(findConfigFiles(filePath));
    } else if (stat.isFile() && (file.endsWith('.yaml') || file.endsWith('.yml'))) {
      configFiles.push(filePath);
    }
  }

  return configFiles;
}

// ============================================================================
// SNAPSHOT BUILDING
function buildSnapshot(groups: MonitoringGroup[], fingerprint: string): MonitoringSnapshot {
  const byChain = new Map<Chain, MonitoringGroup[]>();

  for (const group of groups) {
    if (!byChain.has(group.chain)) {
      byChain.set(group.chain, []);
    }
    byChain.get(group.chain)!.push(group);
  }

  return {
    groups,
    byChain,
    fingerprint,
  };
}

// ============================================================================
// LOGGING
function logConfigLoad(snapshot: MonitoringSnapshot, logger: AppLogger): void {
  const monitoringGroups = snapshot.groups.filter(g => g.monitors.length > 0);
  if (monitoringGroups.length === 0) return;

  const totalAccounts = new Set(monitoringGroups.flatMap(g => g.accounts.map(a => a.ss58))).size;

  logger.info(
    `Loaded monitoring config: fingerprint=${snapshot.fingerprint.substring(0, 8)}, groups=${monitoringGroups.length}, accounts=${totalAccounts}`,
  );

  for (const group of monitoringGroups) {
    const monitors = group.monitors.map(m => m.name).join(', ');
    const handlers = group.monitors.flatMap(m => (m.settings as any)?.handlers || []).join(', ');

    logger.debug(
      `Group details: ${group.id} (${group.chain}): ${group.accounts.length} account(s), monitors=[${monitors}], handlers=[${handlers}]`,
    );
  }
}

function logConfigUpdate(
  oldSnapshot: MonitoringSnapshot,
  newSnapshot: MonitoringSnapshot,
  logger: AppLogger,
): void {
  logger.info(
    `Config updated: fingerprint changed ${oldSnapshot.fingerprint.substring(0, 8)} -> ${newSnapshot.fingerprint.substring(0, 8)}`,
  );

  logConfigLoad(newSnapshot, logger);
}
