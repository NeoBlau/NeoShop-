/**
 * The street's sound bed.
 *
 *   pnpm --filter @3dsfera/tools run gen:ambience
 *
 * Synthesised rather than downloaded, for the same reason the material library
 * is: a recording with a licence that needs tracking becomes a liability the
 * moment the project has customers, and the free-with-attribution libraries are
 * behind sign-ins that a build script cannot pass. What a city sounds like from
 * a pavement is mostly filtered noise anyway — a low rumble that never stops,
 * a mid hiss, and cars that arrive, pass and leave.
 *
 * Deterministic: one seed, the same bytes every run, so the asset need not be
 * committed. Replacing it with a real recording is a matter of dropping a file
 * in its place — nothing else knows how it was made.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../web/public/world/audio',
);

const RATE = 22_050;
/** Long enough that the ear stops recognising the repeat. */
const SECONDS = 24;
/** Folded back into the start so the loop has no seam. */
const CROSSFADE_SECONDS = 2;
const CHANNELS = 2;
const SEED = 0x5f3e1a7b;

/** xorshift32: the same sequence on every machine, unlike Math.random. */
function random(seed: number): () => number {
  let state = seed | 0;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 0xffffff) / 0xffffff;
  };
}

/** One-pole low-pass. Cheap, and the right shape for distance. */
function lowPass(cutoff: number): (sample: number) => number {
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let previous = 0;

  return (sample) => {
    previous += alpha * (sample - previous);
    return previous;
  };
}

function highPass(cutoff: number): (sample: number) => number {
  const low = lowPass(cutoff);
  return (sample) => sample - low(sample);
}

/** A band is two poles in series; two passes each keeps the skirts steep. */
function bandPass(low: number, high: number): (sample: number) => number {
  const lp1 = lowPass(high);
  const lp2 = lowPass(high);
  const hp1 = highPass(low);
  const hp2 = highPass(low);
  return (sample) => hp2(hp1(lp2(lp1(sample))));
}

interface PassBy {
  /** Seconds into the loop when the vehicle is level with the listener. */
  at: number;
  /** Seconds from first audible to gone. */
  length: number;
  /** -1 arrives from the left, +1 from the right. */
  from: number;
  loudness: number;
  /** Centre of its noise band: a van rumbles, a scooter whines. */
  centre: number;
}

/**
 * Traffic, as a schedule rather than a random sprinkle: an even spread with a
 * little jitter sounds like a street, whereas independent random times clump
 * into silence and then four cars at once.
 */
function schedule(next: () => number): PassBy[] {
  const events: PassBy[] = [];
  const gap = 4.2;

  for (let at = 1.5; at < SECONDS; at += gap * (0.65 + next() * 0.8)) {
    const scooter = next() < 0.3;

    events.push({
      at,
      length: scooter ? 2.2 + next() : 3.4 + next() * 1.8,
      from: next() < 0.5 ? -1 : 1,
      loudness: scooter ? 0.1 + next() * 0.06 : 0.14 + next() * 0.1,
      centre: scooter ? 900 + next() * 500 : 260 + next() * 260,
    });
  }

  return events;
}

