/**
 * Commitlint Configuration for @orchestr8
 *
 * Enforces conventional commit format to ensure:
 * - Consistent commit messages across the team
 * - Automatic changeset generation works properly
 * - Clear project history and changelogs
 */

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type restrictions - only allow these commit types
    'type-enum': [
      2,
      'always',
      [
        'feat', // New features
        'fix', // Bug fixes
        'docs', // Documentation changes
        'style', // Code style changes (no logic changes)
        'refactor', // Code refactoring
        'perf', // Performance improvements
        'test', // Adding/updating tests
        'build', // Build system changes
        'ci', // CI/CD changes
        'chore', // Other changes that don't modify src or test files
        'revert', // Reverting changes
      ],
    ],

    // Scope restrictions - allow specific package names
    'scope-enum': [
      2,
      'always',
      [
        // Package scopes
        'core',
        'schema',
        'logger',
        'resilience',
        'cli',
        'agent-base',
        'testing',

        // General scopes
        'ci',
        'deps',
        'release',
        'docs',
        'examples',
        'scripts',
      ],
    ],

    // Subject line rules
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],

    // Header rules
    'header-max-length': [2, 'always', 100],

    // Body rules
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 100],

    // Footer rules
    'footer-leading-blank': [1, 'always'],
    'footer-max-line-length': [2, 'always', 100],
  },
}
