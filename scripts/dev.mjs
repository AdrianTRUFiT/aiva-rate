import { spawn } from 'node:child_process';

/**
 * Runs the API server and the Vite dev server together, forwarding signals so
 * Ctrl-C stops both. Avoids a `&` in package.json, which leaves an orphaned
 * process behind on most shells.
 */
const procs = [
  ['api', 'npx', ['tsx', 'watch', 'server/index.ts']],
  ['web', 'npx', ['vite', '--port=3000', '--host=0.0.0.0']],
].map(([name, cmd, args]) => {
  const child = spawn(cmd, args, { stdio: 'inherit', env: process.env });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[dev] ${name} exited (${signal ?? code}) — stopping the other`);
      stop(code ?? 1);
    }
  });
  return child;
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of procs) p.kill('SIGTERM');
  setTimeout(() => process.exit(code), 300).unref();
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
