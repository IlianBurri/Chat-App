// Download buttons that match the visitor's system, copy buttons, release version and the mobile menu.
// Every page works without JavaScript: the links in the HTML already point at the right files.
const REPO = 'IlianBurri/Chat-App';
const RELEASE = `https://github.com/${REPO}/releases/latest/download/`;

const DOWNLOADS = {
  windows: { file: 'Hallo-Setup.exe', label: 'Für Windows herunterladen', note: 'Windows 10 und 11, 64 Bit' },
  'mac-arm64': { file: 'Hallo-mac-arm64.dmg', label: 'Für Mac herunterladen', note: 'Mac mit Apple-Chip (M1 und neuer)' },
  'mac-x64': { file: 'Hallo-mac-x64.dmg', label: 'Für Mac (Intel) herunterladen', note: 'Mac mit Intel-Prozessor' },
  linux: { file: 'Hallo-linux-x86_64.AppImage', label: 'Für Linux herunterladen', note: 'AppImage für alle Distributionen, 64 Bit' },
};

/** Best guess of the visitor's platform; Mac architecture only where the browser tells it (Chromium). */
async function detectPlatform() {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'mobile';
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/.test(ua)) {
    try {
      const { architecture } = await navigator.userAgentData.getHighEntropyValues(['architecture']);
      if (architecture === 'x86') return 'mac-x64';
    } catch {
      // Safari and Firefox do not say; nearly all Macs sold since 2021 have Apple chips.
    }
    return 'mac-arm64';
  }
  if (/Linux|X11/.test(ua)) return 'linux';
  return 'unknown';
}

function setupDownloads(platform) {
  const known = DOWNLOADS[platform];
  for (const button of document.querySelectorAll('[data-download-primary]')) {
    if (!known) continue;
    button.href = RELEASE + known.file;
    button.querySelector('[data-label]').textContent = known.label;
  }
  for (const note of document.querySelectorAll('[data-download-note]')) {
    if (known) note.textContent = `${known.note} · kostenlos`;
    else if (platform === 'mobile')
      note.textContent = 'Auf Handy und Tablet öffnest du Hallo im Browser über die Adresse deines Servers.';
  }
  const os = platform.startsWith('mac') ? 'mac' : platform;
  for (const card of document.querySelectorAll('[data-platform]')) {
    const match = card.dataset.platform === os;
    card.classList.toggle('detected', match);
    const badge = card.querySelector('.badge');
    if (badge) badge.hidden = !match;
  }
  // Only the terminal command for this system; both stay visible when the system is unknown.
  const commandFor = os === 'windows' ? 'windows' : os === 'mac' || os === 'linux' ? 'unix' : null;
  if (commandFor) {
    for (const box of document.querySelectorAll('[data-command-for]')) box.hidden = box.dataset.commandFor !== commandFor;
  }
}

function setupCopy() {
  for (const button of document.querySelectorAll('[data-copy]')) {
    const code = button.parentElement.querySelector('code');
    const label = button.textContent;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent.trim());
        button.textContent = 'Kopiert';
      } catch {
        // No clipboard access (e.g. http): select the text so Ctrl+C works.
        getSelection().selectAllChildren(code);
        button.textContent = 'Markiert';
      }
      setTimeout(() => (button.textContent = label), 1800);
    });
  }
}

async function showVersion() {
  const targets = document.querySelectorAll('[data-version]');
  if (!targets.length) return;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const release = await res.json();
    const date = new Date(release.published_at).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
    for (const el of targets) {
      el.textContent = `Aktuelle Version ${release.tag_name.replace(/^v/, '')} vom ${date}`;
      el.hidden = false;
    }
  } catch {
    // Offline or rate-limited: the page works without the version line.
  }
}

function setupMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

setupMenu();
setupCopy();
void detectPlatform().then(setupDownloads);
void showVersion();
