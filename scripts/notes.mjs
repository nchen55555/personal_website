// Password-protected notes.
//
// This repo is public, so plaintext notes never get committed. They live in the
// gitignored `src/notes/` folder and are committed only as an encrypted bundle
// (src/data/notes.enc.json), which the site decrypts in the browser once the
// visitor enters the password.
//
//   npm run notes:decrypt   bundle -> src/notes/*.md   (do this first in a fresh checkout)
//   npm run notes:encrypt   src/notes/*.md -> bundle   (then commit the bundle)
//
// The password comes from NOTES_PASSWORD (env or .env); otherwise you're prompted.
// To change it: decrypt with the old password, then encrypt with the new one and --force.
import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { marked } from 'marked';

const NOTES_DIR = new URL('../src/notes/', import.meta.url);
const BUNDLE = new URL('../src/data/notes.enc.json', import.meta.url);
const ITERATIONS = 600_000;

const [command, ...flags] = process.argv.slice(2);
const force = flags.includes('--force');

const fail = (msg) => {
  console.error(`notes: ${msg}`);
  process.exit(1);
};

async function getPassword() {
  if (process.env.NOTES_PASSWORD) return process.env.NOTES_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Notes password: ')).trim();
  rl.close();
  if (!answer) fail('no password given');
  return answer;
}

const deriveKey = (password, salt, iterations) =>
  pbkdf2Sync(password, salt, iterations, 32, 'sha256');

// Layout matches WebCrypto's AES-GCM output: iv (12) | ciphertext | tag (16).
function encrypt(key, plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]).toString('base64');
}

function decrypt(key, b64) {
  const buf = Buffer.from(b64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(buf.length - 16));
  return Buffer.concat([decipher.update(buf.subarray(12, buf.length - 16)), decipher.final()]).toString('utf8');
}

// Note URLs are derived from the key, so they can't be guessed from the title.
const slugFor = (key, file) =>
  createHash('sha256').update('slug:').update(key).update(file).digest('hex').slice(0, 16);

// Minimal frontmatter reader: `key: value` lines between --- fences.
function parseNote(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i === -1) continue;
      meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return { meta, body: match ? source.slice(match[0].length) : source };
}

const readBundle = () => (existsSync(BUNDLE) ? JSON.parse(readFileSync(BUNDLE, 'utf8')) : null);

// Returns the decrypted notes in a bundle, or null if the password doesn't fit.
function openBundle(bundle, password) {
  const key = deriveKey(password, Buffer.from(bundle.kdf.salt, 'base64'), bundle.kdf.iterations);
  try {
    return Object.values(bundle.notes).map((blob) => JSON.parse(decrypt(key, blob)));
  } catch {
    return null;
  }
}

async function runEncrypt() {
  const files = existsSync(NOTES_DIR) ? readdirSync(NOTES_DIR).filter((f) => f.endsWith('.md')).sort() : [];
  if (!files.length && !force) {
    fail('no src/notes/*.md found. Run `npm run notes:decrypt` first (or pass --force to publish an empty list).');
  }

  const password = await getPassword();
  const existing = readBundle();

  // Don't let a fresh checkout (empty src/notes/) silently drop notes that are already published.
  if (existing && !force) {
    const published = openBundle(existing, password);
    if (!published) {
      fail('password does not match the existing bundle. Pass --force if you are changing the password.');
    }
    const missing = published.map((n) => n.file).filter((f) => !files.includes(f));
    if (missing.length) {
      fail(`these published notes are not in src/notes/: ${missing.join(', ')}\n` +
        'Run `npm run notes:decrypt` to restore them, or pass --force to remove them.');
    }
  }

  // Reusing the salt keeps note URLs stable between runs (a new password gets a new salt).
  const samePassword = existing && openBundle(existing, password);
  const salt = samePassword ? Buffer.from(existing.kdf.salt, 'base64') : randomBytes(16);
  const key = deriveKey(password, salt, ITERATIONS);

  const notes = files.map((file) => {
    const source = readFileSync(new URL(file, NOTES_DIR), 'utf8');
    const { meta, body } = parseNote(source);
    return {
      file,
      slug: slugFor(key, file),
      title: meta.title ?? file.replace(/\.md$/, ''),
      date: meta.date ?? null,
      description: meta.description ?? null,
      source,
      html: marked.parse(body),
    };
  });
  // Newest first; undated notes (living docs like todo.md) stay pinned on top.
  const when = (note) => (note.date ? new Date(note.date).valueOf() : Infinity);
  notes.sort((a, b) => (when(a) === when(b) ? 0 : when(b) > when(a) ? 1 : -1));

  const bundle = {
    v: 1,
    kdf: { salt: salt.toString('base64'), iterations: ITERATIONS },
    index: encrypt(key, JSON.stringify(notes.map(({ slug, title, date, description }) => ({ slug, title, date, description })))),
    notes: Object.fromEntries(notes.map(({ slug, ...note }) => [slug, encrypt(key, JSON.stringify(note))])),
  };

  mkdirSync(new URL('./', BUNDLE), { recursive: true });
  writeFileSync(BUNDLE, JSON.stringify(bundle, null, 2) + '\n');
  console.log(`notes: encrypted ${notes.length} note(s) -> src/data/notes.enc.json`);
}

async function runDecrypt() {
  const bundle = readBundle();
  if (!bundle) fail('no bundle at src/data/notes.enc.json');
  const published = openBundle(bundle, await getPassword());
  if (!published) fail('wrong password');

  mkdirSync(NOTES_DIR, { recursive: true });
  for (const note of published) {
    const target = new URL(note.file, NOTES_DIR);
    if (existsSync(target) && readFileSync(target, 'utf8') !== note.source && !force) {
      console.log(`notes: kept local ${note.file} (differs from bundle; --force to overwrite)`);
      continue;
    }
    writeFileSync(target, note.source);
    console.log(`notes: wrote src/notes/${note.file}`);
  }
}

if (command === 'encrypt') await runEncrypt();
else if (command === 'decrypt') await runDecrypt();
else fail('usage: node scripts/notes.mjs <encrypt|decrypt> [--force]');
