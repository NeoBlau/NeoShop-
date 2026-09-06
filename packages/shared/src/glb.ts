/**
 * Container-level inspection of glTF/GLB models.
 *
 * The same function runs in two places on purpose: the browser calls it before
 * uploading, so a supplier learns about a 900k-triangle model in a second
 * instead of after a 40 MB upload; the server calls it on the received bytes,
 * because client-side validation is a courtesy and never a boundary. The
 * server decides by what is inside the file, not by its extension.
 */

import { UPLOAD_LIMITS } from './limits.js';
import { decodeUtf8 } from './utf8.js';

const GLB_MAGIC = 0x46546c67; // 'glTF' little-endian
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

/** glTF primitive mode 4 is TRIANGLES; 5 and 6 are strips and fans. */
const MODE_TRIANGLES = 4;
const MODE_TRIANGLE_STRIP = 5;
const MODE_TRIANGLE_FAN = 6;

export type GlbErrorCode =
  'not_a_model' | 'unsupported_version' | 'truncated' | 'missing_json_chunk' | 'malformed_json';

export class GlbParseError extends Error {
  readonly code: GlbErrorCode;

  constructor(code: GlbErrorCode, message: string) {
    super(message);
    this.name = 'GlbParseError';
    this.code = code;
  }
}

export interface AnimationClipInfo {
  /** Index in the glTF `animations` array; the name may be empty or repeated. */
  index: number;
  name: string;
  /** Seconds, read from the time accessor bounds. Null when unavailable. */
  duration: number | null;
  channels: number;
}

export interface ModelInspection {
  container: 'glb' | 'gltf';
  version: number;
  byteSize: number;
  /** Triangles in the geometry, counted once per mesh. */
  triangles: number;
  /** Triangles actually drawn, counting a mesh reused by several nodes twice. */
  drawnTriangles: number;
  meshes: number;
  primitives: number;
  materials: number;
  textures: number;
  images: number;
  nodes: number;
  animations: AnimationClipInfo[];
  extensionsUsed: string[];
  extensionsRequired: string[];
  /** True when geometry is already Draco-compressed by the exporter. */
  hasDracoCompression: boolean;
  /** True when the file references files it does not contain. */
  hasExternalResources: boolean;
}

interface GltfAccessor {
  count?: number;
  max?: number[];
  min?: number[];
}

interface GltfPrimitive {
  mode?: number;
  indices?: number;
  attributes?: Record<string, number>;
  material?: number;
  extensions?: Record<string, unknown>;
}

interface GltfMesh {
  primitives?: GltfPrimitive[];
}

interface GltfNode {
  mesh?: number;
  children?: number[];
}

interface GltfAnimationChannel {
  sampler?: number;
}

interface GltfAnimationSampler {
  input?: number;
}

interface GltfAnimation {
  name?: string;
  channels?: GltfAnimationChannel[];
  samplers?: GltfAnimationSampler[];
}

interface GltfBuffer {
  uri?: string;
}

interface GltfImage {
  uri?: string;
}

interface GltfDocument {
  asset?: { version?: string; generator?: string };
  accessors?: GltfAccessor[];
  meshes?: GltfMesh[];
  nodes?: GltfNode[];
  materials?: unknown[];
  textures?: unknown[];
  images?: GltfImage[];
  animations?: GltfAnimation[];
  buffers?: GltfBuffer[];
  extensionsUsed?: string[];
  extensionsRequired?: string[];
}

function toUint8(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/** Reads the JSON chunk out of a GLB container without decoding the binary. */
function readGlbJson(bytes: Uint8Array): { json: string; version: number } {
  if (bytes.byteLength < HEADER_BYTES) {
    throw new GlbParseError('truncated', 'File is shorter than a GLB header');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new GlbParseError('not_a_model', 'File does not start with the glTF magic number');
  }

  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new GlbParseError('unsupported_version', `GLB version ${version} is not supported`);
  }

  const declaredLength = view.getUint32(8, true);
  if (declaredLength > bytes.byteLength) {
    throw new GlbParseError(
      'truncated',
      `GLB declares ${declaredLength} bytes but only ${bytes.byteLength} arrived`,
    );
  }

  let offset = HEADER_BYTES;
  while (offset + CHUNK_HEADER_BYTES <= declaredLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + CHUNK_HEADER_BYTES;

    if (chunkStart + chunkLength > bytes.byteLength) {
      throw new GlbParseError('truncated', 'A GLB chunk runs past the end of the file');
    }

    if (chunkType === CHUNK_JSON) {
      const json = decodeUtf8(bytes.subarray(chunkStart, chunkStart + chunkLength));
      return { json, version };
    }

    if (chunkType !== CHUNK_BIN) {
      // Unknown chunk types are to be ignored per the specification.
    }

    // Chunks are padded to four-byte boundaries.
    offset = chunkStart + chunkLength + ((4 - (chunkLength % 4)) % 4);
  }

  throw new GlbParseError('missing_json_chunk', 'GLB contains no JSON chunk');
}

