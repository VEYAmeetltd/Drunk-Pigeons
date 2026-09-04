// Root-level ESLint v9 flat config: re-uses the frontend config so the
// pre-completion linter (which runs from /app) can find a config file too.
const base = require('./frontend/eslint.config.js');

module.exports = base
  .map((cfg) => (cfg.files ? { ...cfg, files: cfg.files.map((f) => `frontend/${f}`) } : cfg))
  .concat([{ ignores: ['**/node_modules/**', 'backend/**', 'tests/**', 'frontend/web-build/**', 'frontend/.expo/**', 'frontend/dist/**', 'eslint.config.js'] }]);
