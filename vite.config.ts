import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const hash = createHash('sha256');
  const fingerprint = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) fingerprint(file);
      else { hash.update(path.relative(process.cwd(), file)); hash.update(readFileSync(file)); }
    }
  };
  fingerprint(path.resolve('src'));
  return {
    define: { __SIM_BUILD__: JSON.stringify(hash.digest('hex')) },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
