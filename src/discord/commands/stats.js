const { SlashCommandBuilder } = require('discord.js');
const statsRepo = require('../../db/repositories/statsRepo');
const periods = require('../../stats/periods');
const { buildStatsEmbed } = require('../embeds/statsEmbed');

const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Show attendance stats for a member')
  .addUserOption((opt) => opt.setName('member').setDescription('Member to look up (defaults to you)'));

async function execute(interaction) {
  const targetUser = interaction.options.getUser('member') ?? interaction.user;
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const displayName = targetMember?.displayName ?? targetUser.username;

  const period = periods.getCurrentPeriod();
  const previous = periods.getPreviousPeriod(period);
  const periodRow = statsRepo.getPeriodByLabel(period.label);
  const previousPeriodRow = statsRepo.getPeriodByLabel(previous.label);

  if (!periodRow) {
    await interaction.reply({ content: 'Stats have not been computed yet for this period. Try `/sync now` first.', ephemeral: true });
    return;
  }

  const snapshot = statsRepo.getSnapshot(periodRow.id, targetUser.id);
  const evolution = previousPeriodRow
    ? statsRepo.getEvolution(periodRow.id, previousPeriodRow.id, targetUser.id)[0]
    : undefined;

  const embed = buildStatsEmbed({
    displayName,
    avatarUrl: targetUser.displayAvatarURL(),
    snapshot,
    evolution,
    period,
  });
  await interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
