/**
 * Generates the demo catalogue as real GLB files: real triangles, real
 * materials and real animation tracks, so the seeded world exercises the same
 * code path a supplier's upload will.
 *
 *   pnpm --filter @3dsfera/tools run gen:assets
 *
 * Output lands in apps/api/prisma/seed-assets and is committed — the seed must
 * work offline.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO, type Node as GltfNode } from '@gltf-transform/core';
import { box, cylinder, dish, triangleCount, translated, type Geometry } from './geometry.js';

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

interface Part {
  name: string;
  geometry: Geometry;
  color: Vec3;
  metallic?: number;
  roughness?: number;
  translation?: Vec3;
  rotation?: Quat;
  parent?: string;
}

interface Track {
  node: string;
  path: 'rotation' | 'translation' | 'scale';
  times: number[];
  /** One value per keyframe: VEC3 for translation/scale, VEC4 for rotation. */
  values: number[][];
}

interface Clip {
  name: string;
  tracks: Track[];
}

interface ModelSpec {
  file: string;
  name: string;
  parts: Part[];
  clips: Clip[];
}

/** Quaternion for a rotation of `angle` radians about a unit axis. */
function quat(axis: Vec3, angle: number): Quat {
  const half = angle / 2;
  const sin = Math.sin(half);
  return [axis[0] * sin, axis[1] * sin, axis[2] * sin, Math.cos(half)];
}

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const IDENTITY: Quat = [0, 0, 0, 1];

const degrees = (value: number): number => (value * Math.PI) / 180;

// --- Model definitions -----------------------------------------------------

function antenna(): ModelSpec {
  return {
    file: 'antenna-orbita.glb',
    name: 'Antenna Orbita 1.2',
    parts: [
      {
        name: 'base',
        geometry: cylinder(0.28, 0.24, 0.09, 20),
        color: [0.24, 0.25, 0.27],
        metallic: 0.8,
        roughness: 0.45,
        translation: [0, 0.045, 0],
      },
      {
        name: 'mast',
        geometry: translated(cylinder(0.05, 0.045, 0.85, 14), 0, 0.425, 0),
        color: [0.32, 0.33, 0.35],
        metallic: 0.9,
        roughness: 0.35,
        translation: [0, 0.09, 0],
      },
      {
        name: 'dish_arm',
        geometry: translated(box(0.07, 0.26, 0.07), 0, 0.13, 0),
        color: [0.3, 0.31, 0.33],
        metallic: 0.85,
        roughness: 0.4,
        translation: [0, 0.94, 0],
        parent: 'mast',
      },
      {
        name: 'dish',
        // Folded down at rest; `deploy` swings it up to the sky.
        geometry: dish(0.6, 0.17, 30, 9),
        color: [0.86, 0.86, 0.84],
        metallic: 0.15,
        roughness: 0.65,
        translation: [0, 0.26, 0],
        rotation: quat(X, degrees(90)),
        parent: 'dish_arm',
      },
      {
        name: 'feed_horn',
        geometry: translated(cylinder(0.035, 0.06, 0.22, 12), 0, 0.11, 0),
        color: [0.15, 0.15, 0.16],
        metallic: 0.5,
        roughness: 0.5,
        translation: [0, 0.17, 0],
        parent: 'dish',
      },
    ],
    clips: [
      {
        name: 'deploy',
        tracks: [
          {
            node: 'dish',
            path: 'rotation',
            times: [0, 1.4, 2.6],
            values: [quat(X, degrees(90)), quat(X, degrees(40)), quat(X, degrees(-12))],
          },
          {
            node: 'dish_arm',
            path: 'translation',
            times: [0, 1.4, 2.6],
            values: [
              [0, 0.94, 0],
              [0, 1.02, 0],
              [0, 1.06, 0],
            ],
          },
        ],
      },
      {
        name: 'track_signal',
        tracks: [
          {
            node: 'mast',
            path: 'rotation',
            times: [0, 1.5, 3, 4.5, 6],
            values: [
              quat(Y, degrees(-35)),
              quat(Y, degrees(0)),
              quat(Y, degrees(35)),
              quat(Y, degrees(0)),
              quat(Y, degrees(-35)),
            ],
          },
        ],
      },
      {
        name: 'fold',
        tracks: [
          {
            node: 'dish',
            path: 'rotation',
            times: [0, 1.8],
            values: [quat(X, degrees(-12)), quat(X, degrees(90))],
          },
        ],
      },
    ],
  };
}

