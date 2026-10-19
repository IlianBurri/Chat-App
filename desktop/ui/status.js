// Shown while the built-in server starts or the team's server is checked, and when that fails.
const { shell } = window;
const data = await shell.init();
const t = data.strings;
const $ = (selector) => document.querySelector(selector);
const status = data.status;

document.documentElement.lang = navigator.language.startsWith('de') ? 'de' : 'en';
document.title = data.appName;
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t[el.dataset.t];
for (const el of document.querySelectorAll('[data-app]')) el.textContent = data.appName;

if (status.kind === 'error') {
  $('#error').hidden = false;
  $('#error-text').textContent = status.message;
  if (status.details) {
    $('#details').hidden = false;
    $('#details-text').textContent = status.details;
  }
  $('#log').hidden = !status.canOpenLog;
  $('#retry').addEventListener('click', () => shell.retry());
  $('#settings').addEventListener('click', () => shell.openSettings());
  $('#log').addEventListener('click', () => shell.openLog());
  $('#retry').focus();
} else {
  $('#busy').hidden = false;
  $('#busy-text').textContent =
    status.kind === 'starting' ? t['status.starting'] : t['status.connecting'].replace('{{url}}', status.url);
  $('#busy-hint').textContent = status.kind === 'starting' && status.firstStart ? t['status.firstStart'] : '';
}
