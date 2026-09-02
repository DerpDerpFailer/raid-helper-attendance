const membersRepo = require('../db/repositories/membersRepo');
const logger = require('../utils/logger');

/**
 * Daily safety net for guildMemberAdd/guildMemberRemove: re-syncs the full roster in case the
 * bot missed a live event (was offline). Idempotent — safe to run as often as needed.
 */
async function reconcileMembers(guild) {
  const roster = await guild.members.fetch();
  const currentIds = new Set();

  for (const member of roster.values()) {
    currentIds.add(member.id);
    membersRepo.recordJoin(
      member.id,
      member.displayName ?? member.user.username,
      member.joinedAt.toISOString()
    );
  }

  const now = new Date().toISOString();
  for (const localMember of membersRepo.getAll()) {
    if (localMember.is_active === 1 && !currentIds.has(localMember.id)) {
      membersRepo.recordLeave(localMember.id, now);
      logger.info({ memberId: localMember.id }, 'Member marked as departed during reconciliation');
    }
  }

  logger.info({ rosterSize: currentIds.size }, 'Member reconciliation complete');
}

module.exports = { reconcileMembers };