function vacuum(): ModelSpec {
  return {
    file: 'robot-vacuum.glb',
    name: 'Robot Vacuum Domovoy X2',
    parts: [
      {
        name: 'body',
        geometry: cylinder(0.17, 0.165, 0.085, 32),
        color: [0.13, 0.14, 0.16],
        metallic: 0.25,
        roughness: 0.55,
        translation: [0, 0.06, 0],
      },
      {
        name: 'lid',
        geometry: cylinder(0.12, 0.115, 0.012, 28),
        color: [0.2, 0.21, 0.24],
        metallic: 0.4,
        roughness: 0.35,
        translation: [0, 0.105, 0],
        parent: 'body',
      },
      {
        name: 'lidar',
        geometry: cylinder(0.038, 0.038, 0.028, 18),
        color: [0.08, 0.08, 0.09],
        metallic: 0.2,
        roughness: 0.6,
        translation: [0, 0.02, -0.02],
        parent: 'lid',
      },
      {
        name: 'brush_left',
        geometry: cylinder(0.055, 0.05, 0.012, 12),
        color: [0.78, 0.72, 0.5],
        metallic: 0.05,
        roughness: 0.85,
        translation: [-0.12, -0.035, 0.11],
        parent: 'body',
      },
      {
        name: 'brush_right',
        geometry: cylinder(0.055, 0.05, 0.012, 12),
        color: [0.78, 0.72, 0.5],
        metallic: 0.05,
        roughness: 0.85,
        translation: [0.12, -0.035, 0.11],
        parent: 'body',
      },
      {
        name: 'dock',
        geometry: translated(box(0.26, 0.02, 0.2), 0, 0.01, 0),
        color: [0.22, 0.23, 0.25],
        metallic: 0.3,
        roughness: 0.6,
        translation: [0, 0, -0.34],
      },
    ],
    clips: [
      {
        name: 'undock',
        tracks: [
          {
            node: 'body',
            path: 'translation',
            times: [0, 1.2, 2],
            values: [
              [0, 0.06, -0.28],
              [0, 0.06, -0.1],
              [0, 0.06, 0],
            ],
          },
        ],
      },
      {
        name: 'clean_pattern',
        tracks: [
          {
            node: 'body',
            path: 'translation',
            times: [0, 1.2, 2.4, 3.6, 4.8, 6],
            values: [
              [0, 0.06, 0],
              [0.75, 0.06, 0],
              [0.75, 0.06, 0.55],
              [-0.75, 0.06, 0.55],
              [-0.75, 0.06, 0],
              [0, 0.06, 0],
            ],
          },
          {
            node: 'body',
            path: 'rotation',
            times: [0, 1.2, 2.4, 3.6, 4.8, 6],
            values: [
              quat(Y, degrees(0)),
              quat(Y, degrees(-90)),
              quat(Y, degrees(-180)),
              quat(Y, degrees(-270)),
              quat(Y, degrees(-360)),
              quat(Y, degrees(-360)),
            ],
          },
          {
            node: 'brush_left',
            path: 'rotation',
            times: [0, 1.5, 3, 4.5, 6],
            values: [
              quat(Y, degrees(0)),
              quat(Y, degrees(170)),
              quat(Y, degrees(340)),
              quat(Y, degrees(170)),
              quat(Y, degrees(0)),
            ],
          },
          {
            node: 'brush_right',
            path: 'rotation',
            times: [0, 1.5, 3, 4.5, 6],
            values: [
              quat(Y, degrees(0)),
              quat(Y, degrees(-170)),
              quat(Y, degrees(-340)),
              quat(Y, degrees(-170)),
              quat(Y, degrees(0)),
            ],
          },
        ],
      },
      {
        name: 'open_lid',
        tracks: [
          {
            node: 'lid',
            path: 'rotation',
            times: [0, 1, 1.8],
            values: [IDENTITY, quat(X, degrees(-35)), quat(X, degrees(-62))],
          },
        ],
      },
    ],
  };
}

