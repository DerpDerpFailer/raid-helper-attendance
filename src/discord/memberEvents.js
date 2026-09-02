const membersRepo = require('../db/repositories/membersRepo');
const logger = require('../utils/logger');

/** Live-updates the local member table the moment Discord reports a join/leave. */
function registerMemberEvents(client) {
  client.on('guildMemberAdd', (member) => {
    membersRepo.recordJoin(
      member.id,
      member.displayName ?? member.user.username,
      (member.joinedAt ?? new Date()).toISOString()
    );
    logger.info({ memberId: member.id }, 'Member joined');
  });

  client.on('guildMemberRemove', (member) => {
    membersRepo.recordLeave(member.id, new Date().toISOString());
    logger.info({ memberId: member.id }, 'Member left');
  });
}

module.exports = { registerMemberEvents };
