import { Injectable, Logger } from '@nestjs/common';
import { SimpleGit, simpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigService } from './app-config.service';

@Injectable()
export class ChainWatcherConfigService {
  constructor(
    private configService: AppConfigService,
    private readonly logger: Logger
  ) {}

  async fetchConfigs(): Promise<void> {
    const sources = this.configService.getMonitoringConfigSources();
    const configsDir = path.join(process.cwd(), 'fetched-configs');

    if (!fs.existsSync(configsDir)) {
      fs.mkdirSync(configsDir, { recursive: true });
    }

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
      } catch (error) {
        this.logger.error(`Failed to fetch config from ${source.url}: ${error.message}`);
      }
    }
  }
}