function chair(): ModelSpec {
  return {
    file: 'recliner-chair.glb',
    name: 'Recliner Kronos',
    parts: [
      {
        name: 'base',
        geometry: translated(box(0.62, 0.1, 0.62), 0, 0.05, 0),
        color: [0.18, 0.18, 0.19],
        metallic: 0.4,
        roughness: 0.5,
      },
      {
        name: 'seat',
        geometry: translated(box(0.66, 0.14, 0.62), 0, 0.07, 0),
        color: [0.42, 0.26, 0.2],
        metallic: 0.02,
        roughness: 0.9,
        translation: [0, 0.36, 0],
      },
      {
        name: 'backrest',
        geometry: translated(box(0.66, 0.72, 0.13), 0, 0.36, 0),
        color: [0.45, 0.28, 0.22],
        metallic: 0.02,
        roughness: 0.9,
        translation: [0, 0.13, -0.24],
        parent: 'seat',
      },
      {
        name: 'headrest',
        geometry: translated(box(0.5, 0.2, 0.14), 0, 0.1, 0),
        color: [0.4, 0.25, 0.19],
        metallic: 0.02,
        roughness: 0.9,
        translation: [0, 0.72, 0],
        parent: 'backrest',
      },
      {
        name: 'footrest',
        geometry: translated(box(0.6, 0.1, 0.42), 0, 0, 0.21),
        color: [0.42, 0.26, 0.2],
        metallic: 0.02,
        roughness: 0.9,
        translation: [0, -0.02, 0.31],
        rotation: quat(X, degrees(-88)),
        parent: 'seat',
      },
      {
        name: 'armrest_left',
        geometry: translated(box(0.1, 0.12, 0.56), 0, 0, 0),
        color: [0.4, 0.25, 0.19],
        metallic: 0.02,
        roughness: 0.9,
        translation: [-0.38, 0.22, 0],
        parent: 'seat',
      },
      {
        name: 'armrest_right',
        geometry: translated(box(0.1, 0.12, 0.56), 0, 0, 0),
        color: [0.4, 0.25, 0.19],
        metallic: 0.02,
        roughness: 0.9,
        translation: [0.38, 0.22, 0],
        parent: 'seat',
      },
    ],
    clips: [
      {
        name: 'recline',
        tracks: [
          {
            node: 'backrest',
            path: 'rotation',
            times: [0, 1.3, 2.4],
            values: [IDENTITY, quat(X, degrees(14)), quat(X, degrees(26))],
          },
          {
            node: 'footrest',
            path: 'rotation',
            times: [0, 1.3, 2.4],
            values: [quat(X, degrees(-88)), quat(X, degrees(-40)), quat(X, degrees(-6))],
          },
        ],
      },
      {
        name: 'footrest_up',
        tracks: [
          {
            node: 'footrest',
            path: 'rotation',
            times: [0, 1.6],
            values: [quat(X, degrees(-88)), quat(X, degrees(-6))],
          },
        ],
      },
      {
        name: 'sit_upright',
        tracks: [
          {
            node: 'backrest',
            path: 'rotation',
            times: [0, 1.4],
            values: [quat(X, degrees(26)), IDENTITY],
          },
          {
            node: 'footrest',
            path: 'rotation',
            times: [0, 1.4],
            values: [quat(X, degrees(-6)), quat(X, degrees(-88))],
          },
        ],
      },
    ],
  };
}

