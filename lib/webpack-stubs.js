const noop = () => {}
const noopLogger = {
  info: noop,
  error: noop,
  warn: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
  child: () => noopLogger,
  level: 'silent',
}

module.exports = noopLogger
module.exports.default = noopLogger

if (typeof exports !== 'undefined') {
  exports.default = noopLogger
}
