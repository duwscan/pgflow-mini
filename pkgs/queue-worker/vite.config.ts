import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import dts from 'vite-plugin-dts';
import { join } from 'path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/pkgs/queue-worker',
  plugins: [
    nxViteTsPaths(),
    dts({
      entryRoot: 'src',
      tsconfigPath: join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'queue-worker',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['postgres', '@henrygd/queue'],
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/pkgs/queue-worker',
      provider: 'v8',
    },
  },
});
