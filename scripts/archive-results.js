import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const archivesDir = join(repoRoot, 'archives');

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function main() {
  const baseTargets = ['outputs', 'public/runs', 'public/vybes-daily.json', 'public/vybes-runs.json'];
  const existingTargets = baseTargets.filter((target) => existsSync(join(repoRoot, target)));

  const logFiles = readdirSync(repoRoot).filter((name) => /^eval-.*\.log$/i.test(name));
  logFiles.forEach((file) => {
    if (existsSync(join(repoRoot, file))) {
      existingTargets.push(file);
    }
  });

  if (existingTargets.length === 0) {
    console.log('No artifacts found to archive.');
    return;
  }

  mkdirSync(archivesDir, { recursive: true });
  const archiveName = `vybes-artifacts-${formatTimestamp()}.tar.gz`;
  const archivePath = join(archivesDir, archiveName);

  console.log(`Archiving artifacts → ${archivePath}`);
  const tarResult = spawnSync('tar', ['-czf', archivePath, ...existingTargets], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  if (tarResult.status !== 0) {
    throw new Error('Failed to create archive.');
  }

  console.log('Archive complete. Remove tracked artifacts when ready.');
}

main();
