const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const settingsRepo = require('../../db/repositories/settingsRepo');

const PERIOD_MODE_CHOICES = [
  { name: 'Week (Monday-Sunday)', value: 'week' },
  { name: 'Calendar month', value: 'month' },
  { name: 'Rolling N-day window', value: 'rolling' },
];

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
      .setRequired(true)))
  .addSubcommand((sub) => sub
    .setName('period')
    .setDescription('Set the cadence used for rankings and /dropouts comparisons (default: week)')
    .addStringOption((opt) => opt
      .setName('mode')
      .setDescription('Period cadence')
      .setRequired(true)
      .addChoices(...PERIOD_MODE_CHOICES))
    .addIntegerOption((opt) => opt
      .setName('rolling-days')
      .setDescription('Window size in days — only used when mode is "Rolling N-day window" (default 30)')
      .setMinValue(1)
      .setMaxValue(365)))
  .addSubcommand((sub) => sub
    .setName('eligibility')
    .setDescription('Set the minimum tenure (days) before a member appears in rankings (default: 14)')
    .addIntegerOption((opt) => opt
      .setName('min-days')
      .setDescription('Minimum days of tenure required')
      .setMinValue(0)
      .setMaxValue(365)
      .setRequired(true)))
  .addSubcommand((sub) => sub
    .setName('dropout-thresholds')
    .setDescription('Set the /dropouts Alert/Critical thresholds (omit an option to leave it unchanged)')
    .addIntegerOption((opt) => opt
      .setName('alert-rank')
      .setDescription('Rank drop that triggers Alert (default 15)')
      .setMinValue(1))
    .addNumberOption((opt) => opt
      .setName('alert-score')
      .setDescription('Score drop that triggers Alert, 0-1 (default 0.15)')
      .setMinValue(0)
      .setMaxValue(1))
    .addIntegerOption((opt) => opt
      .setName('critical-rank')
      .setDescription('Rank drop that triggers Critical (default 30)')
      .setMinValue(1))
    .addNumberOption((opt) => opt
      .setName('critical-score')
      .setDescription('Score drop that triggers Critical, 0-1 (default 0.30)')
      .setMinValue(0)
      .setMaxValue(1)));

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
    return;
  }

  if (sub === 'period') {
    const mode = interaction.options.getString('mode');
    const rollingDays = interaction.options.getInteger('rolling-days');
    settingsRepo.setPeriodMode(mode);
    if (rollingDays !== null) settingsRepo.setPeriodRollingDays(rollingDays);

    const detail = mode === 'rolling' ? ` (${rollingDays ?? settingsRepo.getPeriodRollingDays()}-day window)` : '';
    await interaction.reply({
      ephemeral: true,
      content: `Period cadence set to **${mode}**${detail}. Run \`/sync now\` to recompute stats under the new cadence — note this starts a fresh comparison history for /dropouts (the previous period was computed under the old cadence).`,
    });
    return;
  }

  if (sub === 'eligibility') {
    const minDays = interaction.options.getInteger('min-days');
    settingsRepo.setEligibilityMinDays(minDays);
    await interaction.reply({
      ephemeral: true,
      content: `Ranking eligibility set to **${minDays}+ days** of tenure. Run \`/sync now\` to apply immediately.`,
    });
    return;
  }

  if (sub === 'dropout-thresholds') {
    const overrides = {
      alertRank: interaction.options.getInteger('alert-rank') ?? undefined,
      alertScore: interaction.options.getNumber('alert-score') ?? undefined,
      criticalRank: interaction.options.getInteger('critical-rank') ?? undefined,
      criticalScore: interaction.options.getNumber('critical-score') ?? undefined,
    };
    const changed = Object.values(overrides).some((v) => v !== undefined);
    if (changed) settingsRepo.setDropoutThresholds(overrides);

    const t = settingsRepo.getDropoutThresholds();
    await interaction.reply({
      ephemeral: true,
      content: [
        changed ? 'Dropout thresholds updated.' : 'Current dropout thresholds (nothing changed):',
        `Alert: rank drop ≥ ${t.alertRank} OR score drop ≥ ${t.alertScore}`,
        `Critical: rank drop ≥ ${t.criticalRank} OR score drop ≥ ${t.criticalScore}`,
      ].join('\n'),
    });
  }
}

module.exports = { data, execute };
