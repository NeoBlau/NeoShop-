import type { WebGLRenderer } from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

/**
 * Decoders for the two compressed formats every model in this application
 * uses, served from our own origin.
 *
 * Left to itself three fetches the Draco decoder from a Google CDN and the
 * Basis transcoder from unpkg, inside a Suspense boundary where the failure
 * shows up as a scene that never appears. Both are copied into `public/` by
 * `scripts/copy-decoders.mjs` at build time.
 */
const DRACO_DECODER_PATH = '/draco/';
const BASIS_TRANSCODER_PATH = '/basis/';

export function extendGltfLoader(loader: GLTFLoader, renderer: WebGLRenderer): void {
  loader.setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH));
  loader.setKTX2Loader(
    new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH).detectSupport(renderer),
  );
}
