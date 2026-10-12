/** Text edits for the formatting toolbar. All functions are pure. */

export interface Edit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Wraps the selection in markers, e.g. **bold**. Without a selection a placeholder is inserted and selected. */
export function wrapSelection(text: string, start: number, end: number, before: string, after = before, placeholder = ''): Edit {
  const selected = text.slice(start, end) || placeholder;
  const next = text.slice(0, start) + before + selected + after + text.slice(end);
  const selectionStart = start + before.length;
  return { text: next, selectionStart, selectionEnd: selectionStart + selected.length };
}

/** Prefixes every line touched by the selection (lists, quotes). */
export function prefixLines(text: string, start: number, end: number, prefix: (index: number) => string): Edit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const replaced = lines.map((line, i) => prefix(i) + line).join('\n');
  const next = text.slice(0, lineStart) + replaced + text.slice(lineEnd);
  return { text: next, selectionStart: lineStart, selectionEnd: lineStart + replaced.length };
}

/** Inline code for single-line selections, a fenced block otherwise. */
export function codeFormat(text: string, start: number, end: number): Edit {
  const selected = text.slice(start, end);
  if (selected.includes('\n')) {
    const needsBreak = start > 0 && text[start - 1] !== '\n';
    return wrapSelection(text, start, end, `${needsBreak ? '\n' : ''}\`\`\`\n`, '\n```\n');
  }
  return wrapSelection(text, start, end, '`', '`', 'code');
}

/** [selection](https://) with the URL part selected for typing. */
export function linkFormat(text: string, start: number, end: number, placeholder: string): Edit {
  const label = text.slice(start, end) || placeholder;
  const url = 'https://';
  const next = `${text.slice(0, start)}[${label}](${url})${text.slice(end)}`;
  const urlStart = start + label.length + 3;
  return { text: next, selectionStart: urlStart, selectionEnd: urlStart + url.length };
}

/** The "@query" directly before the caret, if the user is typing a mention. */
export function mentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const match = before.match(/(?:^|\s)@([\p{L}\p{N}.-]*(?: [\p{L}\p{N}.-]*)?)$/u);
  if (!match) return null;
  return { query: match[1], start: caret - match[1].length - 1 };
}

/** Replaces "@query" with the full mention. */
export function insertMention(text: string, start: number, caret: number, name: string): Edit {
  const insert = `@${name} `;
  const next = text.slice(0, start) + insert + text.slice(caret);
  const position = start + insert.length;
  return { text: next, selectionStart: position, selectionEnd: position };
}
