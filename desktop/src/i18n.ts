/**
 * Texts of the desktop shell (menu, tray, setup and status pages). The web app has its own translations.
 * The app name comes from package.json (`productName`) and is filled in for {{app}}.
 */
const de = {
  // Menu
  'menu.settings': 'Einstellungen …',
  'menu.file': 'Datei',
  'menu.copyAddress': 'Server-Adresse kopieren',
  'menu.openLog': 'Server-Protokoll öffnen',
  'menu.openData': 'Datenordner öffnen',
  'menu.quit': 'Beenden',
  'menu.edit': 'Bearbeiten',
  'menu.view': 'Ansicht',
  'menu.reload': 'Neu laden',
  'menu.window': 'Fenster',
  'menu.help': 'Hilfe',
  'menu.website': 'Website',
  'menu.guide': 'Anleitung',
  'menu.about': 'Über {{app}}',
  'about.detail': 'Version {{version}}\nElectron {{electron}} · Chromium {{chrome}} · Node.js {{node}}',

  // Tray
  'tray.open': '{{app}} öffnen',
  'tray.unread': '{{app}} – {{count}} ungelesen',
  'tray.serverRunning': 'Server läuft: {{address}}',
  'tray.serverLocal': 'Server läuft (nur dieser Computer)',
  'tray.autostart': 'Beim Anmelden starten',
  'tray.hiddenTitle': '{{app}} läuft weiter',
  'tray.hiddenBody': 'Du erreichst {{app}} über das Symbol im Infobereich. Beenden kannst du es dort oder im Menü.',
  'tray.hiddenBodyServer': 'Der Server bleibt für dein Team erreichbar. Beenden kannst du {{app}} über das Symbol im Infobereich.',

  // Setup
  'setup.title': '{{app}} einrichten',
  'setup.settingsTitle': 'Einstellungen',
  'setup.welcome': 'Willkommen bei {{app}}',
  'setup.chooseMode': 'Wie möchtest du {{app}} nutzen?',
  'setup.host': 'Eigenen Server starten',
  'setup.hostHint': 'Dieser Computer wird der Server für dein Team. Alle Daten bleiben bei dir.',
  'setup.connect': 'Mit einem Server verbinden',
  'setup.connectHint': 'Dein Team hat schon einen {{app}}-Server. Du brauchst nur seine Adresse.',
  'setup.back': 'Zurück',
  'setup.next': 'Weiter',
  'setup.cancel': 'Abbrechen',
  'setup.port': 'Port',
  'setup.portHint': 'Zwischen 1024 und 65535. Standard ist 4000.',
  'setup.lan': 'Im lokalen Netzwerk erreichbar',
  'setup.lanHint': 'Kolleginnen und Kollegen verbinden sich dann über eine dieser Adressen:',
  'setup.lanNone': 'Gerade ist kein Netzwerk verbunden.',
  'setup.lanOff': 'Nur auf diesem Computer nutzbar.',
  'setup.demo': 'Mit Demo-Daten starten',
  'setup.demoHint': 'Sechs Beispiel-Konten mit Chats, Arbeitsgruppen und Terminen, zum Ausprobieren.',
  'setup.demoExists': 'Die Datenbank existiert schon; Demo-Daten kommen nur in eine leere Datenbank.',
  'setup.url': 'Server-Adresse',
  'setup.urlPlaceholder': 'z. B. http://192.168.1.20:4000',
  'setup.testing': 'Verbindung wird geprüft …',
  'setup.ok': 'Verbunden mit {{url}}',
  'setup.general': 'Allgemein',
  'setup.autostart': 'Beim Anmelden am Computer starten',
  'setup.closeToTray': 'Beim Schliessen im Infobereich weiterlaufen',
  'setup.closeToTrayHint': 'So bekommst du weiter Benachrichtigungen. Als Server bleibt {{app}} für dein Team erreichbar.',
  'setup.finish': '{{app}} starten',
  'setup.save': 'Speichern',
  'setup.restartHint': 'Zum Übernehmen startet {{app}} neu.',

  // Status page
  'status.starting': 'Server wird gestartet …',
  'status.firstStart': 'Beim ersten Start wird die Datenbank angelegt. Das dauert einen Moment.',
  'status.connecting': 'Verbinde mit {{url}} …',
  'status.retry': 'Erneut versuchen',
  'status.settings': 'Einstellungen',
  'status.openLog': 'Protokoll öffnen',
  'status.details': 'Details',

  // Errors
  'error.title': 'Das hat nicht geklappt',
  'error.port_in_use': 'Port {{port}} ist schon belegt. Läuft {{app}} bereits auf diesem Computer, oder nutzt ein anderes Programm diesen Port? Wähle in den Einstellungen einen anderen Port.',
  'error.server_exit': 'Der Server wurde unerwartet beendet. Details stehen im Protokoll.',
  'error.server_timeout': 'Der Server hat nicht rechtzeitig geantwortet. Details stehen im Protokoll.',
  'error.unreachable': '{{url}} ist nicht erreichbar. Prüfe die Adresse und ob dein Computer im richtigen Netzwerk ist.',
  'error.not_hallo': 'Unter {{url}} antwortet kein {{app}}-Server.',
  'error.invalid_url': 'Das ist keine gültige Adresse.',
  'error.invalid_port': 'Der Port muss eine Zahl zwischen 1024 und 65535 sein.',

  // Screen picker
  'picker.title': 'Was möchtest du teilen?',
  'picker.screens': 'Bildschirme',
  'picker.windows': 'Fenster',
  'picker.share': 'Teilen',
  'picker.empty': 'Keine Quellen gefunden. Auf macOS braucht {{app}} die Berechtigung «Bildschirmaufnahme» in den Systemeinstellungen.',
};

