// Choose a screen or window for screen sharing (where the OS has no picker of its own).
const { shell } = window;
const [data, sources] = await Promise.all([shell.init(), shell.pickerSources()]);
const t = data.strings;
const $ = (selector) => document.querySelector(selector);

document.documentElement.lang = navigator.language.startsWith('de') ? 'de' : 'en';
document.title = t['picker.title'];
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t[el.dataset.t];

let selected = null;
const buttons = [];

function select(id) {
  selected = id;
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.id === id));
  $('#share').disabled = !id;
}

for (const source of sources) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'source';
  button.dataset.id = source.id;
  button.setAttribute('aria-pressed', 'false');
  const preview = document.createElement(source.thumbnail ? 'img' : 'div');
  if (source.thumbnail) {
    preview.src = source.thumbnail;
    preview.alt = '';
  } else preview.className = 'blank';
  const name = document.createElement('span');
  name.textContent = source.name;
  name.title = source.name;
  button.append(preview, name);
  button.addEventListener('click', () => select(source.id));
  button.addEventListener('dblclick', () => shell.choose(source.id));
  (source.kind === 'screen' ? $('#screens') : $('#windows')).append(button);
  buttons.push(button);
}

$('#screens-title').hidden = !sources.some((s) => s.kind === 'screen');
$('#windows-title').hidden = !sources.some((s) => s.kind === 'window');
$('#empty').hidden = sources.length > 0;
// One screen and nothing else is the common case: preselect it so Enter shares right away.
if (sources.length > 0) select(sources[0].id);
buttons[0]?.focus();

$('#form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (selected) shell.choose(selected);
});
$('#cancel').addEventListener('click', () => shell.choose(null));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') shell.choose(null);
});
