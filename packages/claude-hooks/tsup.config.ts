import { createTsupConfig } from '../../tooling/build/tsup.base.js'

export default createTsupConfig({
  entry: [
    // Main exports
    'src/index.ts',
    'src/types/index.ts',
    'src/config/config-schema.ts',
    'src/speech/index.ts',
    'src/audio/index.ts',
    'src/utils/auto-config.ts',
    'src/quality-check/index.ts',
    // Binary executables
    'src/bin/claude-hooks-cache-explorer.ts',
    'src/bin/claude-hooks-cache-stats.ts',
    'src/bin/claude-hooks-list-voices.ts',
    'src/bin/claude-hooks-notification.ts',
    'src/bin/claude-hooks-quality.ts',
    'src/bin/claude-hooks-stop.ts',
    'src/bin/claude-hooks-subagent.ts',
  ],
})
