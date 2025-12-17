// Empty stub for server-only modules that get imported in client bundles
// These modules (pino, thread-stream) are Node.js-only and shouldn't be bundled for the browser

// Create a no-op function for common logger patterns
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

// Export for CommonJS
module.exports = noopLogger
module.exports.default = noopLogger

// Export for ESM (if needed)
if (typeof exports !== 'undefined') {
  exports.default = noopLogger
}
