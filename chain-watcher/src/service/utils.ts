import * as fs from 'fs';
import * as path from 'path';


export function findProjectRoot(startDir: string = __dirname): string {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  throw new Error('Could not find project root');
}
