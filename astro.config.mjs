import { defineConfig } from 'astro/config';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const notesDir = resolve(root, 'src/notes');

function notesAutoEncrypt() {
  let watcher;
  return {
    name: 'notes-auto-encrypt',
    configureServer(server) {
      watcher = server.watcher;
      const reencrypt = (path) => {
        if (!path.startsWith(notesDir) || !path.endsWith('.md')) return;
        try {
          execFileSync('node', ['scripts/notes.mjs', 'encrypt', '--force'], {
            cwd: root,
            env: { ...process.env },
            stdio: 'inherit',
          });
        } catch {}
      };
      watcher.add(notesDir);
      watcher.on('change', reencrypt);
      watcher.on('add', reencrypt);
      watcher.on('unlink', reencrypt);
    },
  };
}

// https://astro.build/config
export default defineConfig({
  vite: { plugins: [notesAutoEncrypt()] },
});
