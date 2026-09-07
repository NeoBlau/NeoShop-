/**
 * `draco3dgltf` ships without type declarations. Only the two factory
 * functions glTF-Transform needs are declared here; the modules themselves are
 * opaque handles passed straight back to the library.
 */
declare module 'draco3dgltf' {
  export interface DracoDecoderModule {
    readonly __brand: 'draco-decoder';
  }
  export interface DracoEncoderModule {
    readonly __brand: 'draco-encoder';
  }

  const draco3d: {
    createDecoderModule(): Promise<DracoDecoderModule>;
    createEncoderModule(): Promise<DracoEncoderModule>;
  };

  export default draco3d;
}
