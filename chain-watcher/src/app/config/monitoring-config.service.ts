import { Injectable, Logger } from '@nestjs/common';
import { SimpleGit, simpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import { MonitoringConfigProcessor } from '@core/config/config-processor';
import { MonitoringGroup } from '@core/interfaces';
import { AppConfigService } from './app-config.service';
import { Chain } from '@core/constants';

@Injectable()
export class MonitoringConfigService {
  private monitoringGroups: MonitoringGroup[] | null = null;

  constructor(
    private appConfig: AppConfigService,
    private readonly logger: Logger
  ) {}

  async initialize(): Promise<void> {
    const configFiles = await this.fetchConfigs();
    this.monitoringGroups = this.processConfigs(configFiles);
  }

  getMonitoringGroups(chain: Chain): MonitoringGroup[] {
    if (this.monitoringGroups === null) {
      throw new Error('Monitoring configurations have not been initialized');
    }
    return this.monitoringGroups.filter((group) => group.chain.includes(chain));
  }

  private async fetchConfigs(): Promise<string[]> {
    const sources = this.appConfig.getMonitoringConfigSources();
    const configsDir = path.join(process.cwd(), 'fetched-configs');

    if (!fs.existsSync(configsDir)) {
      fs.mkdirSync(configsDir, { recursive: true });
    }

    const fetchedFiles: string[] = [];

    for (const source of sources) {
      try {
        const git: SimpleGit = simpleGit();
        const targetDir = path.join(configsDir, source.name);

        if (source.auth_token) {
          const repoUrl = new URL(source.url);
          repoUrl.username = source.auth_token;
          
          await git.clone(repoUrl.toString(), targetDir, ['--depth', '1', '-b', source.branch]);
        } else {
          await git.clone(source.url, targetDir, ['--depth', '1', '-b', source.branch]);
        }

        this.logger.log(`Successfully fetched config from ${source.url} to ${targetDir}`);
        
        const files = this.findConfigFiles(targetDir);
        fetchedFiles.push(...files);
      } catch (error) {
        this.logger.error(`Failed to fetch config from ${source.url}: ${error.message}`);
      }
    }

    return fetchedFiles;
  }

  private findConfigFiles(dir: string): string[] {
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

  private processConfigs(configFiles: string[]): MonitoringGroup[] {
    try {
      return MonitoringConfigProcessor.processConfigs(configFiles);
    } catch (error) {
      this.logger.error(`Failed to process config files: ${error.message}`);
      throw error;
    }
  }
}
