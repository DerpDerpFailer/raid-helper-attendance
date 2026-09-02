const top = require('./top');
const flop = require('./flop');
const stats = require('./stats');
const dropouts = require('./dropouts');
const sync = require('./sync');
const setup = require('./setup');

const commands = [top, flop, stats, dropouts, sync, setup];

module.exports = { commands };
