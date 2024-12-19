import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigProcessor } from '@w3f/monitoring-config';
import { MonitoringGroup, Chain } from '@w3f/monitoring-types';
import { AppConfigService } from './app-config.service';

@Injectable()
export class MonitoringConfigService {
  private monitoringGroups: MonitoringGroup[] | null = null;
  private configsDir = path.join(process.cwd(), 'monitoring-configs');

  constructor(
    private httpService: HttpService,
    private appConfig: AppConfigService,
  ) {}

  async initialize(): Promise<void> {
    await this.fetchConfigs();
    const configFiles = this.findConfigFiles(this.configsDir);
    this.monitoringGroups = ConfigProcessor.processConfigs(configFiles);
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
      try {
        const headers: Record<string, string> = {
          'PRIVATE-TOKEN': source.auth_token,
        };
        const response = await firstValueFrom(this.httpService.get(source.url, { headers }));

        const fileName = `${source.name}.yaml`;
        fs.writeFileSync(path.join(this.configsDir, fileName), response.data);
      } catch (error) {
        console.error(`Failed to fetch file for: ${source.name}`, error);
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
