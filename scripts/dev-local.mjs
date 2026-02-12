import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import net from 'node:net';

const viteArgs = process.argv.slice(2);
const viteCli = resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const apiPort = Number(process.env.LOCAL_API_PORT || 8787);

const isPortOpen = (port) =>
  new Promise((resolveOpen) => {
    const socket = new net.Socket();
    const onDone = (open) => {
      socket.destroy();
      resolveOpen(open);
    };

    socket.setTimeout(600);
    socket.once('error', () => onDone(false));
    socket.once('timeout', () => onDone(false));
    socket.connect(port, '127.0.0.1', () => onDone(true));
  });

const main = async () => {
  const apiAlreadyRunning = await isPortOpen(apiPort);
  const apiProcess = apiAlreadyRunning
    ? null
    : spawn(process.execPath, ['local-api/server.mjs'], {
        stdio: 'inherit',
        env: process.env,
      });

  const webProcess = spawn(process.execPath, [viteCli, ...viteArgs], {
    stdio: 'inherit',
    env: process.env,
  });

  let isShuttingDown = false;

  const shutdown = (code = 0) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (apiProcess && !apiProcess.killed) apiProcess.kill();
    if (!webProcess.killed) webProcess.kill();

    process.exit(code);
  };

  if (apiProcess) {
    apiProcess.on('exit', (code) => {
      if (!isShuttingDown) {
        shutdown(code ?? 1);
      }
    });
  }

  webProcess.on('exit', (code) => {
    if (!isShuttingDown) {
      shutdown(code ?? 0);
    }
  });

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
};

void main();
