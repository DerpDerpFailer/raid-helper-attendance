const { EmbedBuilder } = require('discord.js');
const { buildDescription } = require('./truncate');

function formatLastSignup(isoString) {
  if (!isoString) return 'never signed up';
  const days = Math.floor((Date.now() - new Date(isoString).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'last signed up today';
  if (days === 1) return 'last signed up 1 day ago';
  return `last signed up ${days} days ago`;
}

function buildNoSignupEmbed({ days, eventsInWindow, members }) {
  const embed = new EmbedBuilder()
    .setTitle(`🔇 No sign-up in the last ${days} days`)
    .setFooter({ text: `${eventsInWindow} event(s) happened in this window` });

  if (eventsInWindow === 0) {
    embed.setColor(0x95a5a6);
    embed.setDescription(`No events have happened in the last ${days} days yet — nothing to compare against.`);
    return embed;
  }

  if (members.length === 0) {
    embed.setColor(0x2ecc71);
    embed.setDescription('Everyone tracked has signed up for at least one event 🎉');
    return embed;
  }

  embed.setColor(0xe74c3c);
  const lines = members.map((m) => `**${m.display_name}** — ${formatLastSignup(m.last_signed_event_at)}`);
  embed.setDescription(buildDescription(lines));
  return embed;
}

module.exports = { buildNoSignupEmbed };
