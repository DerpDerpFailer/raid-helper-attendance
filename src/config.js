require('dotenv').config();

const PERIOD_MODES = ['week', 'month', 'rolling'];

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

const periodMode = process.env.PERIOD_MODE || 'week';
if (!PERIOD_MODES.includes(periodMode)) {
  throw new Error(`PERIOD_MODE must be one of ${PERIOD_MODES.join(', ')}, got: ${periodMode}`);
}

const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: required('DISCORD_GUILD_ID'),
  },
  raidHelper: {
    apiKey: required('RAIDHELPER_API_KEY'),
    serverId: required('RAIDHELPER_SERVER_ID'),
    baseUrl: 'https://raid-helper.xyz/api/v4',
  },
  sync: {
    pollIntervalMinutes: int('POLL_INTERVAL_MINUTES', 20),
  },
  stats: {
    periodMode,
    periodRollingDays: int('PERIOD_ROLLING_DAYS', 30),
    eligibilityMinDays: int('ELIGIBILITY_MIN_DAYS', 14),
    topFlopSize: int('TOP_FLOP_SIZE', 10),
  },
  db: {
    path: process.env.DB_PATH || './data/bot.sqlite',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
