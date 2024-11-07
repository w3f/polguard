import { Injectable } from '@nestjs/common';
import { SimpleGit, simpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import { MonitoringConfigProcessor } from '@lib/config/config-processor';
import { MonitoringGroup } from '@lib/interfaces';
import { AppConfigService } from './app-config.service';
import { Chain } from '@lib/constants';

@Injectable()
export class MonitoringConfigService {
  private monitoringGroups: MonitoringGroup[] | null = null;
  private configsDir = path.join(process.cwd(), 'monitoring-configs');

  constructor(private appConfig: AppConfigService) {}

  async initialize(): Promise<void> {
    await this.fetchConfigs();
    const configFiles = this.findConfigFiles(this.configsDir);
    this.monitoringGroups = MonitoringConfigProcessor.processConfigs(configFiles);
  }

  getMonitoringGroups(chain: Chain): MonitoringGroup[] {
    if (this.monitoringGroups === null) {
      throw new Error('Monitoring configurations have not been initialized');
    }
    return this.monitoringGroups.filter(group => group.chain.includes(chain));
  }

  private async fetchConfigs(): Promise<void> {
    const sources = this.appConfig.getMonitoringConfigSources();

    if (!fs.existsSync(this.configsDir)) {
      fs.mkdirSync(this.configsDir, { recursive: true });
    }

    for (const source of sources) {
      const git: SimpleGit = simpleGit();
      const targetDir = path.join(this.configsDir, source.name);

      if (source.auth_token) {
        const repoUrl = new URL(source.url);
        repoUrl.username = source.auth_token;

        await git.clone(repoUrl.toString(), targetDir, ['--depth', '1', '-b', source.branch]);
      } else {
        await git.clone(source.url, targetDir, ['--depth', '1', '-b', source.branch]);
      }
    }
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
}
