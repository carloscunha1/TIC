import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const prismaCliPath = require.resolve('prisma/build/index.js');
const backendRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../..');

export async function runDatabaseBootstrap(): Promise<void> {
  await runMigrations();
  await seedInitialAdmin();
}

async function runMigrations(): Promise<void> {
  try {
    await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: process.env,
    });
  } catch {
    throw new Error('Database migrations failed.');
  }
  log('database.migrations.completed');
}

async function seedInitialAdmin(): Promise<void> {
  if (process.env.ALLOW_INITIAL_ADMIN_SEED !== 'true') {
    log('admin.seed.disabled');
    return;
  }

  const name = process.env.INITIAL_ADMIN_NAME?.trim();
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!name || !email || !password || password.length < 12) {
    throw new Error('Initial admin seed requires name, email and a password with at least 12 characters.');
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    log('admin.seed.skipped_existing_users');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, role: 'ADMIN', status: 'ACTIVE' },
  });
  log('admin.seed.created');
}

function log(event: string): void {
  console.log(JSON.stringify({ event, level: 'info', timestamp: new Date().toISOString() }));
}
