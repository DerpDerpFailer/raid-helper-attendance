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
  }
}

module.exports = { data, execute };
