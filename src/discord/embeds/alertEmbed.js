const { EmbedBuilder } = require('discord.js');
const { buildDescription } = require('./truncate');

const BADGE = { Critical: '🔴', Alert: '🟠' };

function formatEntry(row) {
  const badge = BADGE[row.alert_level];
  const scoreDeltaStr = `${row.score_delta >= 0 ? '+' : ''}${row.score_delta.toFixed(2)}`;
  return `${badge} **${row.display_name}** — ${row.alert_level} (${row.rank_change} ranks, score ${scoreDeltaStr})`;
}

function buildDropoutsEmbed({ rows, period }) {
  const dropouts = rows.filter((r) => r.alert_level);

  const embed = new EmbedBuilder()
    .setTitle('📉 Dropouts')
    .setFooter({ text: `Current period: ${period.label} (vs previous period)` });

  if (dropouts.length === 0) {
    embed.setColor(0x2ecc71);
    embed.setDescription('No dropouts 🎉');
    return embed;
  }

  const hasCritical = dropouts.some((r) => r.alert_level === 'Critical');
  embed.setColor(hasCritical ? 0xe74c3c : 0xf39c12);
  const lines = dropouts.sort((a, b) => a.rank_change - b.rank_change).map(formatEntry);
  embed.setDescription(buildDescription(lines));
  return embed;
}

module.exports = { buildDropoutsEmbed };
