/** "@channel" mentions everyone in a channel; both spellings work in any language (matches the client). */
export const CHANNEL_MENTION_NAMES = ['channel', 'kanal'];

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** Removes code blocks and inline code, where an "@" is never a mention. */
function withoutCode(content: string) {
  return content.replace(/```[\s\S]*?(```|$)/g, ' ').replace(/`[^`\n]*`/g, ' ');
}

/**
 * Finds "@Full Name" mentions of the given people in a message (the composer
 * inserts the full name). With `channel`, "@channel"/"@Kanal" sets `everyone`.
 */
export function findMentions(content: string, people: { id: string; name: string }[], options: { channel?: boolean } = {}) {
  const text = withoutCode(content).toLocaleLowerCase();
  // Longest names first, so "@Anna Keller" wins over a person called "Anna".
  const targets = [...people].sort((a, b) => b.name.length - a.name.length).map((p) => ({ id: p.id, name: p.name.toLocaleLowerCase() }));
  const userIds = new Set<string>();
  let everyone = false;

  for (let i = text.indexOf('@'); i !== -1; i = text.indexOf('@', i + 1)) {
    if (i > 0 && WORD_CHAR.test(text[i - 1])) continue;
    const rest = text.slice(i + 1);
    const endsAt = (length: number) => !WORD_CHAR.test(rest[length] ?? '');
    const person = targets.find((p) => rest.startsWith(p.name) && endsAt(p.name.length));
    if (person) {
      userIds.add(person.id);
      continue;
    }
    if (options.channel && CHANNEL_MENTION_NAMES.some((n) => rest.startsWith(n) && endsAt(n.length))) everyone = true;
  }

  return { userIds: [...userIds], everyone };
}
