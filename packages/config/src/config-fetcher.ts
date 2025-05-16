import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { MonitoringGroup } from '@w3f/monitoring-types';
import { ConfigProcessor } from './config-processor';

export interface ConfigSource {
  name: string;
  url: string;
  authToken?: string;
}

/**
 * Handles fetching and processing of monitoring configuration files.
 *
 * This class provides functionality to:
 * 1. Fetch configuration files from remote sources
 * 2. Manage local configuration files
 * 3. Process configurations into monitoring groups
 *
 * Example usage:
 * ```typescript
 * const sources = [
 *   { name: 'main', url: 'https://gitlab.com/config.yaml', authToken: 'token' }
 * ];
 * const targetDir = './monitoring-configs';
 *
 * // Fetch and process configs
 * const groups = await ConfigFetcher.fetchAndProcessConfigs(sources, targetDir);
 * ```
 */
export class ConfigFetcher {
  /**
   * Fetches configuration files from remote sources and processes them into monitoring groups.
   * This method combines fetching and processing operations in one convenient call.
   *
   * @param sources Array of configuration sources
   * @param targetDir Directory where configuration files will be saved
   * @returns Array of processed monitoring groups
   * @throws Error if configuration fetch or processing fails
   */
  static async fetchAndProcessConfigs(sources: ConfigSource[], targetDir: string): Promise<MonitoringGroup[]> {
    await this.fetchConfigs(sources, targetDir);
    const configFiles = this.findConfigFiles(targetDir);
    return ConfigProcessor.processConfigs(configFiles);
  }

  /**
   * Fetches configuration files from remote sources and saves them locally.
   * @param sources Array of configuration sources
   * @param targetDir Directory where configuration files will be saved
   * @throws Error if configuration fetch fails
   * @internal Use fetchAndProcessConfigs for complete workflow
   */
  static async fetchConfigs(sources: ConfigSource[], targetDir: string): Promise<void> {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const source of sources) {
      const headers: Record<string, string> = {};
      if (source.authToken) {
        headers['PRIVATE-TOKEN'] = source.authToken;
      }

      try {
        const response = await axios.get(source.url, { headers });
        const fileName = `${source.name}.yaml`;
        const filePath = path.join(targetDir, fileName);
        fs.writeFileSync(filePath, response.data);
      } catch (error) {
        // Handle Axios errors
        if (error.response) {
          const maskedToken = source.authToken
            ? source.authToken.substring(0, 1) + '*'.repeat(source.authToken.length - 1)
            : 'none';
          throw new Error(
            `Received non-normal status code ${error.response.status} from ${source.url} (authToken: ${maskedToken})`,
          );
        }
        // Re-throw other errors
        throw error;
      }
    }
  }

  /**
   * Finds all YAML configuration files in the specified directory and its subdirectories.
   * @param dir Directory to search for configuration files
   * @returns Array of file paths
   */
  static findConfigFiles(dir: string): string[] {
    let configFiles: string[] = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        configFiles = configFiles.concat(this.findConfigFiles(filePath));
      } else if (stat.isFile() && (file.endsWith('.yaml') || file.endsWith('.yml'))) {
        configFiles.push(filePath);
      }
    }
    return configFiles;
  }
}