function drone(): ModelSpec {
  const arms: Part[] = [];
  const rotorTracks: Track[] = [];
  const offsets: Vec3[] = [
    [0.22, 0, 0.22],
    [-0.22, 0, 0.22],
    [-0.22, 0, -0.22],
    [0.22, 0, -0.22],
  ];

  offsets.forEach((offset, index) => {
    const armName = `arm_${index + 1}`;
    const rotorName = `rotor_${index + 1}`;

    arms.push({
      name: armName,
      geometry: translated(box(0.05, 0.03, 0.05), 0, 0, 0),
      color: [0.2, 0.21, 0.23],
      metallic: 0.6,
      roughness: 0.45,
      translation: offset,
      parent: 'body',
    });

    arms.push({
      name: rotorName,
      geometry: translated(box(0.26, 0.008, 0.03), 0, 0, 0),
      color: [0.1, 0.1, 0.11],
      metallic: 0.3,
      roughness: 0.6,
      translation: [0, 0.035, 0],
      parent: armName,
    });

    const direction = index % 2 === 0 ? 1 : -1;
    rotorTracks.push({
      node: rotorName,
      path: 'rotation',
      times: [0, 0.5, 1, 1.5, 2],
      values: [
        quat(Y, 0),
        quat(Y, degrees(170 * direction)),
        quat(Y, degrees(340 * direction)),
        quat(Y, degrees(510 * direction)),
        quat(Y, degrees(680 * direction)),
      ],
    });
  });

  return {
    file: 'inspection-drone.glb',
    name: 'Inspection Drone Skyeye',
    parts: [
      {
        name: 'body',
        geometry: translated(box(0.24, 0.07, 0.3), 0, 0, 0),
        color: [0.16, 0.17, 0.19],
        metallic: 0.5,
        roughness: 0.5,
        translation: [0, 0.12, 0],
      },
      {
        name: 'camera',
        geometry: cylinder(0.045, 0.04, 0.06, 16),
        color: [0.07, 0.07, 0.08],
        metallic: 0.3,
        roughness: 0.4,
        translation: [0, -0.06, 0.09],
        rotation: quat(X, degrees(90)),
        parent: 'body',
      },
      ...arms,
    ],
    clips: [
      {
        name: 'takeoff',
        tracks: [
          {
            node: 'body',
            path: 'translation',
            times: [0, 1, 2.2, 3],
            values: [
              [0, 0.12, 0],
              [0, 0.35, 0],
              [0, 0.85, 0],
              [0, 0.95, 0],
            ],
          },
        ],
      },
      { name: 'rotors_spin', tracks: rotorTracks },
      {
        name: 'camera_scan',
        tracks: [
          {
            node: 'camera',
            path: 'rotation',
            times: [0, 1.5, 3],
            values: [quat(X, degrees(90)), quat(X, degrees(50)), quat(X, degrees(90))],
          },
        ],
      },
    ],
  };
}

function lamp(): ModelSpec {
  return {
    file: 'desk-lamp.glb',
    name: 'Desk Lamp Meridian',
    parts: [
      {
        name: 'base',
        geometry: cylinder(0.11, 0.1, 0.025, 24),
        color: [0.2, 0.2, 0.22],
        metallic: 0.7,
        roughness: 0.4,
        translation: [0, 0.0125, 0],
      },
      {
        name: 'lower_arm',
        geometry: translated(cylinder(0.016, 0.014, 0.34, 12), 0, 0.17, 0),
        color: [0.7, 0.68, 0.62],
        metallic: 0.8,
        roughness: 0.3,
        translation: [0, 0.025, 0],
        rotation: quat(X, degrees(-70)),
      },
      {
        name: 'upper_arm',
        geometry: translated(cylinder(0.014, 0.012, 0.3, 12), 0, 0.15, 0),
        color: [0.7, 0.68, 0.62],
        metallic: 0.8,
        roughness: 0.3,
        translation: [0, 0.34, 0],
        rotation: quat(X, degrees(120)),
        parent: 'lower_arm',
      },
      {
        name: 'head',
        geometry: cylinder(0.09, 0.05, 0.12, 20),
        color: [0.24, 0.24, 0.26],
        metallic: 0.6,
        roughness: 0.45,
        translation: [0, 0.3, 0],
        rotation: quat(X, degrees(-40)),
        parent: 'upper_arm',
      },
    ],
    clips: [
      {
        name: 'fold_open',
        tracks: [
          {
            node: 'lower_arm',
            path: 'rotation',
            times: [0, 1.2, 2.2],
            values: [quat(X, degrees(-8)), quat(X, degrees(-45)), quat(X, degrees(-70))],
          },
          {
            node: 'upper_arm',
            path: 'rotation',
            times: [0, 1.2, 2.2],
            values: [quat(X, degrees(170)), quat(X, degrees(140)), quat(X, degrees(120))],
          },
        ],
      },
      {
        name: 'head_tilt',
        tracks: [
          {
            node: 'head',
            path: 'rotation',
            times: [0, 1, 2],
            values: [quat(X, degrees(-40)), quat(X, degrees(-5)), quat(X, degrees(-40))],
          },
        ],
      },
    ],
  };
}

