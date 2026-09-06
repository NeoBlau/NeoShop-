/**
 * `TextDecoder` is a global in Node 18+ and in every browser we support, but it
 * belongs to neither the ES2023 nor the plain Node type library. Declaring the
 * one method used here keeps the shared package free of both DOM and Node
 * typings — it must compile the same on the server and in the bundle.
 */
declare const TextDecoder: {
  new (label?: string): { decode(input: Uint8Array): string };
};

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