function countPrimitiveTriangles(primitive: GltfPrimitive, accessors: GltfAccessor[]): number {
  const mode = primitive.mode ?? MODE_TRIANGLES;
  if (mode !== MODE_TRIANGLES && mode !== MODE_TRIANGLE_STRIP && mode !== MODE_TRIANGLE_FAN) {
    return 0;
  }

  const vertexCount =
    primitive.indices !== undefined
      ? (accessors[primitive.indices]?.count ?? 0)
      : (accessors[primitive.attributes?.['POSITION'] ?? -1]?.count ?? 0);

  if (vertexCount === 0) return 0;
  // Strips and fans produce one triangle per vertex after the first two.
  return mode === MODE_TRIANGLES ? Math.floor(vertexCount / 3) : Math.max(0, vertexCount - 2);
}

function readAnimationDuration(animation: GltfAnimation, accessors: GltfAccessor[]): number | null {
  let duration: number | null = null;

  for (const sampler of animation.samplers ?? []) {
    if (sampler.input === undefined) continue;
    // The time accessor's `max` holds the last keyframe, which is the clip
    // length. Exporters are required to write bounds for animation inputs.
    const max = accessors[sampler.input]?.max?.[0];
    // Rounded: float32 keyframe times print as 2.5999999046325684 otherwise.
    const seconds = typeof max === 'number' ? Math.round(max * 100) / 100 : null;
    if (seconds !== null && (duration === null || seconds > duration)) duration = seconds;
  }

  return duration;
}

function isExternalUri(uri: string | undefined): boolean {
  return uri !== undefined && !uri.startsWith('data:');
}

/** Inspects an already-parsed glTF document. Shared by both container formats. */
function inspectDocument(
  document: GltfDocument,
  container: 'glb' | 'gltf',
  byteSize: number,
  version: number,
): ModelInspection {
  const accessors = document.accessors ?? [];
  const meshes = document.meshes ?? [];
  const nodes = document.nodes ?? [];

  const trianglesPerMesh = meshes.map((mesh) =>
    (mesh.primitives ?? []).reduce(
      (total, primitive) => total + countPrimitiveTriangles(primitive, accessors),
      0,
    ),
  );

  const triangles = trianglesPerMesh.reduce((total, count) => total + count, 0);

  // A mesh placed by three nodes is drawn three times; that is what the GPU
  // pays for, and what the supplier should be warned about.
  const meshUsage = new Map<number, number>();
  for (const node of nodes) {
    if (node.mesh === undefined) continue;
    meshUsage.set(node.mesh, (meshUsage.get(node.mesh) ?? 0) + 1);
  }
  const drawnTriangles = trianglesPerMesh.reduce(
    (total, count, index) => total + count * (meshUsage.get(index) ?? 1),
    0,
  );

  const primitives = meshes.reduce((total, mesh) => total + (mesh.primitives ?? []).length, 0);

  const animations: AnimationClipInfo[] = (document.animations ?? []).map((animation, index) => ({
    index,
    name: animation.name ?? '',
    duration: readAnimationDuration(animation, accessors),
    channels: (animation.channels ?? []).length,
  }));

  const extensionsUsed = document.extensionsUsed ?? [];

  const hasExternalResources =
    (document.buffers ?? []).some((buffer) => isExternalUri(buffer.uri)) ||
    (document.images ?? []).some((image) => isExternalUri(image.uri));

  return {
    container,
    version,
    byteSize,
    triangles,
    drawnTriangles,
    meshes: meshes.length,
    primitives,
    materials: (document.materials ?? []).length,
    textures: (document.textures ?? []).length,
    images: (document.images ?? []).length,
    nodes: nodes.length,
    animations,
    extensionsUsed,
    extensionsRequired: document.extensionsRequired ?? [],
    hasDracoCompression: extensionsUsed.includes('KHR_draco_mesh_compression'),
    hasExternalResources,
  };
}

