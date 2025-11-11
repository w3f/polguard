#!/usr/bin/env node

/**
 * Monitoring Config Fetcher
 * 
 * Fetches monitoring configuration files from remote sources and manages them
 * in a staging directory structure with versioning and cleanup.
 * 
 * Environment Variables:
 * - SOURCES: JSON array of config sources [{name, url, token?}]
 * - MONITORING_DEFAULT_TOKEN: Optional default auth token
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const STAGING_BASE = '/app/monitoring-configs/.staging';
const CURRENT_LINK = '/app/monitoring-configs/current';
const DEFAULT_TOKEN = process.env.MONITORING_DEFAULT_TOKEN || '';

/**
 * Gets current timestamp in format: YYYY-MM-DD-HH-MM-SS
 */
function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('-');
}

/**
 * Fetches a single config source
 */
async function fetchSource(source, targetDir) {
  const { name, url, token } = source;
  const authToken = token || DEFAULT_TOKEN;
  
  console.log(`Fetching config: ${name}`);
  console.log(`  URL: ${url}`);
  console.log(`  Auth: ${authToken ? 'Using token' : 'None'}`);
  
  const headers = {};
  if (authToken) {
    headers['PRIVATE-TOKEN'] = authToken;
  }
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    const filePath = path.join(targetDir, `${name}.yaml`);
    
    fs.writeFileSync(filePath, content, 'utf8');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Failed to write file: ${filePath}`);
    }
    
    console.log('  Downloaded successfully');
    return true;
  } catch (error) {
    console.error(`ERROR: Failed to fetch ${name}`);
    console.error(`  ${error.message}`);
    throw error;
  }
}

/**
 * Computes SHA256 checksum of all YAML files in directory
 */
function computeChecksum(targetDir) {
  const files = fs.readdirSync(targetDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();
  
  if (files.length === 0) {
    throw new Error('No YAML files found to compute checksum');
  }
  
  const hash = crypto.createHash('sha256');
  
  for (const file of files) {
    const filePath = path.join(targetDir, file);
    const fileHash = crypto.createHash('sha256');
    fileHash.update(fs.readFileSync(filePath));
    hash.update(fileHash.digest('hex'));
  }
  
  return hash.digest('hex');
}

/**
 * Updates the 'current' symlink to point to the new directory
 */
function updateSymlink(targetDir) {
  const tmpLink = `${CURRENT_LINK}.tmp`;
  
  // Create temporary symlink
  if (fs.existsSync(tmpLink)) {
    fs.unlinkSync(tmpLink);
  }
  fs.symlinkSync(targetDir, tmpLink);
  
  // Atomically replace the current symlink
  fs.renameSync(tmpLink, CURRENT_LINK);
  
  console.log(`Successfully updated current -> ${path.basename(targetDir)}`);
}

/**
 * Cleans up old staging directories, keeping only the last N
 */
function cleanupOldDirectories(keepCount = 5) {
  if (!fs.existsSync(STAGING_BASE)) {
    return;
  }
  
  const dirs = fs.readdirSync(STAGING_BASE)
    .filter(name => {
      const fullPath = path.join(STAGING_BASE, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort()
    .reverse(); // Most recent first
  
  const toDelete = dirs.slice(keepCount);
  
  if (toDelete.length === 0) {
    console.log('No old directories to clean up');
    return;
  }
  
  console.log(`Cleaning up ${toDelete.length} old staging directories...`);
  
  for (const dir of toDelete) {
    const fullPath = path.join(STAGING_BASE, dir);
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Warning: Failed to delete ${dir}: ${error.message}`);
    }
  }
  
  console.log('Cleanup completed');
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Monitoring Config Fetcher ===');
  
  const timestamp = getTimestamp();
  const targetDir = path.join(STAGING_BASE, timestamp);
  
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Target directory: ${targetDir}`);
  
  // Parse and validate sources
  const sourcesJson = process.env.SOURCES;
  if (!sourcesJson) {
    console.error('ERROR: SOURCES environment variable is not set');
    process.exit(1);
  }
  
  let sources;
  try {
    sources = JSON.parse(sourcesJson);
  } catch (error) {
    console.error('ERROR: Failed to parse SOURCES JSON');
    console.error(`  ${error.message}`);
    process.exit(1);
  }
  
  if (!Array.isArray(sources) || sources.length === 0) {
    console.error('ERROR: SOURCES must be a non-empty array');
    process.exit(1);
  }
  
  // Create staging directory
  fs.mkdirSync(targetDir, { recursive: true });
  
  console.log(`\nFetching ${sources.length} configuration source(s)...\n`);
  
  for (const source of sources) {
    await fetchSource(source, targetDir);
  }
  
  const yamlFiles = fs.readdirSync(targetDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  if (yamlFiles.length === 0) {
    console.error('ERROR: No configuration files were fetched');
    process.exit(1);
  }
  
  console.log('\nComputing checksum...');
  const checksum = computeChecksum(targetDir);
  fs.writeFileSync(path.join(targetDir, '.checksum'), checksum, 'utf8');
  console.log(`Checksum: ${checksum}`);
  
  console.log('\nUpdating current symlink...');
  updateSymlink(targetDir);
  
  console.log('\nCleaning up old staging directories...');
  cleanupOldDirectories(5);
  
  console.log('\n=== Config fetch completed successfully ===');
}

main().catch(error => {
  console.error('\n=== FATAL ERROR ===');
  console.error(error);
  process.exit(1);
});
