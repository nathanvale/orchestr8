export default [
  {
    name: 'Main bundle',
    path: 'dist/index.js',
    limit: '50 KB',
    gzip: true,
    webpack: false,
    running: false,
  },
  {
    name: 'ESM bundle',
    path: 'dist/index.mjs',
    limit: '50 KB',
    gzip: true,
    webpack: false,
    running: false,
  },
];
