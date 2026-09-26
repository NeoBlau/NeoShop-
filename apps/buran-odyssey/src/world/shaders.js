// Custom materials: physically based atmospheric scattering, planetary surface
// extensions (city lights, ocean glint, aerial perspective), ring shadowing,
// stellar photospheres and the bioluminescent flora.

import * as THREE from 'three';

export const GLSL_NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm3(vec3 p){float s=0.0;float a=0.5;for(int i=0;i<5;i++){s+=a*snoise(p);p*=2.03;a*=0.5;}return s;}
`;

// ---------------------------------------------------------------------------
// Single-scattering atmosphere (Rayleigh + Mie, Henyey-Greenstein phase with
// Cornette-Shanks normalisation), ray-marched per pixel with exponential
// density profiles. Units inside the shader are planet radii for precision.

export function createAtmosphereMaterial(body) {
  const a = body.atmosphere.def;
  const R = body.radius;
  const top = body.atmosphere.top;
  const Hr = body.atmosphere.H;
  const Hm = a.mieH ?? Hr / 6;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCam: { value: new THREE.Vector3() },
      uSun: { value: new THREE.Vector3(1, 0, 0) },
      uAtm: { value: 1 + top / R },
      uHR: { value: Hr / R },
      uHM: { value: Hm / R },
      uBetaR: { value: new THREE.Vector3(...a.rayleigh).multiplyScalar(R) },
      uBetaM: { value: new THREE.Vector3(...a.mie).multiplyScalar(R) },
      uG: { value: a.mieG ?? 0.76 },
      uSunI: { value: 22.0 },
      uDensityScale: { value: body.atmosphere.rho0 / (a.table ? 1.225 : body.atmosphere.rho0) },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vObj;
      void main() {
        vObj = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uCam; uniform vec3 uSun; uniform float uAtm; uniform float uHR; uniform float uHM;
      uniform vec3 uBetaR; uniform vec3 uBetaM; uniform float uG; uniform float uSunI;
      varying vec3 vObj;
      vec2 raySphere(vec3 o, vec3 d, float r) {
        float b = dot(o, d); float c = dot(o, o) - r * r; float h = b * b - c;
        if (h < 0.0) return vec2(1e9, -1e9);
        h = sqrt(h); return vec2(-b - h, -b + h);
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 dir = normalize(vObj - uCam);
        vec2 ta = raySphere(uCam, dir, uAtm);
        if (ta.x > ta.y || ta.y < 0.0) discard;
        vec2 tp = raySphere(uCam, dir, 1.0);
        float t0 = max(ta.x, 0.0);
        float t1 = ta.y;
        if (tp.x < tp.y && tp.x > 0.0) t1 = min(t1, tp.x);
        if (t1 <= t0) discard;
        const int NS = 16;
        const int NL = 4;
        float seg = (t1 - t0) / float(NS);
        vec3 sumR = vec3(0.0); vec3 sumM = vec3(0.0);
        float odR = 0.0; float odM = 0.0;
        for (int i = 0; i < NS; i++) {
          vec3 p = uCam + dir * (t0 + seg * (float(i) + 0.5));
          float h = max(length(p) - 1.0, 0.0);
          float dR = exp(-h / uHR) * seg;
          float dM = exp(-h / uHM) * seg;
          odR += dR; odM += dM;
          vec2 tps = raySphere(p, uSun, 0.998);
          if (tps.x > 0.0 && tps.x < tps.y) continue; // in the planet's shadow
          vec2 tl = raySphere(p, uSun, uAtm);
          float sl = tl.y / float(NL);
          float lR = 0.0; float lM = 0.0;
          for (int j = 0; j < NL; j++) {
            vec3 q = p + uSun * sl * (float(j) + 0.5);
            float hq = max(length(q) - 1.0, 0.0);
            lR += exp(-hq / uHR) * sl;
            lM += exp(-hq / uHM) * sl;
          }
          vec3 tau = uBetaR * (odR + lR) + uBetaM * 1.1 * (odM + lM);
          vec3 att = exp(-tau);
          sumR += dR * att; sumM += dM * att;
        }
        float mu = dot(dir, uSun);
        float phR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
        float g = uG; float g2 = g * g;
        float phM = 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
        vec3 col = uSunI * (sumR * uBetaR * phR + sumM * uBetaM * phM);
        vec3 trans = exp(-(uBetaR * odR + uBetaM * 1.1 * odM));
        float alpha = clamp(1.0 - dot(trans, vec3(0.3333)), 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  return material;
}

// ---------------------------------------------------------------------------
// Surface material shared by every terrain chunk of a body.

export function createSurfaceMaterial(options) {
  const { map, night, specular, procedural } = options;
  const material = new THREE.MeshStandardMaterial({
    map: procedural ? null : (map ?? null),
    vertexColors: true,
    roughness: 0.93,
    metalness: 0.0,
  });
  const uniforms = {
    uSunView: { value: new THREE.Vector3(0, 0, 1) },
    uNight: { value: night ?? null },
    uSpec: { value: specular ?? null },
    uFogColor: { value: new THREE.Color(0, 0, 0) },
    uFogDensity: { value: 0 },
    uNightStrength: { value: 1.6 },
  };
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.defines = shader.defines || {};
    if (night) shader.defines.USE_NIGHT = '';
    if (specular) shader.defines.USE_SPEC = '';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vViewDist;')
      .replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\nvViewDist = length(mvPosition.xyz);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vViewDist;
         uniform vec3 uSunView; uniform vec3 uFogColor; uniform float uFogDensity; uniform float uNightStrength;
         #ifdef USE_NIGHT
         uniform sampler2D uNight;
         #endif
         #ifdef USE_SPEC
         uniform sampler2D uSpec;
         #endif`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         #ifdef USE_SPEC
           float water = texture2D(uSpec, vMapUv).r;
           roughnessFactor = mix(roughnessFactor, 0.28, smoothstep(0.35, 0.7, water));
         #endif`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         #ifdef USE_NIGHT
           float sunDot = dot(normalize(vNormal), uSunView);
           vec3 lights = texture2D(uNight, vMapUv).rgb;
           totalEmissiveRadiance += lights * lights * vec3(1.0, 0.78, 0.52) * uNightStrength * smoothstep(0.08, -0.18, sunDot);
         #endif`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float fogF = 1.0 - exp(-vViewDist * uFogDensity);
         gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, clamp(fogF, 0.0, 1.0));`,
      );
  };
  material.customProgramCacheKey = () => `surface-${!!night}-${!!specular}`;
  return material;
}

// ---------------------------------------------------------------------------
// Planetary rings: radial texture, forward scattering, planet shadow.

export function createRingMaterial(texture, planetRadius) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uSunObj: { value: new THREE.Vector3(1, 0, 0) },
      uCamObj: { value: new THREE.Vector3() },
      uPlanetR: { value: planetRadius },
      uLight: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vObj;
      void main() {
        vUv = uv; vObj = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uMap; uniform vec3 uSunObj; uniform vec3 uCamObj; uniform float uPlanetR; uniform float uLight;
      varying vec2 vUv; varying vec3 vObj;
      void main() {
        #include <logdepthbuf_fragment>
        vec4 c = texture2D(uMap, vUv);
        // Shadow of the planet on the ring plane.
        vec3 p = vObj; vec3 d = uSunObj;
        float b = dot(p, d); float cc = dot(p, p) - uPlanetR * uPlanetR;
        float disc = b * b - cc;
        float shadow = (disc > 0.0 && -b - sqrt(disc) > 0.0) ? 0.06 : 1.0;
        vec3 v = normalize(uCamObj - vObj);
        float fwd = pow(max(dot(-v, d), 0.0), 6.0);
        float lit = abs(d.z) * 0.8 + 0.2;
        vec3 col = c.rgb * (lit + fwd * 1.5) * shadow * uLight;
        gl_FragColor = vec4(col, c.a * 0.95);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------------------
// Stellar photosphere with limb darkening and animated granulation.

export function createStarMaterial(texture, color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uHasMap: { value: texture ? 1 : 0 },
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uIntensity: { value: 6.0 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying vec3 vObj;
      void main() {
        vUv = uv; vObj = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      ${GLSL_NOISE}
      uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uColor; uniform float uTime; uniform float uIntensity;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying vec3 vObj;
      void main() {
        #include <logdepthbuf_fragment>
        float mu = max(dot(normalize(vN), normalize(vView)), 0.0);
        float limb = 1.0 - 0.6 * (1.0 - mu) - 0.15 * (1.0 - mu) * (1.0 - mu);
        float gran = 0.85 + 0.15 * snoise(normalize(vObj) * 90.0 + vec3(0.0, 0.0, uTime * 0.05));
        vec3 base = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb * 1.4 : uColor * gran;
        gl_FragColor = vec4(base * uColor * limb * uIntensity, 1.0);
      }`,
  });
}

export function makeGlowTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.08, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.18)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.03)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Blackbody colour (sRGB) for a photosphere temperature, after Tanner Helland's
// fit to the CIE 1964 10° colour matching functions.
export function blackbodyColor(T) {
  const t = T / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v) => Math.min(255, Math.max(0, v)) / 255;
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}
