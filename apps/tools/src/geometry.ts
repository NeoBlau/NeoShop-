/**
 * Minimal procedural geometry. Enough to build recognisable demo products with
 * real triangles and real normals, without dragging a modelling library into
 * the repository.
 *
 * Every builder returns flat arrays ready to be handed to glTF accessors:
 * positions and normals as VEC3 floats, indices as scalars.
 */

export interface Geometry {
  positions: Float32Array;
  normals: Float32Array;
  /** Texture coordinates. Without them a 4K material has nowhere to land. */
  uvs: Float32Array;
  indices: Uint16Array;
}

interface Vertex {
  position: [number, number, number];
  normal: [number, number, number];
  uv: [number, number];
}

function build(vertices: Vertex[], indices: number[]): Geometry {
  const positions = new Float32Array(vertices.length * 3);
  const normals = new Float32Array(vertices.length * 3);
  const uvs = new Float32Array(vertices.length * 2);

  vertices.forEach((vertex, index) => {
    positions.set(vertex.position, index * 3);
    normals.set(vertex.normal, index * 3);
    uvs.set(vertex.uv, index * 2);
  });

  return { positions, normals, uvs, indices: new Uint16Array(indices) };
}

/**
 * Texture density: how many times a one-metre span repeats the material.
 * Keeping it constant across parts is what stops a scene looking like a
 * collage of different scales.
 */
const TILES_PER_METRE = 1.6;

/** Axis-aligned box centred on the origin, with hard edges. */
export function box(width: number, height: number, depth: number): Geometry {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;

  // Each face gets a planar projection along its own axis, so the material
  // keeps the same physical scale on every side of the box.
  const faces: {
    normal: [number, number, number];
    corners: [number, number, number][];
    span: [number, number];
  }[] = [
    {
      normal: [0, 0, 1],
      corners: [
        [-x, -y, z],
        [x, -y, z],
        [x, y, z],
        [-x, y, z],
      ],
      span: [width, height],
    },
    {
      normal: [0, 0, -1],
      corners: [
        [x, -y, -z],
        [-x, -y, -z],
        [-x, y, -z],
        [x, y, -z],
      ],
      span: [width, height],
    },
    {
      normal: [1, 0, 0],
      corners: [
        [x, -y, z],
        [x, -y, -z],
        [x, y, -z],
        [x, y, z],
      ],
      span: [depth, height],
    },
    {
      normal: [-1, 0, 0],
      corners: [
        [-x, -y, -z],
        [-x, -y, z],
        [-x, y, z],
        [-x, y, -z],
      ],
      span: [depth, height],
    },
    {
      normal: [0, 1, 0],
      corners: [
        [-x, y, z],
        [x, y, z],
        [x, y, -z],
        [-x, y, -z],
      ],
      span: [width, depth],
    },
    {
      normal: [0, -1, 0],
      corners: [
        [-x, -y, -z],
        [x, -y, -z],
        [x, -y, z],
        [-x, -y, z],
      ],
      span: [width, depth],
    },
  ];

  const vertices: Vertex[] = [];
  const indices: number[] = [];

  for (const face of faces) {
    const base = vertices.length;
    const spanU = face.span[0] * TILES_PER_METRE;
    const spanV = face.span[1] * TILES_PER_METRE;
    const cornerUvs: [number, number][] = [
      [0, 0],
      [spanU, 0],
      [spanU, spanV],
      [0, spanV],
    ];

    face.corners.forEach((corner, index) => {
      vertices.push({ position: corner, normal: face.normal, uv: cornerUvs[index] ?? [0, 0] });
    });

    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return build(vertices, indices);
}

/** Cylinder along Y, centred on the origin. `topRadius` 0 gives a cone. */
export function cylinder(
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments = 24,
): Geometry {
  const vertices: Vertex[] = [];
  const indices: number[] = [];
  const halfHeight = height / 2;
  const slope = (bottomRadius - topRadius) / height;

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // The side normal tilts with the slope, otherwise a cone shades like a tube.
    const length = Math.hypot(1, slope);
    const normal: [number, number, number] = [cos / length, slope / length, sin / length];

    // U wraps around the circumference, V runs up the side.
    const u = (i / segments) * Math.PI * 2 * Math.max(bottomRadius, topRadius) * TILES_PER_METRE;
    const v = height * TILES_PER_METRE;

    vertices.push({
      position: [cos * bottomRadius, -halfHeight, sin * bottomRadius],
      normal,
      uv: [u, 0],
    });
    vertices.push({ position: [cos * topRadius, halfHeight, sin * topRadius], normal, uv: [u, v] });
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  // Caps: a fan around a centre vertex, skipped when the radius is zero.
  const addCap = (radius: number, y: number, normalY: number): void => {
    if (radius <= 0) return;
    const centre = vertices.length;
    vertices.push({ position: [0, y, 0], normal: [0, normalY, 0], uv: [0, 0] });

    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      // Caps get a disc projection so the grain is continuous across them.
      vertices.push({
        position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
        normal: [0, normalY, 0],
        uv: [
          Math.cos(angle) * radius * TILES_PER_METRE,
          Math.sin(angle) * radius * TILES_PER_METRE,
        ],
      });
    }

    for (let i = 0; i < segments; i += 1) {
      const first = centre + 1 + i;
      const second = centre + 2 + i;
      if (normalY > 0) indices.push(centre, first, second);
      else indices.push(centre, second, first);
    }
  };

  addCap(bottomRadius, -halfHeight, -1);
  addCap(topRadius, halfHeight, 1);

  return build(vertices, indices);
}

/** Parabolic dish, open towards +Y. Used for the antenna. */
export function dish(radius: number, depth: number, segments = 28, rings = 8): Geometry {
  const vertices: Vertex[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= rings; ring += 1) {
    const r = (ring / rings) * radius;
    const y = ((r * r) / (radius * radius)) * depth;
    // Surface normal of y = depth * r^2 / radius^2.
    const slope = (2 * depth * r) / (radius * radius);

    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const length = Math.hypot(slope, 1);
      vertices.push({
        position: [cos * r, y, sin * r],
        normal: [(-slope * cos) / length, 1 / length, (-slope * sin) / length],
        // Polar projection: the brushed grain follows the dish radially.
        uv: [cos * r * TILES_PER_METRE, sin * r * TILES_PER_METRE],
      });
    }
  }

  const stride = segments + 1;
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * stride + segment;
      const b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  return build(vertices, indices);
}

/** Translates a geometry in place, for parts that are not centred. */
export function translated(geometry: Geometry, dx: number, dy: number, dz: number): Geometry {
  const positions = new Float32Array(geometry.positions);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] ?? 0) + dx;
    positions[i + 1] = (positions[i + 1] ?? 0) + dy;
    positions[i + 2] = (positions[i + 2] ?? 0) + dz;
  }
  return {
    positions,
    normals: geometry.normals,
    uvs: geometry.uvs,
    indices: geometry.indices,
  };
}

export function triangleCount(geometry: Geometry): number {
  return geometry.indices.length / 3;
}
