const top = require('./top');
const flop = require('./flop');
const stats = require('./stats');
const dropouts = require('./dropouts');
const nosignup = require('./nosignup');
const sync = require('./sync');
const setup = require('./setup');

const commands = [top, flop, stats, dropouts, nosignup, sync, setup];

module.exports = { commands };
