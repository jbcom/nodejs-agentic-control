// Commitlint configuration - enforce conventional commits
// We MANDATE this. No exceptions.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce conventional commit types
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only
        'style',    // Formatting, no code change
        'refactor', // Code change without feat/fix
        'perf',     // Performance improvement
        'test',     // Adding/fixing tests
        'build',    // Build system or dependencies
        'ci',       // CI/CD configuration
        'chore',    // Maintenance tasks
        'revert',   // Revert previous commit
        'deps',     // Dependency updates
      ],
    ],
    // Require scope for certain types
    'scope-empty': [0],
    // Subject rules
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    // Body rules
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 200],
    // Footer rules
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 200],
  },
  // Custom scopes for this repo
  helpUrl: 'https://www.conventionalcommits.org/',
};