type Key = keyof typeof de;

const en: Record<Key, string> = {
  'menu.settings': 'Settings…',
  'menu.file': 'File',
  'menu.copyAddress': 'Copy server address',
  'menu.openLog': 'Open server log',
  'menu.openData': 'Open data folder',
  'menu.quit': 'Quit',
  'menu.edit': 'Edit',
  'menu.view': 'View',
  'menu.reload': 'Reload',
  'menu.window': 'Window',
  'menu.help': 'Help',
  'menu.website': 'Website',
  'menu.guide': 'Guide',
  'menu.about': 'About {{app}}',
  'about.detail': 'Version {{version}}\nElectron {{electron}} · Chromium {{chrome}} · Node.js {{node}}',

  'tray.open': 'Open {{app}}',
  'tray.unread': '{{app}} – {{count}} unread',
  'tray.serverRunning': 'Server running: {{address}}',
  'tray.serverLocal': 'Server running (this computer only)',
  'tray.autostart': 'Start at login',
  'tray.hiddenTitle': '{{app}} keeps running',
  'tray.hiddenBody': 'Reach {{app}} from the icon in the notification area. You can quit it there or from the menu.',
  'tray.hiddenBodyServer': 'The server stays available to your team. Quit {{app}} from the icon in the notification area.',

  'setup.title': 'Set up {{app}}',
  'setup.settingsTitle': 'Settings',
  'setup.welcome': 'Welcome to {{app}}',
  'setup.chooseMode': 'How do you want to use {{app}}?',
  'setup.host': 'Run my own server',
  'setup.hostHint': 'This computer becomes the server for your team. All data stays with you.',
  'setup.connect': 'Connect to a server',
  'setup.connectHint': 'Your team already has a {{app}} server. All you need is its address.',
  'setup.back': 'Back',
  'setup.next': 'Next',
  'setup.cancel': 'Cancel',
  'setup.port': 'Port',
  'setup.portHint': 'Between 1024 and 65535. The default is 4000.',
  'setup.lan': 'Reachable on the local network',
  'setup.lanHint': 'Colleagues then connect using one of these addresses:',
  'setup.lanNone': 'No network is connected right now.',
  'setup.lanOff': 'Only usable on this computer.',
  'setup.demo': 'Start with demo data',
  'setup.demoHint': 'Six sample accounts with chats, workgroups and meetings to try things out.',
  'setup.demoExists': 'The database already exists; demo data only goes into an empty database.',
  'setup.url': 'Server address',
  'setup.urlPlaceholder': 'e.g. http://192.168.1.20:4000',
  'setup.testing': 'Checking connection…',
  'setup.ok': 'Connected to {{url}}',
  'setup.general': 'General',
  'setup.autostart': 'Start when I sign in to my computer',
  'setup.closeToTray': 'Keep running in the notification area when closed',
  'setup.closeToTrayHint': 'You keep getting notifications, and as a server {{app}} stays available to your team.',
  'setup.finish': 'Start {{app}}',
  'setup.save': 'Save',
  'setup.restartHint': '{{app}} restarts to apply this.',

  'status.starting': 'Starting server…',
  'status.firstStart': 'The first start creates the database. This takes a moment.',
  'status.connecting': 'Connecting to {{url}}…',
  'status.retry': 'Try again',
  'status.settings': 'Settings',
  'status.openLog': 'Open log',
  'status.details': 'Details',

  'error.title': 'That did not work',
  'error.port_in_use': 'Port {{port}} is already in use. Is {{app}} already running on this computer, or does another program use this port? Choose a different port in the settings.',
  'error.server_exit': 'The server stopped unexpectedly. The log has the details.',
  'error.server_timeout': 'The server did not respond in time. The log has the details.',
  'error.unreachable': '{{url}} cannot be reached. Check the address and that your computer is on the right network.',
  'error.not_hallo': 'There is no {{app}} server at {{url}}.',
  'error.invalid_url': 'This is not a valid address.',
  'error.invalid_port': 'The port must be a number between 1024 and 65535.',

  'picker.title': 'What do you want to share?',
  'picker.screens': 'Screens',
  'picker.windows': 'Windows',
  'picker.share': 'Share',
  'picker.empty': 'No sources found. On macOS, {{app}} needs the “Screen Recording” permission in System Settings.',
};

export type StringKey = Key;
export type Strings = Record<Key, string>;

/** German for German system languages, English otherwise (like the web app's fallback). */
export function stringsFor(locale: string, appName: string): Strings {
  const table = locale.toLowerCase().startsWith('de') ? de : en;
  return Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v.replaceAll('{{app}}', appName)])) as Strings;
}

export function format(text: string, values: Record<string, string | number>) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
