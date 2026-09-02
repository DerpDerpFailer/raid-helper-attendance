const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

const MEDALS = ['🥇', '🥈', '🥉'];
const AXIS_LABEL = { global: 'Global Score', presence: 'Presence', response: 'Response' };
const RANK_FIELD = { global: 'global_rank', presence: 'presence_rank', response: 'response_rank' };

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function formatRow(row, axis, index) {
  const medal = MEDALS[index] ?? `#${row[RANK_FIELD[axis]]}`;
  if (axis === 'global') {
    return `${medal} **${row.display_name}** — score ${row.score_global.toFixed(2)} (${pct(row.presence_rate)} presence / ${pct(row.response_rate)} response)`;
  }
  if (axis === 'presence') {
    return `${medal} **${row.display_name}** — ${pct(row.presence_rate)} presence`;
  }
  return `${medal} **${row.display_name}** — ${pct(row.response_rate)} response`;
}

function buildTopFlopEmbed({ kind, axis, rows, period }) {
  const icon = kind === 'top' ? '🏆' : '📉';
  const title = `${icon} ${kind === 'top' ? 'Top' : 'Flop'} ${config.stats.topFlopSize} — ${AXIS_LABEL[axis]}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(kind === 'top' ? 0x2ecc71 : 0xe74c3c)
    .setFooter({ text: `Ranked members only (${config.stats.eligibilityMinDays}+ days tenure) · Period: ${period.label}` });

  if (rows.length === 0) {
    embed.setDescription('No ranked members yet for this period.');
    return embed;
  }

  embed.setDescription(rows.map((r, i) => formatRow(r, axis, kind === 'top' ? i : -1)).join('\n'));
  return embed;
}

module.exports = { buildTopFlopEmbed };
