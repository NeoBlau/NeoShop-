/**
 * The Khronos KTX command line tool.
 *
 * Texture work needs a real encoder: the WASM one the upload pipeline uses is
 * fine for one product model, and seven times slower than the native binary,
 * which matters when a location has four hundred textures. The binary is not
 * committed — it is fetched on first use, the same way the CC0 assets are.
 *
 * Khronos ships a different package per platform, so the fetch is platform
 * specific too: a .deb on Linux, a flat installer package on macOS. Neither is
 * installed system-wide — both are unpacked into apps/tools/.ktx and run from
 * there, so `make location` never asks for a password.
 */
import { execFile } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);

const VERSION = '4.4.0';
const RELEASE = `https://github.com/KhronosGroup/KTX-Software/releases/download/v${VERSION}`;

const HOME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.ktx');

export interface Ktx {
  /** Decodes any KTX2 to a PNG the rest of the pipeline can read. */
  decode: (input: string, output: string) => Promise<void>;
  /** Encodes a PNG to KTX2 with mipmaps. */
  encode: (input: string, output: string, args: string[]) => Promise<void>;
}

/** A ready binary plus whatever the environment needs to find its libktx. */
interface Native {
  binary: string;
  env: NodeJS.ProcessEnv;
}

async function fetchTo(asset: string): Promise<string> {
  const archive = path.join(HOME, asset);
  if (existsSync(archive)) return archive;

  mkdirSync(HOME, { recursive: true });
  const response = await fetch(`${RELEASE}/${asset}`);
  if (!response.ok || !response.body) {
    throw new Error(
      `Cannot fetch ${asset}: ${response.status} ${response.statusText}. ` +
        `Install KTX-Software ${VERSION} manually and put ktx on PATH instead.`,
    );
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
  return archive;
}

/** Depth-first search for a file, so component package names can stay unknown. */
function locate(root: string, leaf: string, depth = 8): string | null {
  if (depth === 0) return null;

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const found = locate(full, leaf, depth - 1);
      if (found) return found;
    } else if (entry.name === leaf) {
      return full;
    }
  }

  return null;
}

/**
 * The macOS package is a flat installer: a xar archive of component packages,
 * each holding a gzipped cpio payload. `pkgutil --expand-full` is part of the
 * system and unpacks all of it without root, which `installer` would demand.
 */
async function installDarwin(): Promise<Native> {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
  const expanded = path.join(HOME, `darwin-${arch}`);
  const binary = path.join(expanded, 'bin/ktx');

  if (!existsSync(binary)) {
    const archive = await fetchTo(`KTX-Software-${VERSION}-Darwin-${arch}.pkg`);
    const raw = path.join(HOME, `pkg-${arch}`);
    rmSync(raw, { recursive: true, force: true });
    await run('pkgutil', ['--expand-full', archive, raw]);

    const unpackedBinary = locate(raw, 'ktx');
    const unpackedLibrary = locate(raw, 'libktx.4.dylib');
    if (!unpackedBinary || !unpackedLibrary) {
      throw new Error(
        `The KTX package did not unpack a ktx binary and libktx under ${raw}. ` +
          `Open ${archive} in Finder to install it the usual way — ` +
          `it puts ktx on PATH, which this build prefers anyway.`,
      );
    }

    // The binary asks for @rpath/libktx.4.dylib and carries @executable_path as
    // an rpath, so the library only has to sit next to it. That beats
    // DYLD_LIBRARY_PATH, which a hardened runtime is free to ignore.
    mkdirSync(path.dirname(binary), { recursive: true });
    copyFileSync(unpackedBinary, binary);
    copyFileSync(realpathSync(unpackedLibrary), path.join(expanded, 'bin/libktx.4.dylib'));
    chmodSync(binary, 0o755);
    rmSync(raw, { recursive: true, force: true });
  }

  return { binary, env: { ...process.env } };
}

/** The .deb keeps libktx beside the binary rather than on the system path. */
async function installLinux(): Promise<Native> {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
  const binary = path.join(HOME, 'usr/bin/ktx');

  if (!existsSync(binary)) {
    const archive = await fetchTo(`KTX-Software-${VERSION}-Linux-${arch}.deb`);
    try {
      await run('dpkg', ['-x', archive, HOME]);
    } catch (cause) {
      throw new Error(
        `Cannot unpack ${path.basename(archive)}: dpkg is not available. ` +
          `Install KTX-Software ${VERSION} through your package manager and put ktx on PATH.`,
        { cause },
      );
    }
  }

  return {
    binary,
    env: { ...process.env, LD_LIBRARY_PATH: path.join(HOME, 'usr/lib') },
  };
}

/** Anything already on PATH wins: a system install is nobody's business to replace. */
async function fromPath(): Promise<Native | null> {
  try {
    await run('ktx', ['--version']);
    return { binary: 'ktx', env: { ...process.env } };
  } catch {
    return null;
  }
}

async function install(): Promise<Native> {
  const existing = await fromPath();
  if (existing) return existing;

  if (process.platform === 'darwin') return installDarwin();
  if (process.platform === 'linux') return installLinux();

  throw new Error(
    `No automatic KTX-Software install for ${process.platform}. ` +
      `Install version ${VERSION} from https://github.com/KhronosGroup/KTX-Software/releases ` +
      `and make sure ktx is on PATH.`,
  );
}

export async function ensureKtx(): Promise<Ktx> {
  const { binary, env } = await install();

  if (binary !== 'ktx' && !existsSync(binary)) {
    throw new Error(`The KTX tools did not unpack to ${binary}`);
  }

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
