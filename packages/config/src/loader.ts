import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Chain, Logger, MessengerType, MonitoringGroup } from '@w3f/monitoring-common';
import { ConfigProcessor } from './config-processor';

type MonitoringSnapshot = {
  groups: MonitoringGroup[];
  byChain: Map<Chain, MonitoringGroup[]>;
  channelIndex: Map<string, Array<{ chain: Chain; groupId: string }>>;
  fingerprint: string;
};

// ============================================================================
// MODULE STATE
let cachedSnapshot: MonitoringSnapshot | null = null;
let loadPromise: Promise<MonitoringSnapshot> | null = null;

const CHECKSUM_FILE = '.checksum';

// ============================================================================
// PUBLIC API
export async function getMonitoringGroups(chain: Chain, dir: string, logger: Logger): Promise<MonitoringGroup[]> {
  const snapshot = await loadSnapshot(chain, dir, logger);
  return snapshot.byChain.get(chain) || [];
}

export async function getGroupsForChannel(
  chain: Chain,
  messengerType: MessengerType,
  channelId: string,
  dir: string,
  logger: Logger,
): Promise<MonitoringGroup[]> {
  const snapshot = await loadSnapshot(chain, dir, logger);
  const key = `${messengerType}:${channelId}`;
  const chainGroups = snapshot.channelIndex.get(key) || [];

  const groupIds = chainGroups.filter(cg => cg.chain === chain).map(cg => cg.groupId);

  return snapshot.groups.filter(g => g.chain === chain && groupIds.includes(g.id));
}

// ============================================================================
// SNAPSHOT LOADING & CACHING
async function loadSnapshot(chain: Chain, dir: string, logger: Logger): Promise<MonitoringSnapshot> {
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

  loadPromise = doLoad(chain, dir, logger);
  try {
    const snapshot = await loadPromise;
    cachedSnapshot = snapshot;
    return snapshot;
  } finally {
    loadPromise = null;
  }
}

async function doLoad(chain: Chain, dir: string, logger: Logger): Promise<MonitoringSnapshot> {
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
      logInitialLoad(snapshot, chain, logger);
    } else if (cachedSnapshot.fingerprint !== fingerprint) {
      logConfigUpdate(cachedSnapshot, snapshot, chain, logger);
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
  const checksumPath = path.join(dir, CHECKSUM_FILE);

  // Try to read pre-computed checksum first (from CronJob)
  if (fs.existsSync(checksumPath)) {
    return fs.readFileSync(checksumPath, 'utf8').trim();
  }

  // Fall back to computing it ourselves
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
  const channelIndex = new Map<string, Array<{ chain: Chain; groupId: string }>>();

  for (const group of groups) {
    // Index by chain
    if (!byChain.has(group.chain)) {
      byChain.set(group.chain, []);
    }
    byChain.get(group.chain)!.push(group);

    // Index by channel (without chain in key)
    for (const channelId of group.notifications.channels) {
      const key = `${group.notifications.messengerType}:${channelId}`;
      if (!channelIndex.has(key)) {
        channelIndex.set(key, []);
      }
      channelIndex.get(key)!.push({ chain: group.chain, groupId: group.id });
    }
  }

  return {
    groups,
    byChain,
    channelIndex,
    fingerprint,
  };
}

// ============================================================================
// LOGGING
function logConfigLoad(snapshot: MonitoringSnapshot, chain: Chain, logger: Logger): void {
  const groups = snapshot.byChain.get(chain);
  if (!groups || groups.length === 0) return;

  const totalAccounts = new Set(groups.flatMap(g => g.accounts.map(a => a.ss58))).size;

  logger.log(
    `Loaded monitoring config for ${chain}: fingerprint=${snapshot.fingerprint.substring(0, 8)}, groups=${groups.length}, accounts=${totalAccounts}`,
  );

  for (const group of groups) {
    const monitors = group.monitors.map(m => m.name).join(', ');
    const handlers = group.monitors.flatMap(m => (m.settings as any)?.handlers || []).join(', ');

    logger.debug(
      `Group details: ${group.id}: ${group.accounts.length} account(s), monitors=[${monitors}], handlers=[${handlers}]`,
    );
  }
}

function logInitialLoad(snapshot: MonitoringSnapshot, chain: Chain, logger: Logger): void {
  logConfigLoad(snapshot, chain, logger);
}

function logConfigUpdate(
  oldSnapshot: MonitoringSnapshot,
  newSnapshot: MonitoringSnapshot,
  chain: Chain,
  logger: Logger,
): void {
  logger.log(
    `Config updated for ${chain}: fingerprint changed ${oldSnapshot.fingerprint.substring(0, 8)} -> ${newSnapshot.fingerprint.substring(0, 8)}`,
  );

  logConfigLoad(newSnapshot, chain, logger);
}
