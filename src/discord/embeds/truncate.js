// Discord embed descriptions cap at 4096 chars. A large tie block (rankings) or a large batch of
// simultaneous dropouts can occasionally produce more lines than expected. Truncate defensively
// so that can never crash a reply — an honest "+N more" beats a failed interaction.
const MAX_DESCRIPTION_LENGTH = 3900;

function buildDescription(lines, maxLength = MAX_DESCRIPTION_LENGTH) {
  let result = '';
  for (const [i, line] of lines.entries()) {
    const candidate = result ? `${result}\n${line}` : line;
    if (candidate.length > maxLength) {
      return `${result}\n*(+${lines.length - i} more, truncated to fit)*`;
    }
    result = candidate;
  }
  return result;
}

module.exports = { buildDescription };
