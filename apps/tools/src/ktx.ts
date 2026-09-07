/**
 * The Khronos KTX command line tool.
 *
 * Texture work needs a real encoder: the WASM one the upload pipeline uses is
 * fine for one product model, and seven times slower than the native binary,
 * which matters when a location has four hundred textures. The binary is not
 * committed — it is fetched on first use, the same way the CC0 assets are.
 */
import { execFile } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);

const VERSION = '4.4.0';
const DEB = `KTX-Software-${VERSION}-Linux-x86_64.deb`;
const URL = `https://github.com/KhronosGroup/KTX-Software/releases/download/v${VERSION}/${DEB}`;

const HOME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.ktx');

export interface Ktx {
  /** Decodes any KTX2 to a PNG the rest of the pipeline can read. */
  decode: (input: string, output: string) => Promise<void>;
  /** Encodes a PNG to KTX2 with mipmaps. */
  encode: (input: string, output: string, args: string[]) => Promise<void>;
}

async function download(): Promise<void> {
  const archive = path.join(HOME, DEB);
  mkdirSync(HOME, { recursive: true });

  const response = await fetch(URL);
  if (!response.ok || !response.body) {
    throw new Error(`Cannot fetch the KTX tools: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
  await run('dpkg', ['-x', archive, HOME]);
}

export async function ensureKtx(): Promise<Ktx> {
  const binary = path.join(HOME, 'usr/bin/ktx');
  if (!existsSync(binary)) await download();

  if (!existsSync(binary)) {
    throw new Error(`The KTX tools did not unpack to ${binary}`);
  }

  // The .deb keeps libktx beside the binary rather than on the system path.
  const env = { ...process.env, LD_LIBRARY_PATH: path.join(HOME, 'usr/lib') };
  // A texture is a few megabytes of raw pixels on stdout in the worst case.
  const options = { env, maxBuffer: 64 * 1024 * 1024 };

  return {
    decode: async (input, output) => {
      await run(
        binary,
        ['extract', '--transcode', 'rgba8', '--level', '0', input, output],
        options,
      );
    },
    encode: async (input, output, args) => {
      await run(binary, ['create', ...args, input, output], options);
    },
  };
}
