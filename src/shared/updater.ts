import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function checkForUpdates(silent = false): Promise<boolean> {
  try {
    if (!fs.existsSync(path.join(process.cwd(), '.git'))) {
      if (!silent) console.log('Not a git repository, skipping update check.');
      return false;
    }

    if (!silent) console.log('Checking for updates from https://github.com/Kapustiack/Open-Nexus...');

    // Ensure origin is set to the correct repo
    try {
      const remoteUrl = execSync('git remote get-url origin').toString().trim();
      if (remoteUrl !== 'https://github.com/Kapustiack/Open-Nexus' && remoteUrl !== 'https://github.com/Kapustiack/Open-Nexus.git') {
        execSync('git remote set-url origin https://github.com/Kapustiack/Open-Nexus.git');
      }
    } catch {
      execSync('git remote add origin https://github.com/Kapustiack/Open-Nexus.git');
    }

    execSync('git fetch', { stdio: 'ignore' });

    const local = execSync('git rev-parse HEAD').toString().trim();
    const remote = execSync('git rev-parse @{u}').toString().trim();

    if (local !== remote) {
      console.log('\n============================================================');
      console.log('Open Nexus has been updated, please wait for installation...');
      console.log('============================================================\n');

      execSync('git pull', { stdio: 'inherit' });


      console.log('\n============================================================');
      console.log('Installation complete. Please restart Open Nexus to apply changes.');
      console.log('============================================================\n');

      return true;
    }

    if (!silent) console.log('Open Nexus is up to date.');
    return false;
  } catch (error: any) {
    if (!silent) console.error('Update check failed:', error.message || error);
    return false;
  }
}
