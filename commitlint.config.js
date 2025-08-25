export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'build',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
        'chore',
      ],
    ],
    'subject-case': [2, 'never', ['pascal-case', 'start-case']],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 120],
    'header-max-length': [2, 'always', 100],
  },
};
