const { Events } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const { migrate } = require('./db/migrate');
const { createClient } = require('./discord/client');
const { registerMemberEvents } = require('./discord/memberEvents');
const { registerInteractionHandler } = require('./discord/interactionHandler');
const { runBackfill } = require('./sync/backfill');
const scheduler = require('./scheduler');

async function main() {
  migrate();
  logger.info('Database ready');

  const client = createClient();
  registerMemberEvents(client);
  registerInteractionHandler(client);

  client.once(Events.ClientReady, async () => {
    logger.info({ tag: client.user.tag }, 'Discord bot logged in');

    try {
      await runBackfill();
    } catch (err) {
      logger.error({ err: err.message }, 'Backfill failed, will retry on next manual /sync now');
    }

    scheduler.start(client);
  });

  await client.login(config.discord.token);
}

main().catch((err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Fatal error during startup');
  process.exit(1);
});
