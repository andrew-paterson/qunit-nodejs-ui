import path from 'path';
import fs from 'fs';

export function getFromEnvFile(key) {
  const envFilePath = path.resolve(
    process.cwd(),
    './web-viewer/test-runner.env.json',
  );
  if (fs.existsSync(envFilePath)) {
    const envData = JSON.parse(fs.readFileSync(envFilePath, 'utf-8'));
    return envData[key];
  }
  return null;
}
