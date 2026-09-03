const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const settingsRepo = require('../../db/repositories/settingsRepo');

const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Admin: configure the bot for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) => sub
    .setName('role')
    .setDescription('Set which role marks a real tracked member (excludes bots, allies, guests)')
    .addRoleOption((opt) => opt
      .setName('role')
      .setDescription('The role your active raiders have (e.g. "Member")')
      .setRequired(true)))
  .addSubcommand((sub) => sub
    .setName('score-weight')
    .setDescription('Set the Global Score weighting between presence and sign-up (defaults to 70/30)')
    .addIntegerOption((opt) => opt
      .setName('presence')
      .setDescription('Presence weight in % — sign-up gets the rest (e.g. 70 = 70% presence / 30% sign-up)')
      .setMinValue(0)
      .setMaxValue(100)
      .setRequired(true)));

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'role') {
    const role = interaction.options.getRole('role');
    settingsRepo.setMonitoredRoleId(role.id);
    await interaction.reply({
      ephemeral: true,
      content: `Tracked-member role set to **${role.name}**. Run \`/sync now\` to re-sync membership and stats with this change.`,
    });
    return;
  }

  if (sub === 'score-weight') {
    const presencePercent = interaction.options.getInteger('presence');
    settingsRepo.setScoreWeights(presencePercent / 100);
    await interaction.reply({
      ephemeral: true,
      content: `Global Score weighting set to **${presencePercent}% presence / ${100 - presencePercent}% sign-up**. Run \`/sync now\` to recompute the current period with this change.`,
    });
  }
}

module.exports = { data, execute };
