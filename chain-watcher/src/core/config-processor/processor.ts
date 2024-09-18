import { readdirSync, statSync } from 'fs';
import path from 'path';
import { ConfigValidator } from './validator';
import { ConfigTransformer } from './transformer';
import { MonitoringGroup } from '../interfaces';
import { RawConfig, RawMonitoringGroup } from './interfaces';

export class ConfigProcessor {
  public static process(configsDir: string): MonitoringGroup[] {
    const yamlFiles = this.findConfigFiles(configsDir);
    
    if (yamlFiles.length === 0) {
      throw new Error(`No YAML config files found in ${configsDir}`);
    }

    const rawConfigs = yamlFiles.map(filePath => ConfigValidator.validate(filePath))
    const extractedGroups = this.extractGroupsApplyDefaults(rawConfigs);
    return ConfigTransformer.transformGroups(extractedGroups);
  }

  private static findConfigFiles(dir: string): string[] {
    let configFiles: string[] = [];
    const files = readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        configFiles = configFiles.concat(this.findConfigFiles(filePath));
      } else if (stat.isFile() && (file.endsWith('.yaml') || file.endsWith('.yml'))) {
        configFiles.push(filePath);
      }
    }
    return configFiles;
  }

  private static extractGroupsApplyDefaults(rawConfigs: RawConfig[]): RawMonitoringGroup[] {
    return rawConfigs.flatMap(config => 
      config.groups.map(group => ({
        ...group,
        alerts: group.alerts || config.defaults.alerts
      }))
    );
  }
}
