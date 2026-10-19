/**
 * Demo data: 6 users, 2 workgroups with channels and threads, chats, meetings.
 * Skips when data exists unless forced. Used by `prisma/seed.ts` and by the desktop app (SEED_DEMO=1).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from '../src/config';
import { prisma } from '../src/db';
import { demoFiles } from './demoFiles';

export const DEMO_PASSWORD = 'Demo1234!';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export async function seedDemo(force = false) {
  if (!force && (await prisma.user.count()) > 0) {
    console.log('Seed skipped: database already contains data (use npm run db:reset to start over).');
    return;
  }

  const now = Date.now();
  const ago = (ms: number) => new Date(now - ms);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const people = [
    { key: 'anna', name: 'Anna Keller', jobTitle: 'Product Lead', statusMessage: 'Fokuszeit bis 11 Uhr' },
    { key: 'ben', name: 'Ben Müller', jobTitle: 'Frontend Developer' },
    { key: 'clara', name: 'Clara Rossi', jobTitle: 'UX Designerin', manualStatus: 'busy' },
    { key: 'david', name: 'David Meier', jobTitle: 'Backend Developer' },
    { key: 'elif', name: 'Elif Yılmaz', jobTitle: 'Marketing Managerin', statusMessage: 'Heute im Homeoffice 🏡' },
    { key: 'felix', name: 'Felix Schneider', jobTitle: 'Sales', manualStatus: 'dnd' },
  ] as const;

  const u: Record<(typeof people)[number]['key'], string> = {} as never;
  for (const p of people) {
    const user = await prisma.user.create({
      data: {
        name: p.name,
        email: `${p.key}@example.com`,
        passwordHash,
        jobTitle: p.jobTitle,
        manualStatus: 'manualStatus' in p ? p.manualStatus : null,
        statusMessage: 'statusMessage' in p ? p.statusMessage : null,
      },
    });
    u[p.key] = user.id;
  }

  // ---------------------------------------------------------------- chats
  type Line = [author: keyof typeof u, minutesAgo: number, content: string, reactions?: [keyof typeof u, string][]];

  async function createChat(type: 'direct' | 'group', members: (keyof typeof u)[], lines: Line[], name?: string) {
    const chat = await prisma.chat.create({
      data: {
        type,
        name,
        createdAt: ago(lines[0][1] * MINUTE + HOUR),
        members: { create: members.map((m) => ({ userId: u[m], joinedAt: ago(lines[0][1] * MINUTE + HOUR) })) },
      },
    });
    const ids: string[] = [];
    for (const [author, minutes, content, reactions = []] of lines) {
      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          authorId: u[author],
          content,
          createdAt: ago(minutes * MINUTE),
          reactions: { create: reactions.map(([who, emoji]) => ({ userId: u[who], emoji })) },
        },
      });
      ids.push(message.id);
    }
    const lastMinutes = lines[lines.length - 1][1];
    await prisma.chat.update({ where: { id: chat.id }, data: { lastMessageAt: ago(lastMinutes * MINUTE) } });

    // Everyone has read everything except Anna, who leaves the last messages of some chats unread.
    for (const m of members) {
      await prisma.readReceipt.create({
        data: { chatId: chat.id, userId: u[m], lastReadMessageId: ids[ids.length - 1], readAt: ago(lastMinutes * MINUTE - 1000) },
      });
    }
    return { chat, ids };
  }

  const annaBen = await createChat('direct', ['anna', 'ben'], [
    ['ben', 26 * 60, 'Hi Anna, hast du kurz Zeit für das Login-Design?'],
    ['anna', 26 * 60 - 5, 'Klar, ich schaue es mir nach dem Mittag an.'],
    ['ben', 26 * 60 - 8, 'Super, danke! 🙌', [['anna', '👍']]],
    ['anna', 45, 'Habe die Kommentare im Entwurf hinterlassen. Sieht richtig gut aus!'],
    ['ben', 12, 'Danke dir, ich passe die Abstände noch an.'],
    ['ben', 11, 'Kannst du danach nochmals drüberschauen?'],
  ]);

  const annaClara = await createChat('direct', ['anna', 'clara'], [
    ['clara', 3 * 24 * 60, 'Die neuen Icons für die Einstellungen sind fertig.'],
    ['anna', 3 * 24 * 60 - 20, 'Wunderbar, danke Clara!', [['clara', '❤️']]],
    ['clara', 90, 'Morgen 10 Uhr Design-Review, passt dir das?'],
  ]);

  await createChat('direct', ['anna', 'david'], [
    ['david', 2 * 24 * 60, 'Die API für die Reaktionen ist deployed.'],
    ['anna', 2 * 24 * 60 - 3, 'Top 🚀'],
  ]);

  const lunch = await createChat(
    'group',
    ['anna', 'ben', 'clara', 'elif'],
    [
      ['elif', 3 * 60, 'Wer kommt heute mit zum Mittagessen? 🍕'],
      ['ben', 3 * 60 - 2, 'Ich bin dabei!', [['elif', '🎉']]],
      ['clara', 3 * 60 - 4, 'Ich auch, 12:15 beim Eingang?'],
      ['anna', 3 * 60 - 6, 'Perfekt, bis gleich.', [['ben', '👍'], ['elif', '👍']]],
      ['elif', 25, 'Morgen probieren wir das neue Thai-Restaurant aus?'],
    ],
    'Mittagessen',
  );

  await createChat(
    'group',
    ['anna', 'david', 'felix', 'elif'],
    [
      ['felix', 5 * 24 * 60, 'Kunde Nordwind möchte eine Demo nächste Woche.'],
      ['anna', 5 * 24 * 60 - 30, 'Ich bereite die Präsentation vor.'],
      ['david', 4 * 24 * 60, 'Die Testumgebung steht bereit.', [['felix', '❤️']]],
      ['elif', 6 * 60, 'Ich habe die Folien mit den neuen Screenshots ergänzt.'],
    ],
    'Projekt Atlas',
  );

  // A reply and a poll so the demo shows these features.
  const benReply = await prisma.message.create({
    data: {
      chatId: annaBen.chat.id,
      authorId: u.ben,
      content: 'Die Kommentare zum Abstand im Header habe ich schon umgesetzt. 👍',
      replyToId: annaBen.ids[3],
      createdAt: ago(10 * MINUTE),
    },
  });
  await prisma.message.create({
    data: {
      chatId: lunch.chat.id,
      authorId: u.elif,
      type: 'poll',
      content: 'Wohin gehen wir am Freitag?',
      createdAt: ago(20 * MINUTE),
      poll: {
        create: {
          question: 'Wohin gehen wir am Freitag?',
          options: {
            create: [
              { text: 'Thai-Restaurant', position: 0, votes: { create: [{ userId: u.elif }, { userId: u.ben }] } },
              { text: 'Pizzeria', position: 1, votes: { create: [{ userId: u.clara }] } },
              { text: 'Burger', position: 2 },
            ],
          },
        },
      },
    },
  });
  await prisma.chat.update({ where: { id: annaBen.chat.id }, data: { lastMessageAt: ago(10 * MINUTE) } });
  await prisma.chat.update({ where: { id: lunch.chat.id }, data: { lastMessageAt: ago(20 * MINUTE) } });

  // Anna has unread messages in some chats.
  await prisma.readReceipt.updateMany({
    where: { chatId: { in: [annaBen.chat.id, lunch.chat.id] }, userId: u.anna },
    data: { readAt: ago(30 * MINUTE), lastReadMessageId: null },
  });
  await prisma.chatMember.updateMany({ where: { chatId: lunch.chat.id }, data: { pinned: true } });

  // ----------------------------------------------------------- workgroups
  async function createWorkspace(input: {
    name: string;
    description: string;
    color: string;
    owner: keyof typeof u;
    members: (keyof typeof u)[];
    guests?: (keyof typeof u)[];
    channels: {
      name: string;
      description?: string;
      private?: (keyof typeof u)[];
      isDefault?: boolean;
      posts?: { author: keyof typeof u; hoursAgo: number; subject?: string; content: string; replies?: [keyof typeof u, number, string][] }[];
    }[];
  }) {
    const workspace = await prisma.workspace.create({
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
        members: {
          create: [
            { userId: u[input.owner], role: 'owner' },
            ...input.members.map((m) => ({ userId: u[m], role: 'member' })),
            ...(input.guests ?? []).map((m) => ({ userId: u[m], role: 'guest' })),
          ],
        },
      },
    });

    for (const c of input.channels) {
      const channel = await prisma.channel.create({
        data: {
          workspaceId: workspace.id,
          name: c.name,
          description: c.description,
          isDefault: c.isDefault ?? false,
          type: c.private ? 'private' : 'standard',
          members: c.private ? { create: c.private.map((m) => ({ userId: u[m] })) } : undefined,
        },
      });
      for (const post of c.posts ?? []) {
        const replies = post.replies ?? [];
        const lastActivity = replies.length ? replies[replies.length - 1][1] : post.hoursAgo;
        await prisma.post.create({
          data: {
            channelId: channel.id,
            authorId: u[post.author],
            subject: post.subject,
            content: post.content,
            createdAt: ago(post.hoursAgo * HOUR),
            lastActivityAt: ago(lastActivity * HOUR),
            replies: {
              create: replies.map(([author, hoursAgo, content]) => ({
                authorId: u[author],
                content,
                createdAt: ago(hoursAgo * HOUR),
              })),
            },
          },
        });
      }
    }
    return workspace;
  }

  await createWorkspace({
    name: 'Produktentwicklung',
    description: 'Alles rund um Design, Entwicklung und Releases.',
    color: '#5B5FC7',
    owner: 'anna',
    members: ['ben', 'clara', 'david'],
    guests: ['felix'],
    channels: [
      {
        name: 'General',
        isDefault: true,
        posts: [
          {
            author: 'anna',
            hoursAgo: 50,
            subject: 'Willkommen im Produktteam 👋',
            content: 'Hier besprechen wir alles, was das ganze Team betrifft. Für Details nutzt bitte die Fachkanäle.',
            replies: [
              ['ben', 49, 'Danke Anna!'],
              ['clara', 48, 'Freue mich auf die Zusammenarbeit.'],
              ['david', 47, '👋'],
              ['felix', 30, 'Danke für die Einladung!'],
            ],
          },
          {
            author: 'david',
            hoursAgo: 5,
            subject: 'Wartungsfenster am Freitag',
            content: 'Am Freitag ab 18 Uhr spielen wir das Datenbank-Update ein. Rechnet mit ca. 15 Minuten Ausfall.',
            replies: [['anna', 4, 'Danke für die Info, ich gebe es an den Support weiter.']],
          },
        ],
      },
      {
        name: 'Design',
        description: 'UI, UX und Branding',
        posts: [
          {
            author: 'clara',
            hoursAgo: 20,
            subject: 'Neue Farbpalette',
            content: 'Ich habe die Akzentfarben für den Dunkelmodus angepasst. Feedback bis Donnerstag?',
            replies: [
              ['ben', 19, 'Der Kontrast ist viel besser!'],
              ['anna', 18, 'Gefällt mir sehr.'],
            ],
          },
        ],
      },
      {
        name: 'Entwicklung',
        description: 'Technische Diskussionen',
        posts: [
          {
            author: 'ben',
            hoursAgo: 8,
            content: 'Wir sollten auf Vite 8 aktualisieren. Wer hat Zeit für ein kurzes Pairing?',
            replies: [
              ['david', 7, 'Ich, heute Nachmittag passt.'],
              ['ben', 2, '@Anna Keller, sollen wir das Update noch vor dem Release einplanen?'],
            ],
          },
        ],
      },
      { name: 'Release-Planung', description: 'Nur für das Kernteam', private: ['anna', 'david'] },
    ],
  });

  await createWorkspace({
    name: 'Marketing & Vertrieb',
    description: 'Kampagnen, Leads und Kundenfeedback.',
    color: '#C4314B',
    owner: 'elif',
    members: ['anna', 'felix'],
    channels: [
      {
        name: 'General',
        isDefault: true,
        posts: [
          {
            author: 'elif',
            hoursAgo: 28,
            subject: 'Q4-Ziele',
            content: 'Die Ziele für das vierte Quartal sind in den Dateien abgelegt. Bitte bis Montag lesen.',
            replies: [['felix', 27, 'Erledigt ✅']],
          },
        ],
      },
      { name: 'Kampagnen', description: 'Laufende und geplante Kampagnen' },
      {
        name: 'Kundenfeedback',
        posts: [
          {
            author: 'felix',
            hoursAgo: 3,
            subject: 'Feedback von Nordwind',
            content: 'Der Kunde wünscht sich eine einfachere Kalenderansicht. Ich habe die Notizen angehängt.',
          },
        ],
      },
      { name: 'Leads', private: ['elif', 'felix'] },
    ],
  });

  // ------------------------------------------------------------- activity
  // Anna's feed: an unread mention and reply, and reactions she has already seen.
  const mention = await prisma.reply.findFirstOrThrow({
    where: { authorId: u.ben, content: { startsWith: '@Anna Keller' } },
    include: { post: true },
  });
  const notifications = [
    {
      type: 'mention',
      actorId: u.ben,
      channelId: mention.post.channelId,
      postId: mention.postId,
      replyId: mention.id,
      preview: mention.content,
      createdAt: mention.createdAt,
    },
    {
      type: 'reply',
      actorId: u.ben,
      chatId: annaBen.chat.id,
      messageId: benReply.id,
      preview: benReply.content,
      createdAt: benReply.createdAt,
    },
    ...(['ben', 'elif'] as const).map((who) => ({
      type: 'reaction',
      actorId: u[who],
      emoji: '👍',
      chatId: lunch.chat.id,
      messageId: lunch.ids[3],
      preview: 'Perfekt, bis gleich.',
      createdAt: ago(3 * HOUR - 5 * MINUTE),
      readAt: ago(2 * HOUR),
    })),
  ];
  for (const n of notifications) await prisma.notification.create({ data: { userId: u.anna, ...n } });

  // ---------------------------------------------------------------- files
  // Small generated files, so previews and the Files app have content. Names on
  // disk are fixed, so a reset overwrites them instead of piling up copies.
  const uploadDir = resolve(config.uploadDir);
  mkdirSync(uploadDir, { recursive: true });
  const postBySubject = (subject: string) => prisma.post.findFirstOrThrow({ where: { subject } });
  const [palette, goals, feedback, maintenance] = await Promise.all(
    ['Neue Farbpalette', 'Q4-Ziele', 'Feedback von Nordwind', 'Wartungsfenster am Freitag'].map(postBySubject),
  );
  const targets = {
    palette: { channelId: palette.channelId, postId: palette.id },
    goals: { channelId: goals.channelId, postId: goals.id },
    feedback: { channelId: feedback.channelId, postId: feedback.id },
    // Uploaded in the channel's files tab, not attached to a post
    general: { channelId: maintenance.channelId },
    icons: { chatId: annaClara.chat.id, messageId: annaClara.ids[0] },
  };
  for (const file of demoFiles) {
    const content = Buffer.from(file.content, 'utf8');
    writeFileSync(resolve(uploadDir, file.storedName), content);
    await prisma.file.create({
      data: {
        uploaderId: u[file.uploader],
        originalName: file.name,
        storedName: file.storedName,
        mimeType: file.mimeType,
        size: content.length,
        createdAt: ago(file.hoursAgo * HOUR),
        ...targets[file.target],
      },
    });
  }

  // ------------------------------------------------------------- meetings
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const at = (dayOffset: number, hour: number, minute = 0) =>
    new Date(today.getTime() + dayOffset * DAY + hour * HOUR + minute * MINUTE);

  // Running while seeding, so the calendar shows a 'Join' button right away.
  const soon = new Date(Math.floor(now / (5 * MINUTE)) * 5 * MINUTE);
  const meetings: {
    title: string;
    start: Date;
    minutes: number;
    organizer: keyof typeof u;
    participants: (keyof typeof u)[];
    accepted?: (keyof typeof u)[];
    description?: string;
  }[] = [
    { title: 'Kurzer Abgleich Release', start: soon, minutes: 30, organizer: 'ben', participants: ['anna', 'clara'], accepted: ['clara'] },
    { title: 'Daily Stand-up', start: at(0, 9), minutes: 15, organizer: 'anna', participants: ['ben', 'clara', 'david'] },
    {
      title: 'Design-Review',
      start: at(1, 10),
      minutes: 60,
      organizer: 'clara',
      participants: ['anna', 'ben'],
      accepted: ['anna'],
      description: 'Wir gehen die neuen Entwürfe für die Startseite und den Dunkelmodus durch.',
    },
    { title: 'Demo Nordwind', start: at(2, 14), minutes: 45, organizer: 'felix', participants: ['anna', 'elif', 'david'] },
    { title: 'Sprint-Planung', start: at(3, 13, 30), minutes: 90, organizer: 'anna', participants: ['ben', 'clara', 'david'], accepted: ['ben'] },
    { title: 'Kampagnen-Workshop', start: at(-1, 15), minutes: 60, organizer: 'elif', participants: ['anna', 'felix'] },
  ];
  // Each meeting gets its own chat with the invitation card, as if planned in the calendar.
  for (const m of meetings) {
    const createdAt = new Date(Math.min(m.start.getTime(), now) - 2 * DAY);
    const chat = await prisma.chat.create({
      data: {
        type: 'group',
        name: m.title,
        createdAt,
        lastMessageAt: createdAt,
        members: { create: [m.organizer, ...m.participants].map((p) => ({ userId: u[p], joinedAt: createdAt })) },
      },
    });
    const meeting = await prisma.meeting.create({
      data: {
        title: m.title,
        description: m.description ?? null,
        start: m.start,
        end: new Date(m.start.getTime() + m.minutes * MINUTE),
        organizerId: u[m.organizer],
        chatId: chat.id,
        ownsChat: true,
        createdAt,
        participants: {
          create: [
            { userId: u[m.organizer], response: 'accepted' },
            ...m.participants.map((p) => ({ userId: u[p], response: m.accepted?.includes(p) ? 'accepted' : 'none' })),
          ],
        },
      },
    });
    await prisma.message.create({
      data: { chatId: chat.id, authorId: u[m.organizer], type: 'meeting', content: m.title, meetingId: meeting.id, createdAt },
    });
    await prisma.readReceipt.createMany({
      data: [m.organizer, ...m.participants].map((p) => ({ chatId: chat.id, userId: u[p], readAt: createdAt })),
    });
  }

  console.log(`Seeded ${people.length} demo users. Sign in with e.g. anna@example.com / ${DEMO_PASSWORD}`);
}

