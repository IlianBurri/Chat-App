// Setup wizard and settings: mode → host or connect details → general options.
const { shell } = window;
const data = await shell.init();
const t = data.strings;
const $ = (selector) => document.querySelector(selector);

document.documentElement.lang = navigator.language.startsWith('de') ? 'de' : 'en';
document.title = data.firstRun ? t['setup.title'] : t['setup.settingsTitle'];
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t[el.dataset.t];
for (const el of document.querySelectorAll('[data-app]')) el.textContent = data.appName;
if (!data.firstRun) {
  $('#mode-title').textContent = t['setup.settingsTitle'];
  for (const button of document.querySelectorAll('[data-action="cancel"]')) button.hidden = false;
}

const state = { ...data.settings };
const fields = {
  port: $('#port'),
  lan: $('#lan'),
  demo: $('#demo'),
  url: $('#url'),
  autostart: $('#autostart'),
  closeToTray: $('#closeToTray'),
};
fields.port.value = String(state.port);
fields.lan.checked = state.lan;
fields.demo.checked = state.demo && !data.databaseExists;
fields.demo.disabled = data.databaseExists;
$('#demo-hint').textContent = data.databaseExists ? t['setup.demoExists'] : t['setup.demoHint'];
fields.url.value = state.serverUrl;
fields.url.placeholder = t['setup.urlPlaceholder'];
fields.autostart.checked = state.autostart;
fields.closeToTray.checked = state.closeToTray;
$('#finish').textContent = data.firstRun ? t['setup.finish'] : t['setup.save'];

function renderLan() {
  const list = $('#addresses');
  const port = Number(fields.port.value) || state.port;
  list.replaceChildren();
  if (!fields.lan.checked) {
    $('#lan-hint').textContent = t['setup.lanOff'];
    list.hidden = true;
    return;
  }
  $('#lan-hint').textContent = data.lanAddresses.length ? t['setup.lanHint'] : t['setup.lanNone'];
  for (const ip of data.lanAddresses) {
    const li = document.createElement('li');
    li.textContent = `http://${ip}:${port}`;
    list.append(li);
  }
  list.hidden = data.lanAddresses.length === 0;
}
fields.lan.addEventListener('change', renderLan);
fields.port.addEventListener('input', renderLan);
renderLan();

// Steps
let step = 'mode';
function show(next) {
  step = next;
  for (const section of document.querySelectorAll('[data-step]')) section.hidden = section.dataset.step !== next;
  const current = document.querySelector(`[data-step="${next}"]`);
  (current.querySelector('input:not(:disabled), .choice[aria-pressed="true"], .choice') ?? current).focus();
}

const choices = [...document.querySelectorAll('.choice')];
function selectMode(mode) {
  state.mode = mode;
  for (const choice of choices) choice.setAttribute('aria-pressed', String(choice.dataset.mode === mode));
  document.querySelector('[data-step="mode"] [data-action="next"]').disabled = !mode;
}
for (const choice of choices) {
  choice.addEventListener('click', () => selectMode(choice.dataset.mode));
  choice.addEventListener('dblclick', () => show(choice.dataset.mode));
}
selectMode(state.mode);

function setError(input, message, element) {
  input.setAttribute('aria-invalid', String(!!message));
  element.textContent = message ?? '';
  element.hidden = !message;
}

function portValid() {
  const port = Number(fields.port.value);
  const ok = Number.isInteger(port) && port >= 1024 && port <= 65535;
  setError(fields.port, ok ? null : t['error.invalid_port'], $('#port-error'));
  return ok;
}

// Once an error shows, it follows the input, so a corrected value clears it right away.
fields.port.addEventListener('input', () => {
  if (fields.port.getAttribute('aria-invalid') === 'true') portValid();
});

let testing = false;
async function testUrl() {
  if (testing) return false;
  testing = true;
  const message = $('#url-message');
  message.className = 'message muted';
  message.textContent = t['setup.testing'];
  const button = document.querySelector('[data-step="connect"] [data-action="next"]');
  button.disabled = true;
  const result = await shell.testServer(fields.url.value);
  button.disabled = false;
  testing = false;
  message.className = `message ${result.ok ? 'ok' : 'error'}`;
  message.textContent = result.message;
  fields.url.setAttribute('aria-invalid', String(!result.ok));
  if (result.ok) fields.url.value = result.origin;
  return result.ok;
}

async function next() {
  if (step === 'mode' && state.mode) return show(state.mode);
  if (step === 'host' && portValid()) return show('general');
  if (step === 'connect' && (await testUrl())) return show('general');
}

function back() {
  show(step === 'general' ? state.mode : 'mode');
}

for (const button of document.querySelectorAll('[data-action="next"]')) button.addEventListener('click', () => void next());
for (const button of document.querySelectorAll('[data-action="back"]')) button.addEventListener('click', back);
for (const button of document.querySelectorAll('[data-action="cancel"]')) button.addEventListener('click', () => shell.cancelSetup());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !data.firstRun) shell.cancelSetup();
});

$('#form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (step !== 'general') return void next();
  const finish = $('#finish');
  finish.disabled = true;
  const result = await shell.saveSetup({
    mode: state.mode,
    port: Number(fields.port.value),
    lan: fields.lan.checked,
    demo: fields.demo.checked,
    serverUrl: fields.url.value,
    autostart: fields.autostart.checked,
    closeToTray: fields.closeToTray.checked,
  });
  finish.disabled = false;
  if (result?.ok) return;
  // The server went away between the test and saving, or the port became invalid: back to that field.
  show(state.mode);
  if (result?.field === 'port') setError(fields.port, result.message, $('#port-error'));
  else {
    $('#url-message').className = 'message error';
    $('#url-message').textContent = result?.message ?? '';
  }
});

show('mode');