function synthesise(): Float32Array[] {
  const total = Math.floor(RATE * (SECONDS + CROSSFADE_SECONDS));
  const left = new Float32Array(total);
  const right = new Float32Array(total);

  const next = random(SEED);
  const events = schedule(next);

  // The bed: brown noise for the rumble that a city never stops making, and a
  // separate mid band for the hiss of tyres on asphalt. Two independent noise
  // sources per channel, or the result collapses into a mono wall.
  const beds = [left, right].map(() => {
    let brown = 0;
    return {
      rumble: lowPass(190),
      hiss: bandPass(520, 3200),
      murmur: bandPass(180, 1100),
      brownStep: (white: number): number => {
        brown = brown * 0.985 + white * 0.015;
        return brown;
      },
    };
  });

  // Crowd murmur comes and goes on its own slow clock; without that it reads as
  // tape hiss rather than as people somewhere out of sight.
  const murmurPhase = next() * Math.PI * 2;

  for (let index = 0; index < total; index += 1) {
    const time = index / RATE;
    const drift = 0.82 + 0.18 * Math.sin(time * 0.11 + 1.2) * Math.sin(time * 0.037);
    const murmurLevel = 0.5 + 0.5 * Math.sin(time * 0.19 + murmurPhase);

    for (const [channel, bed] of beds.entries()) {
      const white = next() * 2 - 1;
      const sample =
        bed.rumble(bed.brownStep(white) * 26) * 0.55 * drift +
        bed.hiss(white) * 0.055 * drift +
        bed.murmur(white) * 0.03 * murmurLevel;

      if (channel === 0) left[index] = sample;
      else right[index] = sample;
    }
  }

  // Pass-bys are written on top of the bed, each with its own filter state: a
  // vehicle is a band of noise that rises, briefly dominates, and falls, moving
  // across the stereo field as it goes.
  for (const event of events) {
    const start = Math.floor((event.at - event.length / 2) * RATE);
    const samples = Math.floor(event.length * RATE);
    const band = bandPass(event.centre * 0.5, event.centre * 3);
    const passNoise = random(SEED ^ Math.floor(event.at * 1000));

    for (let offset = 0; offset < samples; offset += 1) {
      const index = start + offset;
      if (index < 0 || index >= total) continue;

      const progress = offset / samples;
      // Sharper after the vehicle is level than before: that asymmetry is what
      // makes it read as approaching rather than as a fade in and out.
      const envelope =
        progress < 0.5 ? Math.pow(progress * 2, 2.1) : Math.pow(1 - (progress - 0.5) * 2, 1.35);

      // Doppler, roughly: the band shifts down as it goes past. Approximated by
      // mixing in a little more low content on the way out.
      const tone = band(passNoise() * 2 - 1) * (progress < 0.5 ? 1 : 0.82);
      const value = tone * envelope * event.loudness;

      // Equal-power pan from one side to the other across the whole pass.
      const position = event.from * (1 - progress * 2);
      const angle = ((position + 1) / 2) * (Math.PI / 2);

      // noUncheckedIndexedAccess: the bounds were checked above, but the
      // compiler cannot see that, and a fallback costs nothing here.
      left[index] = (left[index] ?? 0) + value * Math.cos(angle);
      right[index] = (right[index] ?? 0) + value * Math.sin(angle);
    }
  }

  return [left, right];
}

/**
 * Folds the tail over the head so the file loops without a click: the last
 * CROSSFADE_SECONDS are mixed into the first, each side weighted so the sum
 * stays at one.
 */
function foldLoop(channel: Float32Array): Float32Array {
  const length = RATE * SECONDS;
  const fade = RATE * CROSSFADE_SECONDS;
  const out = channel.slice(0, length);

  for (let index = 0; index < fade; index += 1) {
    const weight = index / fade;
    const head = out[index] ?? 0;
    const tail = channel[length + index] ?? 0;
    out[index] = head * weight + tail * (1 - weight);
  }

  return out;
}

/** 16-bit PCM WAV. Every browser reads it, and no encoder has to be installed. */
function wav(channels: Float32Array[]): Uint8Array {
  const frames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const dataBytes = frames * CHANNELS * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const ascii = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * CHANNELS * bytesPerSample, true);
  view.setUint16(32, CHANNELS * bytesPerSample, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[frame] ?? 0));
      view.setInt16(offset, Math.round(sample * 32_767), true);
      offset += bytesPerSample;
    }
  }

  return new Uint8Array(buffer);
}

/** Brings the loudest moment to a known level, so the player's volume means something. */
function normalise(channels: Float32Array[], peak: number): void {
  let loudest = 0;
  for (const channel of channels) {
    for (const sample of channel) loudest = Math.max(loudest, Math.abs(sample));
  }

  if (loudest === 0) return;
  const gain = peak / loudest;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (channel[index] ?? 0) * gain;
    }
  }
}

async function main(): Promise<void> {
  console.log(`synthesising ${SECONDS}s of street, ${RATE} Hz stereo…`);

  const channels = synthesise().map(foldLoop);
  normalise(channels, 0.7);

  const bytes = wav(channels);
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'street.wav');
  writeFileSync(file, bytes);

  console.log(`written ${file}  ${(bytes.byteLength / 1e6).toFixed(1)} MB`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
