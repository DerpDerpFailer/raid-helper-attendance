const membersRepo = require('../db/repositories/membersRepo');
const settingsRepo = require('../db/repositories/settingsRepo');
const logger = require('../utils/logger');

/**
 * Whether a guild member currently counts as a "real" tracked member. If a monitored role was
 * configured via /setup role, that role is the sole signal (excludes bots, allies, and guests
 * automatically, since none of them hold it). Otherwise falls back to "not a bot account" — the
 * bot's behavior before /setup existed.
 */
function isTracked(member, monitoredRoleId) {
  if (monitoredRoleId) return member.roles.cache.has(monitoredRoleId);
  return !member.user.bot;
}

/**
 * Daily safety net for live role-change/leave events: re-derives tracked status for the whole
 * roster in case the bot missed an update (was offline). Idempotent — safe to run as often as
 * needed. Only resets a member's joined_at (tenure clock) when they transition from
 * not-tracked to tracked; an already-tracked member's tenure is left untouched.
 */
async function reconcileMembers(guild) {
  const roster = await guild.members.fetch();
  const monitoredRoleId = settingsRepo.getMonitoredRoleId();
  const now = new Date().toISOString();
  const trackedIds = new Set();

  for (const member of roster.values()) {
    if (!isTracked(member, monitoredRoleId)) continue;

    trackedIds.add(member.id);
    const displayName = member.displayName ?? member.user.username;
    const existing = membersRepo.getById(member.id);

    if (!existing || existing.is_active === 0) {
      // Newly (re)acquired tracked status since we last checked — tenure resets from now, since
      // Discord doesn't expose "when was this role assigned" for us to use instead.
      membersRepo.recordJoin(member.id, displayName, now, member.user.bot);
    } else {
      membersRepo.updateDisplayName(member.id, displayName);
    }
  }

  for (const localMember of membersRepo.getAll()) {
    if (localMember.is_active === 1 && !trackedIds.has(localMember.id)) {
      membersRepo.recordLeave(localMember.id, now);
      logger.info({ memberId: localMember.id }, 'Member marked as departed/untracked during reconciliation');
    }
  }

  logger.info({ rosterSize: roster.size, trackedCount: trackedIds.size }, 'Member reconciliation complete');
}

module.exports = { reconcileMembers, isTracked };
