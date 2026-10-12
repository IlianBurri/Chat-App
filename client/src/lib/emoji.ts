/** Quick reactions shown in the message hover toolbar. */
export const QUICK_REACTIONS = ['👍', '❤️', '😆', '😮', '😢', '😡'] as const;

export const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    icon: '😀',
    emojis: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 💩 🤡 👻 👽 🤖',
  },
  {
    id: 'people',
    icon: '👋',
    emojis: '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🧠 👀 👁️ 🙋 🙆 🙅 🤷 🤦 🙇 💁 🧑‍💻 👩‍💻 👨‍💻 🧑‍🤝‍🧑 👪',
  },
  {
    id: 'hearts',
    icon: '❤️',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🕳️ 💬 💭 💤',
  },
  {
    id: 'nature',
    icon: '🌿',
    emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🐬 🐳 🌵 🎄 🌲 🌳 🌴 🌱 🌿 🍀 🍁 🍂 🌷 🌹 🌻 🌼 🌸 ☀️ 🌤️ ⛅ 🌧️ ⛈️ ❄️ ☃️ 🌈 ⚡ 🔥 🌊',
  },
  {
    id: 'food',
    icon: '🍕',
    emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕 🌽 🥐 🥖 🥨 🧀 🥚 🍳 🥞 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🥟 🍦 🍩 🍪 🎂 🍰 🧁 🍫 🍿 ☕ 🍵 🥤 🍺 🍻 🥂 🍷',
  },
  {
    id: 'activities',
    icon: '⚽',
    emojis: '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏓 🏸 🥅 ⛳ 🎯 🎳 🎮 🎲 🧩 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎸 🏆 🥇 🥈 🥉 🏅 🎉 🎊 🎈 🎁 🎀 🚀 ✈️ 🚗 🚲 🏖️ 🏔️ 🏠 🏢',
  },
  {
    id: 'objects',
    icon: '💡',
    emojis: '💻 🖥️ ⌨️ 🖱️ 📱 ☎️ 📞 📷 🎥 📺 ⏰ ⌛ 💡 🔦 📚 📖 📝 ✏️ 🖊️ 📌 📎 ✂️ 📁 📂 📅 📆 🗓️ 📊 📈 📉 📋 🔒 🔓 🔑 🔨 🛠️ ⚙️ 🧲 💰 💳 💼 📦 ✉️ 📧 📣 🔔 🔕',
  },
  {
    id: 'symbols',
    icon: '✅',
    emojis: '✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ❓ ❗ ‼️ ⁉️ ⚠️ 🚫 ⛔ 🆗 🆕 🆒 🔝 🔜 ▶️ ⏸️ ⏹️ ⏺️ 🔁 🔄 ⬆️ ⬇️ ⬅️ ➡️ ↩️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ ⭐ 🌟 ✨',
  },
].map((c) => ({ ...c, emojis: c.emojis.split(' ') }));

export type EmojiCategoryId = (typeof EMOJI_CATEGORIES)[number]['id'];

const RECENT_KEY = 'ui-recent-emoji';

export function recentEmojis(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string').slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string) {
  const next = [emoji, ...recentEmojis().filter((e) => e !== emoji)].slice(0, 24);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}
