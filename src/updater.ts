import { check, Update } from '@tauri-apps/plugin-updater';

let updateAvailable: Update | null = null;

export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (update) {
      updateAvailable = update;
      showUpdateBanner(update.version);
    }
  } catch (err) {
    // Silent fail - don't bother user if update check fails
    console.debug('Update check failed:', err);
  }
}

function showUpdateBanner(version: string) {
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.innerHTML = `
    <span>GitNotes ${version} is available</span>
    <button id="update-install">Update & Restart</button>
    <button id="update-dismiss">Later</button>
  `;
  document.body.prepend(banner);

  document.getElementById('update-install')?.addEventListener('click', installUpdate);
  document.getElementById('update-dismiss')?.addEventListener('click', dismissBanner);
}

async function installUpdate() {
  if (!updateAvailable) return;

  const banner = document.getElementById('update-banner');
  if (banner) {
    banner.innerHTML = '<span>Downloading update...</span>';
  }

  try {
    await updateAvailable.downloadAndInstall();
    // App will restart automatically after install
  } catch (err) {
    console.error('Update failed:', err);
    if (banner) {
      banner.innerHTML = '<span>Update failed. Try again later.</span>';
      setTimeout(dismissBanner, 3000);
    }
  }
}

function dismissBanner() {
  const banner = document.getElementById('update-banner');
  banner?.remove();
}
