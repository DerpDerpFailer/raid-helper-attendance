const top = require('./top');
const flop = require('./flop');
const stats = require('./stats');
const dropouts = require('./dropouts');
const sync = require('./sync');

const commands = [top, flop, stats, dropouts, sync];

module.exports = { commands };
