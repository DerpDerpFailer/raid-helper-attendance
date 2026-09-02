const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../../db/connection');
const syncStateRepo = require('../../db/repositories/syncStateRepo');
const { pollEvents } = require('../../scheduler/pollEvents');
const { snapshotStats } = require('../../scheduler/snapshotStats');
const logger = require('../../utils/logger');

const data = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Admin: inspect or trigger the Raid-Helper sync')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) => sub.setName('status').setDescription('Show the current sync status'))
  .addSubcommand((sub) => sub.setName('now').setDescription('Force an immediate poll + stats recompute'));

function getCounts() {
  const db = getDb();
  const events = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
  const members = db.prepare('SELECT COUNT(*) AS n FROM members WHERE is_active = 1').get().n;
  return { events, members };
}

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'status') {
    const { events, members } = getCounts();
    await interaction.reply({
      ephemeral: true,
      content: [
        `Backfill done: ${syncStateRepo.get('backfill_done') === 'true' ? 'yes' : 'no'}`,
        `Last poll: ${syncStateRepo.get('last_poll_at') ?? 'never'}`,
        `Events tracked: ${events}`,
        `Active members: ${members}`,
      ].join('\n'),
    });
    return;
  }

  // sub === 'now'
  await interaction.deferReply({ ephemeral: true });
  try {
    await pollEvents();
    const { current } = snapshotStats();
    await interaction.editReply(`Sync complete — current period: ${current.label}.`);
  } catch (err) {
    logger.error({ err: err.message }, '/sync now failed');
    await interaction.editReply('Sync failed — check the bot logs for details.');
  }
}

module.exports = { data, execute };
