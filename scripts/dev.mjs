import { spawn } from 'node:child_process';
const windows = process.platform === 'win32';
const children = ['dev:server', 'dev:web'].map(name => spawn(windows ? 'npm.cmd' : 'npm', ['run', name], { stdio: 'inherit', detached: !windows }));
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try { if (windows) child.kill('SIGTERM'); else process.kill(-child.pid, 'SIGTERM'); } catch { /* Already stopped. */ }
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
for (const child of children) child.once('exit', code => { if (!stopping) process.exitCode = code ?? 1; stop(); });
