#!/usr/bin/env node
/** Run by the user only. Prints a bcrypt hash; the password itself is never echoed or stored. */
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { pathToFileURL } from 'node:url'
import bcrypt from 'bcryptjs'

/** Non-echoing password read. Injectable streams keep this testable without a TTY. */
export async function readPassword(input = process.stdin, output = process.stdout) {
  output.write('Password: ')

  if (input.isTTY && typeof input.setRawMode === 'function') {
    const wasRaw = input.isRaw
    input.setRawMode(true)
    input.resume()
    return new Promise((resolve, reject) => {
      let value = ''
      const cleanup = () => {
        input.off('data', onData)
        input.setRawMode(wasRaw)
        input.pause()
      }
      const onData = (chunk) => {
        for (const ch of chunk.toString('utf8')) {
          if (ch === '\r' || ch === '\n') {
            cleanup(); output.write('\n'); resolve(value); return
          }
          if (ch === '\u0003') {
            cleanup(); output.write('\n'); reject(new Error('Password input cancelled')); return
          }
          if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
          else value += ch
        }
      }
      input.on('data', onData)
    })
  }

  // Non-interactive input (pipes, tests): readline with a silent writer adds no echo.
  const rl = readline.createInterface({ input, output: { write() {} }, terminal: false })
  try {
    return await rl.question('')
  } finally {
    rl.close()
  }
}

export async function hashPassword(password, cost) {
  return bcrypt.hash(password, cost)
}

async function main() {
  const cost = Number(process.env.VD_BCRYPT_COST || 8)
  if (!Number.isInteger(cost) || cost < 4 || cost > 12) {
    throw new Error('VD_BCRYPT_COST harus integer antara 4 dan 12')
  }
  const password = await readPassword(input, output)
  if (!password) throw new Error('Password tidak boleh kosong')
  const hash = await hashPassword(password, cost)
  output.write(`\nBCRYPT_HASH=${hash}\n`)
  output.write('Salin hash ini ke VD_SEED_HASH di file .env Anda.\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