/**
 * Detects the container by content and inspects it. Accepts a binary GLB or a
 * JSON .gltf; anything else raises `not_a_model`.
 */
export function inspectModel(input: ArrayBuffer | Uint8Array): ModelInspection {
  const bytes = toUint8(input);

  if (bytes.byteLength >= 4) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) === GLB_MAGIC) {
      const { json, version } = readGlbJson(bytes);
      let document: GltfDocument;
      try {
        document = JSON.parse(json) as GltfDocument;
      } catch {
        throw new GlbParseError('malformed_json', 'The GLB JSON chunk is not valid JSON');
      }
      return inspectDocument(document, 'glb', bytes.byteLength, version);
    }
  }

  // A .gltf file is plain JSON. Reject anything that is not an object with an
  // `asset` block — that is what separates a glTF from arbitrary JSON.
  let document: GltfDocument;
  try {
    document = JSON.parse(decodeUtf8(bytes)) as GltfDocument;
  } catch {
    throw new GlbParseError('not_a_model', 'File is neither GLB nor glTF JSON');
  }

  if (typeof document !== 'object' || document === null || document.asset === undefined) {
    throw new GlbParseError('not_a_model', 'JSON file has no glTF asset block');
  }

  const version = Number.parseInt(document.asset.version ?? '0', 10);
  if (version !== 2) {
    throw new GlbParseError('unsupported_version', `glTF version ${version} is not supported`);
  }

  return inspectDocument(document, 'gltf', bytes.byteLength, version);
}

export type ModelIssueCode =
  | 'model_too_large'
  | 'too_many_triangles'
  | 'too_many_materials'
  | 'triangles_high'
  | 'materials_high'
  | 'external_resources'
  | 'no_animations'
  | 'unnamed_animations'
  | 'no_geometry';

export interface ModelIssue {
  code: ModelIssueCode;
  /** Values for the message, e.g. `{ actual: 812345, max: 500000 }`. */
  params: Record<string, string | number>;
}

export interface ModelVerdict {
  /** Blocking problems. A model with any of these is rejected. */
  errors: ModelIssue[];
  /** Worth fixing, but the model is accepted. */
  warnings: ModelIssue[];
}

/**
 * Applies the published budget to an inspection. Kept separate from parsing so
 * the same numbers back the upload form, the API and the supplier guide.
 */
export function validateModel(inspection: ModelInspection): ModelVerdict {
  const errors: ModelIssue[] = [];
  const warnings: ModelIssue[] = [];

  if (inspection.byteSize > UPLOAD_LIMITS.modelMaxBytes) {
    errors.push({
      code: 'model_too_large',
      params: {
        actualMb: Math.round((inspection.byteSize / 1024 / 1024) * 10) / 10,
        maxMb: Math.round(UPLOAD_LIMITS.modelMaxBytes / 1024 / 1024),
      },
    });
  }

  if (inspection.triangles > UPLOAD_LIMITS.triangleMax) {
    errors.push({
      code: 'too_many_triangles',
      params: { actual: inspection.triangles, max: UPLOAD_LIMITS.triangleMax },
    });
  } else if (inspection.triangles > UPLOAD_LIMITS.triangleWarn) {
    warnings.push({
      code: 'triangles_high',
      params: { actual: inspection.triangles, recommended: UPLOAD_LIMITS.triangleWarn },
    });
  }

  if (inspection.materials > UPLOAD_LIMITS.materialMax) {
    errors.push({
      code: 'too_many_materials',
      params: { actual: inspection.materials, max: UPLOAD_LIMITS.materialMax },
    });
  } else if (inspection.materials > UPLOAD_LIMITS.materialWarn) {
    warnings.push({
      code: 'materials_high',
      params: { actual: inspection.materials, recommended: UPLOAD_LIMITS.materialWarn },
    });
  }

  // A .gltf that points at sibling files would arrive without them.
  if (inspection.hasExternalResources) {
    errors.push({ code: 'external_resources', params: {} });
  }

  if (inspection.triangles === 0) {
    errors.push({ code: 'no_geometry', params: {} });
  }

  if (inspection.animations.length === 0) {
    warnings.push({ code: 'no_animations', params: {} });
  } else {
    const unnamed = inspection.animations.filter(
      (clip) => clip.name.trim().length === 0 || /^(take[ _]?\d+|animation\d*)$/i.test(clip.name),
    );
    if (unnamed.length > 0) {
      warnings.push({ code: 'unnamed_animations', params: { count: unnamed.length } });
    }
  }

  return { errors, warnings };
}
