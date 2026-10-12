/**
 * Small, safe markdown subset for messages. Produces a tree (never HTML):
 * paragraphs, line breaks, **bold**, *italic* / _italic_, ~~strike~~, `code`,
 * ``` code blocks ```, lists, > quotes, [links](https://…), bare URLs and
 * @mentions of known people.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'br' }
  | { type: 'bold' | 'italic' | 'strike'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'mention'; userId: string; name: string };

export type Block =
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'codeblock'; text: string }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] };

export interface MentionTarget {
  id: string;
  name: string;
}

const UNORDERED = /^\s*[-*•]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;
const QUOTE = /^>\s?/;
const FENCE = /^\s*```/;

export function parseMarkdown(source: string, mentions: MentionTarget[] = []): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const targets = [...mentions].sort((a, b) => b.name.length - a.name.length);
  const inline = (text: string) => parseInline(text, targets);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (FENCE.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence (or end of input)
      blocks.push({ type: 'codeblock', text: code.join('\n') });
      continue;
    }

    if (UNORDERED.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line);
      const pattern = ordered ? ORDERED : UNORDERED;
      const items: Inline[][] = [];
      while (i < lines.length && pattern.test(lines[i])) items.push(inline(lines[i++].replace(pattern, '')));
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(QUOTE, ''));
      blocks.push({ type: 'quote', children: joinLines(quoted.map(inline)) });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !FENCE.test(lines[i]) &&
      !UNORDERED.test(lines[i]) &&
      !ORDERED.test(lines[i]) &&
      !QUOTE.test(lines[i])
    ) {
      paragraph.push(lines[i++]);
    }
    blocks.push({ type: 'paragraph', children: joinLines(paragraph.map(inline)) });
  }

  return blocks;
}

function joinLines(lines: Inline[][]): Inline[] {
  return lines.flatMap((nodes, index) => (index === 0 ? nodes : [{ type: 'br' } as Inline, ...nodes]));
}

const LINK = /^\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/;
const URL = /^https?:\/\/[^\s<]*[^\s<.,;:!?)\]'"]/;
const BOLD = /^\*\*(?=\S)([\s\S]*?\S)\*\*/;
const STRIKE = /^~~(?=\S)([\s\S]*?\S)~~/;
const ITALIC_STAR = /^\*(?=[^\s*])([^*\n]*?[^\s*])\*/;
const ITALIC_UNDERSCORE = /^_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}])/u;
const WORD_CHAR = /[\p{L}\p{N}_]/u;

export function parseInline(text: string, mentions: MentionTarget[] = []): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };
  const push = (node: Inline) => {
    flush();
    out.push(node);
  };

  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const prev = i > 0 ? text[i - 1] : '';
    const atWordStart = !prev || !WORD_CHAR.test(prev);
    let match: RegExpMatchArray | null;

    if (rest[0] === '`') {
      const end = rest.indexOf('`', 1);
      if (end > 1) {
        push({ type: 'code', text: rest.slice(1, end) });
        i += end + 1;
        continue;
      }
    } else if (rest[0] === '[' && (match = rest.match(LINK))) {
      push({ type: 'link', href: match[2], children: parseInline(match[1], mentions) });
      i += match[0].length;
      continue;
    } else if (rest[0] === 'h' && atWordStart && (match = rest.match(URL))) {
      push({ type: 'link', href: match[0], children: [{ type: 'text', text: match[0] }] });
      i += match[0].length;
      continue;
    } else if (rest.startsWith('**') && (match = rest.match(BOLD))) {
      push({ type: 'bold', children: parseInline(match[1], mentions) });
      i += match[0].length;
      continue;
    } else if (rest.startsWith('~~') && (match = rest.match(STRIKE))) {
      push({ type: 'strike', children: parseInline(match[1], mentions) });
      i += match[0].length;
      continue;
    } else if (rest[0] === '*' && (match = rest.match(ITALIC_STAR))) {
      push({ type: 'italic', children: parseInline(match[1], mentions) });
      i += match[0].length;
      continue;
    } else if (rest[0] === '_' && atWordStart && (match = rest.match(ITALIC_UNDERSCORE))) {
      push({ type: 'italic', children: parseInline(match[1], mentions) });
      i += match[0].length;
      continue;
    } else if (rest[0] === '@' && atWordStart) {
      const target = mentions.find((m) => {
        const candidate = rest.slice(1, 1 + m.name.length);
        const after = rest[1 + m.name.length] ?? '';
        return candidate.toLowerCase() === m.name.toLowerCase() && !WORD_CHAR.test(after);
      });
      if (target) {
        push({ type: 'mention', userId: target.id, name: target.name });
        i += 1 + target.name.length;
        continue;
      }
    }

    buffer += rest[0];
    i++;
  }
  flush();
  return out;
}

/** Ids of the people mentioned in a text. */
export function mentionedUserIds(source: string, mentions: MentionTarget[]): string[] {
  const ids = new Set<string>();
  const visit = (nodes: Inline[]) => {
    for (const n of nodes) {
      if (n.type === 'mention') ids.add(n.userId);
      else if ('children' in n) visit(n.children);
    }
  };
  for (const block of parseMarkdown(source, mentions)) {
    if (block.type === 'paragraph' || block.type === 'quote') visit(block.children);
    else if (block.type === 'list') block.items.forEach(visit);
  }
  return [...ids];
}