// --- Assembly --------------------------------------------------------------

function buildDocument(spec: ModelSpec): Document {
  const document = new Document();
  document.getRoot().getAsset().generator = '3DSFERA demo asset generator';

  const buffer = document.createBuffer();
  const scene = document.createScene(spec.name);
  const nodes = new Map<string, GltfNode>();

  for (const part of spec.parts) {
    const position = document
      .createAccessor(`${part.name}_position`)
      .setArray(part.geometry.positions)
      .setType('VEC3')
      .setBuffer(buffer);

    const normal = document
      .createAccessor(`${part.name}_normal`)
      .setArray(part.geometry.normals)
      .setType('VEC3')
      .setBuffer(buffer);

    const indices = document
      .createAccessor(`${part.name}_indices`)
      .setArray(part.geometry.indices)
      .setType('SCALAR')
      .setBuffer(buffer);

    const material = document
      .createMaterial(`${part.name}_material`)
      .setBaseColorFactor([part.color[0], part.color[1], part.color[2], 1])
      .setMetallicFactor(part.metallic ?? 0.2)
      .setRoughnessFactor(part.roughness ?? 0.7);

    const primitive = document
      .createPrimitive()
      .setAttribute('POSITION', position)
      .setAttribute('NORMAL', normal)
      .setIndices(indices)
      .setMaterial(material);

    const mesh = document.createMesh(part.name).addPrimitive(primitive);
    const node = document.createNode(part.name).setMesh(mesh);

    if (part.translation) node.setTranslation(part.translation);
    if (part.rotation) node.setRotation(part.rotation);

    nodes.set(part.name, node);

    if (part.parent) {
      const parent = nodes.get(part.parent);
      if (!parent)
        throw new Error(`Part "${part.name}" references unknown parent "${part.parent}"`);
      parent.addChild(node);
    } else {
      scene.addChild(node);
    }
  }

  for (const clip of spec.clips) {
    const animation = document.createAnimation(clip.name);

    for (const track of clip.tracks) {
      const target = nodes.get(track.node);
      if (!target) throw new Error(`Clip "${clip.name}" targets unknown node "${track.node}"`);

      const input = document
        .createAccessor(`${clip.name}_${track.node}_time`)
        .setArray(new Float32Array(track.times))
        .setType('SCALAR')
        .setBuffer(buffer);

      const output = document
        .createAccessor(`${clip.name}_${track.node}_value`)
        .setArray(new Float32Array(track.values.flat()))
        .setType(track.path === 'rotation' ? 'VEC4' : 'VEC3')
        .setBuffer(buffer);

      const sampler = document
        .createAnimationSampler()
        .setInput(input)
        .setOutput(output)
        .setInterpolation('LINEAR');

      const channel = document
        .createAnimationChannel()
        .setTargetNode(target)
        .setTargetPath(track.path)
        .setSampler(sampler);

      animation.addSampler(sampler).addChannel(channel);
    }
  }

  return document;
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.resolve(here, '../../api/prisma/seed-assets');
  mkdirSync(outputDir, { recursive: true });

  const io = new NodeIO();
  const specs = [antenna(), vacuum(), chair(), drone(), lamp()];

  for (const spec of specs) {
    const document = buildDocument(spec);
    const glb = await io.writeBinary(document);
    const target = path.join(outputDir, spec.file);
    writeFileSync(target, glb);

    const triangles = spec.parts.reduce((total, part) => total + triangleCount(part.geometry), 0);
    console.log(
      `${spec.file.padEnd(24)} ${String(triangles).padStart(6)} tri  ` +
        `${String(spec.parts.length).padStart(2)} parts  ` +
        `${spec.clips.length} clips (${spec.clips.map((clip) => clip.name).join(', ')})  ` +
        `${(glb.byteLength / 1024).toFixed(1)} KB`,
    );
  }

  console.log(`\nwritten to ${outputDir}`);
}

await main();
