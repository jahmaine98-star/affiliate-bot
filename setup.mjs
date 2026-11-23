// One-step launcher: creates .env, installs, starts the server and opens the page.
import fs from 'node:fs';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { spawn, spawnSync } from 'node:child_process';

const major = Number(process.versions.node.split('.')[0]);
if (major < 20) { console.error(`Node 20 or newer is needed (you have ${process.versions.node}). Get it at https://nodejs.org`); process.exit(1); }

const rand = () => crypto.randomBytes(24).toString('hex');
const setVar = (text, key, val) => {
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(text) ? text.replace(re, `${key}=${val}`) : text.trimEnd() + `\n${key}=${val}\n`;
};
const getVar = (text, key) => (text.match(new RegExp(`^${key}=(.*)$`, 'm')) || [, ''])[1].trim();

let env;
if (!fs.existsSync('.env')) {
  env = fs.readFileSync('.env.example', 'utf8');
  env = setVar(env, 'ADMIN_TOKEN', rand());
  env = setVar(env, 'POSTBACK_SECRET', rand());
  fs.writeFileSync('.env', env);
  console.log('Created .env with a new random admin token.');
} else env = fs.readFileSync('.env', 'utf8');

if (/change-me/.test(getVar(env, 'ADMIN_TOKEN')) || !getVar(env, 'ADMIN_TOKEN')) {
  env = setVar(env, 'ADMIN_TOKEN', rand()); fs.writeFileSync('.env', env);
}

if (!getVar(env, 'ANTHROPIC_API_KEY') && process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const key = await new Promise(r => rl.question('\nPaste your Anthropic API key for the agents and Team review (or press Enter to skip): ', r));
  rl.close();
  if (key.trim()) { env = setVar(env, 'ANTHROPIC_API_KEY', key.trim()); fs.writeFileSync('.env', env); console.log('Saved the key to .env.'); }
  else console.log('Skipped. Agents stay off until you add ANTHROPIC_API_KEY to .env.');
}

if (!fs.existsSync('node_modules')) {
  console.log('\nInstalling (first run only)...');
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { stdio: 'inherit', shell: true });
  if (r.status !== 0) { console.error('npm install failed. Check your internet connection and try again.'); process.exit(1); }
}

const port = getVar(env, 'PORT') || '3000';
const url = `http://localhost:${port}`;
const token = getVar(env, 'ADMIN_TOKEN');
console.log(`\n==============================================\n Commission Desk is starting at ${url}\n Admin token (paste it when the page asks):\n ${token}\n Press Ctrl+C in this window to stop it.\n==============================================\n`);

const child = spawn(process.execPath, ['server.js'], { stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
setTimeout(() => {
  const p = process.platform;
  try {
    if (p === 'win32') spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
    else spawn(p === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {}
}, 1800);
