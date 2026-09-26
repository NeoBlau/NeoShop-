// Visual for the jump between star systems: stars stretch into streaks
// around the direction of travel while the new system is loaded.

import * as THREE from 'three';
import { GLSL_NOISE } from '../world/shaders.js';

export class WarpTunnel {
  constructor(scene) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        ${GLSL_NOISE}
        uniform float uTime; uniform float uIntensity; uniform vec3 uDir;
        varying vec3 vDir;
        void main() {
          #include <logdepthbuf_fragment>
          float c = dot(normalize(vDir), uDir);
          vec3 side = normalize(vDir - uDir * c);
          float ang = atan(side.y, side.x) + atan(side.z, 0.3);
          float streak = pow(max(snoise(vec3(ang * 40.0, c * 3.0 - uTime * 6.0, 1.0)), 0.0), 6.0);
          float tunnel = smoothstep(1.0, 0.2, abs(c));
          vec3 col = mix(vec3(0.4, 0.6, 1.0), vec3(1.0, 0.8, 1.0), streak) * (streak * 6.0 + 0.15 * tunnel);
          float flash = smoothstep(0.85, 1.0, uIntensity) * 3.0;
          gl_FragColor = vec4(col * uIntensity + flash, 1.0) * uIntensity;
        }`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), this.material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 100;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(intensity, time, dir) {
    this.mesh.visible = intensity > 0.001;
    this.material.uniforms.uIntensity.value = intensity;
    this.material.uniforms.uTime.value = time;
    if (dir) this.material.uniforms.uDir.value.copy(dir).normalize();
  }
}
