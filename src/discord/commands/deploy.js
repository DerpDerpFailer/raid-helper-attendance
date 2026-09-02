const { REST, Routes } = require('discord.js');
const config = require('../../config');
const logger = require('../../utils/logger');
const { commands } = require('./index');

/** Registers every slash command, scoped to the configured guild (instant propagation). */
async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const body = commands.map((c) => c.data.toJSON());

  await rest.put(
    Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
    { body }
  );

  logger.info({ count: body.length }, 'Slash commands deployed');
}

if (require.main === module) {
  deployCommands().catch((err) => {
    logger.error({ err: err.message }, 'Failed to deploy slash commands');
    process.exit(1);
  });
}

module.exports = { deployCommands };
