import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const alias = (dir: string) => fileURLToPath(new URL(dir, import.meta.url));

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@engine': alias('./shared/engine'),
      '@bundle': alias('./shared/bundle'),
      '@parsers': alias('./shared/parsers'),
      '@plans': alias('./shared/plans'),
      '@fixtures': alias('./shared/fixtures'),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    env: loadEnv(mode, process.cwd(), ''),
    fileParallelism: false,   // the suites share one project and each cleans up its tagged rows
    testTimeout: 200_000,
  },
}));
