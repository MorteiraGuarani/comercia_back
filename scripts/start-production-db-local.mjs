import { createConnection } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

const mode = process.argv[2] ?? 'all';
const validModes = new Set(['all', 'tunnel', 'api', 'web']);
const environmentPath = resolve('.env.production.local');
const confirmation = 'SI_ENTIENDO_QUE_ES_PRODUCCION';
const webPort = 3000;

if (!validModes.has(mode)) {
  console.error(
    'Modo inválido. Usá: npm run prod, npm run prod:tunnel, npm run prod:api o npm run prod:web.',
  );
  process.exit(1);
}

if (!existsSync(environmentPath)) {
  console.error(
    'Falta .env.production.local. Copia .env.production.local.example, completa sus valores locales y vuelve a intentar.',
  );
  process.exit(1);
}

const parsedEnvironment = parse(readFileSync(environmentPath));
const databaseUrl = parsedEnvironment.DATABASE_URL;
const tunnelPort = Number(parsedEnvironment.PROD_TUNNEL_PORT ?? 5435);
const apiPort = Number(parsedEnvironment.PORT ?? 3001);
const sshHost = parsedEnvironment.PROD_SSH_HOST ?? 'comercia';
const sshUser = parsedEnvironment.PROD_SSH_USER;
const sshPort = Number(parsedEnvironment.PROD_SSH_PORT ?? 22);
const sshTarget = sshUser ? `${sshUser}@${sshHost}` : sshHost;

if (
  parsedEnvironment.COMERCIA_PRODUCTION_DB_CONFIRMATION !== confirmation ||
  !databaseUrl
) {
  console.error(
    `Configura DATABASE_URL y COMERCIA_PRODUCTION_DB_CONFIRMATION=${confirmation} en .env.production.local.`,
  );
  process.exit(1);
}

if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) {
  console.error('PROD_SSH_PORT debe ser un puerto válido.');
  process.exit(1);
}

if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  console.error('PORT debe ser un puerto válido para NestJS.');
  process.exit(1);
}

if (apiPort === tunnelPort || apiPort === webPort) {
  console.error(
    `PORT=${apiPort} choca con el túnel SSH (:${tunnelPort}) o con Next.js (:${webPort}). NestJS usa 3001, Next.js 3000, túnel 5435.`,
  );
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error('DATABASE_URL no es una URL PostgreSQL válida.');
  process.exit(1);
}

const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
if (
  !['postgres:', 'postgresql:'].includes(parsedUrl.protocol) ||
  !allowedHosts.has(parsedUrl.hostname) ||
  Number(parsedUrl.port) !== tunnelPort
) {
  console.error(
    `DATABASE_URL debe apuntar a PostgreSQL mediante localhost:${tunnelPort}; el acceso directo a producción está bloqueado.`,
  );
  process.exit(1);
}

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const apiEnvironment = {
  ...process.env,
  ...parsedEnvironment,
  PORT: String(apiPort),
  COMERCIA_DATABASE_TARGET: 'production',
};
const webEnvironment = {
  ...process.env,
  PORT: String(webPort),
  NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}/api/v1`,
};
let closed = false;
let ownedTunnel;
let api;
let web;

function stop(child) {
  if (child && !child.killed) child.kill('SIGINT');
}

function finish(exitCode = 0) {
  if (closed) return;
  closed = true;
  stop(api);
  stop(web);
  stop(ownedTunnel);
  process.exit(exitCode);
}

function checkTunnel(waitForStart) {
  return new Promise((resolveTunnel, rejectTunnel) => {
    const deadline = Date.now() + (waitForStart ? 15_000 : 1_000);

    const attempt = () => {
      const socket = createConnection({ host: '127.0.0.1', port: tunnelPort });
      socket.once('connect', () => {
        socket.destroy();
        resolveTunnel();
      });
      socket.once('error', () => {
        if (Date.now() >= deadline) {
          rejectTunnel(
            new Error(
              waitForStart
                ? `El túnel SSH no abrió localhost:${tunnelPort} en 15 segundos.`
                : `No hay túnel SSH en localhost:${tunnelPort}. Ejecutá npm run prod:tunnel en otra terminal.`,
            ),
          );
          return;
        }
        setTimeout(attempt, 250);
      });
    };

    attempt();
  });
}

function verificarPuertoLibre(port, servicio) {
  return new Promise((resolvePort, rejectPort) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      rejectPort(
        new Error(
          `${servicio} no puede iniciarse: el puerto ${port} ya está en uso. Cerrá el proceso anterior con Ctrl+C antes de volver a ejecutar el comando.`,
        ),
      );
    });
    socket.once('error', () => resolvePort());
  });
}

function openTunnel() {
  ownedTunnel = spawn(
    'ssh',
    [
      '-N',
      '-L',
      `127.0.0.1:${tunnelPort}:127.0.0.1:5432`,
      '-p',
      String(sshPort),
      '-o',
      'ExitOnForwardFailure=yes',
      '-o',
      'ServerAliveInterval=30',
      sshTarget,
    ],
    { stdio: 'inherit' },
  );

  ownedTunnel.once('error', (error) => {
    console.error(`No se pudo iniciar SSH: ${error.message}`);
    finish(1);
  });
  ownedTunnel.once('exit', (code) => {
    if (!closed) {
      console.error(`El túnel SSH terminó inesperadamente (código ${code ?? 'desconocido'}).`);
      finish(1);
    }
  });
}

function spawnNpm(args, env) {
  return spawn(command, args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function startApi() {
  api = spawnNpm(['--prefix', 'apps/api', 'run', 'start:dev'], apiEnvironment);
  api.once('exit', (code) => {
    if (!closed) {
      console.error(`La API local terminó (código ${code ?? 'desconocido'}).`);
      finish(code ?? 1);
    }
  });
}

function startWeb() {
  web = spawnNpm(['--prefix', 'apps/web', 'run', 'dev'], webEnvironment);
  web.once('exit', (code) => {
    if (!closed) {
      console.error(`La web local terminó (código ${code ?? 'desconocido'}).`);
      finish(code ?? 1);
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => finish());
}

async function main() {
  if (mode === 'tunnel') {
    await verificarPuertoLibre(tunnelPort, 'El túnel SSH');
    openTunnel();
    await checkTunnel(true);
    console.log(`Túnel listo en localhost:${tunnelPort}. Dejá esta terminal abierta.`);
    return;
  }

  if (mode === 'api') {
    await checkTunnel(false);
    await verificarPuertoLibre(apiPort, 'NestJS');
    startApi();
    return;
  }

  if (mode === 'web') {
    await verificarPuertoLibre(webPort, 'Next.js');
    startWeb();
    return;
  }

  await verificarPuertoLibre(tunnelPort, 'El túnel SSH');
  await verificarPuertoLibre(apiPort, 'NestJS');
  await verificarPuertoLibre(webPort, 'Next.js');
  openTunnel();
  await checkTunnel(true);
  console.log(`Túnel listo en localhost:${tunnelPort}. Iniciando API y web locales...`);
  startApi();
  startWeb();
}

void main().catch((error) => {
  console.error(error.message);
  finish(1);
});
