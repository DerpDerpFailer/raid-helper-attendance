const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function formatTrend(evolution) {
  if (!evolution || evolution.previous_rank === null || evolution.previous_rank === undefined) {
    return 'NEW — no data for the previous period yet';
  }
  if (evolution.rank_change > 0) return `⬆️ +${evolution.rank_change} ranks (score ${evolution.score_delta >= 0 ? '+' : ''}${evolution.score_delta.toFixed(2)})`;
  if (evolution.rank_change < 0) return `⬇️ ${evolution.rank_change} ranks (score ${evolution.score_delta >= 0 ? '+' : ''}${evolution.score_delta.toFixed(2)})`;
  return `➖ no change (score ${evolution.score_delta >= 0 ? '+' : ''}${evolution.score_delta.toFixed(2)})`;
}

function buildStatsEmbed({ displayName, avatarUrl, snapshot, evolution, period }) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: displayName, iconURL: avatarUrl })
    .setTitle('Attendance stats')
    .setFooter({ text: `Period: ${period.label}` });

  if (!snapshot) {
    embed.setDescription('No events recorded for this member in the current period yet.');
    return embed;
  }

  embed.addFields(
    { name: 'Response rate', value: `${pct(snapshot.response_rate)} (${snapshot.responses}/${snapshot.total_events})`, inline: true },
    { name: 'Presence rate', value: `${pct(snapshot.presence_rate)} (${snapshot.presences}/${snapshot.total_events})`, inline: true },
    { name: 'Global score', value: snapshot.score_global.toFixed(2), inline: true },
  );

  if (snapshot.eligible === 1) {
    embed.addFields(
      { name: 'Global rank', value: `#${snapshot.global_rank}`, inline: true },
      { name: 'Presence rank', value: `#${snapshot.presence_rank}`, inline: true },
      { name: 'Response rank', value: `#${snapshot.response_rank}`, inline: true },
      { name: 'Evolution vs previous period', value: formatTrend(evolution), inline: false },
    );

    if (evolution?.alert_level) {
      embed.setColor(evolution.alert_level === 'Critical' ? 0xe74c3c : 0xf39c12);
      embed.addFields({ name: 'Alert', value: `⚠️ ${evolution.alert_level}` });
    } else {
      embed.setColor(0x2ecc71);
    }
  } else {
    embed.addFields({
      name: 'Ranking',
      value: `Not yet eligible — requires ${config.stats.eligibilityMinDays}+ days of tenure since joining.`,
    });
  }

  return embed;
}

module.exports = { buildStatsEmbed };
