import { ConfigProcessor } from './processor';
import { MonitoringGroup } from '../interfaces';
import path from 'path';
import fs from 'fs';

export function getMonitoringGroups(): MonitoringGroup[] {
  try {
    return ConfigProcessor.process(
      path.join(getProjectRoot(), 'configs')
    );
  } catch (error) {
    console.error('Fatal error processing configurations:', error.message);
    process.exit(1);
  }
}

function getProjectRoot(): string {
  let currentDir = __dirname;
  while (!fs.existsSync(path.join(currentDir, 'package.json'))) {
    currentDir = path.dirname(currentDir);
    if (currentDir === path.parse(currentDir).root) {
      throw new Error('Could not find project root');
    }
  }
  return currentDir;
}