const membersRepo = require('../db/repositories/membersRepo');
const settingsRepo = require('../db/repositories/settingsRepo');
const { isTracked } = require('../scheduler/reconcileMembers');
const logger = require('../utils/logger');

/** Live-updates the local member table the moment Discord reports a join/role-change/leave. */
function registerMemberEvents(client) {
  client.on('guildMemberAdd', (member) => {
    const monitoredRoleId = settingsRepo.getMonitoredRoleId();
    // With a monitored role configured, a fresh join has no roles yet — wait for the
    // guildMemberUpdate that assigns it instead of tracking them from raw join.
    if (monitoredRoleId) return;
    if (member.user.bot) return;

    membersRepo.recordJoin(
      member.id,
      member.displayName ?? member.user.username,
      (member.joinedAt ?? new Date()).toISOString(),
      member.user.bot
    );
    logger.info({ memberId: member.id }, 'Member joined');
  });

  client.on('guildMemberUpdate', (oldMember, newMember) => {
    const monitoredRoleId = settingsRepo.getMonitoredRoleId();
    if (!monitoredRoleId) return; // no role configured: tracked status doesn't depend on roles

    const wasTracked = isTracked(oldMember, monitoredRoleId);
    const nowTracked = isTracked(newMember, monitoredRoleId);
    if (wasTracked === nowTracked) return;

    const now = new Date().toISOString();
    const displayName = newMember.displayName ?? newMember.user.username;

    if (nowTracked) {
      membersRepo.recordJoin(newMember.id, displayName, now, newMember.user.bot);
      logger.info({ memberId: newMember.id }, 'Member gained the tracked role');
    } else {
      membersRepo.recordLeave(newMember.id, now);
      logger.info({ memberId: newMember.id }, 'Member lost the tracked role');
    }
  });

  client.on('guildMemberRemove', (member) => {
    membersRepo.recordLeave(member.id, new Date().toISOString());
    logger.info({ memberId: member.id }, 'Member left');
  });
}

module.exports = { registerMemberEvents };
