const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { revokeAllAdminSessions } = require('../src/lib/adminSessions');

function validatePassword(password) {
  const problems = [];
  if (password.length < 12) problems.push('at least 12 characters');
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
  if (!/\d/.test(password)) problems.push('a number');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('a symbol');
  return problems;
}

function updateEnvContent(content, values) {
  let result = content.replace(/\r\n/g, '\n');
  for (const [key, rawValue] of Object.entries(values)) {
    const value = String(rawValue).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const line = `${key}="${value}"`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    result = pattern.test(result)
      ? result.replace(pattern, line)
      : `${result.replace(/\s*$/, '')}\n${line}\n`;
  }
  return result.replace(/\n/g, process.platform === 'win32' ? '\r\n' : '\n');
}

function promptLine(label, defaultValue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${label} [${defaultValue}]: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

function promptMasked(label) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('Run this command in an interactive Command Prompt or PowerShell window.'));
      return;
    }

    let value = '';
    output.write(label);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();

    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          output.write('\n');
          reject(new Error('Password setup cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          output.write('\n');
          resolve(value);
          return;
        }
        if (character === '\b' || character === '\u007f') {
          if (value.length) {
            value = value.slice(0, -1);
            output.write('\b \b');
          }
          continue;
        }
        if (character >= ' ') {
          value += character;
          output.write('*');
        }
      }
    };

    input.on('data', onData);
  });
}

async function revokeSessionsForPasswordRotation() {
  const prisma = new PrismaClient();
  try {
    return await revokeAllAdminSessions(prisma, 'admin', 'PASSWORD_ROTATED');
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('backend/.env does not exist. Copy .env.example first.');
  }

  dotenv.config({ path: envPath });
  const defaultEmail = process.env.ADMIN_EMAIL || 'admin@college.edu';
  const email = await promptLine('Admin email', defaultEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid administrator email address.');
  }

  const password = await promptMasked('New admin password: ');
  const problems = validatePassword(password);
  if (problems.length) {
    throw new Error(`Password must contain ${problems.join(', ')}.`);
  }

  const confirmation = await promptMasked('Confirm admin password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  const hash = await bcrypt.hash(password, 12);
  const revokedSessions = await revokeSessionsForPasswordRotation();
  const current = fs.readFileSync(envPath, 'utf8');
  const updated = updateEnvContent(current, {
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD_HASH: hash,
  });
  fs.writeFileSync(envPath, updated, { encoding: 'utf8', mode: 0o600 });

  console.log('Admin credentials updated in backend/.env.');
  console.log('Revoked ' + revokedSessions.count + ' active administrator session(s).');
  console.log('Restart the backend before testing administrator login.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Admin setup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { revokeSessionsForPasswordRotation, validatePassword, updateEnvContent };
