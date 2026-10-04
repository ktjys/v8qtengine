const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getCommitHash() {
  if (process.argv[2] && process.argv[2].trim()) {
    return process.argv[2].trim().slice(0, 7);
  }
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.trim().slice(0, 7);
  }
  if (process.env.CF_PAGES_COMMIT_SHA) {
    return process.env.CF_PAGES_COMMIT_SHA.trim().slice(0, 7);
  }
  if (process.env.COMMIT_SHA) {
    return process.env.COMMIT_SHA.trim().slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD').toString().trim().slice(0, 7);
  } catch (e) {
    return null;
  }
}

function getCommitMessage() {
  if (process.env.GITHUB_COMMIT_MESSAGE) {
    return process.env.GITHUB_COMMIT_MESSAGE.trim().slice(0, 80);
  }
  try {
    return execSync('git log -1 --pretty=%s').toString().trim().slice(0, 80);
  } catch (e) {
    return null;
  }
}

function getBuildTime() {
  return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';
}

function updateVersionFile() {
  const hash = getCommitHash();
  const msg = getCommitMessage();
  const buildTime = getBuildTime();

  if (!hash) {
    console.log('[update-version] No git commit hash detected, keeping current version file.');
    return;
  }

  const versionFilePath = path.join(__dirname, '..', 'src', 'version.ts');
  if (!fs.existsSync(versionFilePath)) {
    console.warn('[update-version] src/version.ts not found.');
    return;
  }

  let content = fs.readFileSync(versionFilePath, 'utf8');

  // Update fallback commit hash
  content = content.replace(/commitHash:\s*resolveCommitHash\(\s*['"][^'"]*['"]\s*\)/g, `commitHash: resolveCommitHash('${hash}')`);
  content = content.replace(/FALLBACK_COMMIT_HASH\s*=\s*['"][^'"]*['"]/g, `FALLBACK_COMMIT_HASH = '${hash}'`);
  
  if (msg) {
    const escapedMsg = msg.replace(/'/g, "\\'");
    content = content.replace(/FALLBACK_COMMIT_MESSAGE\s*=\s*['"][^'"]*['"]/g, `FALLBACK_COMMIT_MESSAGE = '${escapedMsg}'`);
  }

  content = content.replace(/FALLBACK_BUILD_TIME\s*=\s*['"][^'"]*['"]/g, `FALLBACK_BUILD_TIME = '${buildTime}'`);

  fs.writeFileSync(versionFilePath, content, 'utf8');
  console.log(`[update-version] Updated src/version.ts with commit #${hash} (${buildTime})`);
}

updateVersionFile();
