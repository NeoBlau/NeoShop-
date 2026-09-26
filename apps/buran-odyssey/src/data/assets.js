// Every external asset the game streams, pinned to an exact commit so a CDN
// never serves something different from what was checked. Each entry is tried
// from the local `assets/` folder first (populated by `node tools/fetch-assets.mjs`
// for offline / installed play), then jsDelivr, then raw GitHub.
//
// Sources and licences:
//  * Solar System Scope textures (CC BY 4.0), derived from NASA mission data:
//    MESSENGER (Mercury), Magellan (Venus), Viking/MGS (Mars), Cassini/Juno
//    (giants), Voyager (Uranus/Neptune).
//  * NASA/JPL: Blue Marble, Black Marble (city lights), LRO LOLA (Moon relief),
//    MGS MOLA (Mars relief), MESSENGER MLA (Mercury), Magellan altimetry (Venus),
//    New Horizons (Pluto), Galileo (Io, Europa, Ganymede).

const SSS = {
  repo: 'SoumyaEXE/3d-Solar-System-ThreeJS',
  sha: '0d305aec31db5328c66a6d3e66da444dce8bc6dc',
  dir: 'public/textures/',
};
const SB = {
  repo: 'sanderblue/solar-system-threejs',
  sha: 'e6f0f57968c7dee8e6057619e7a91760622c3256',
  dir: 'src/assets/textures/',
};

const a = (src, path, bytes) => ({ src, path, bytes });

export const ASSETS = {
  stars8k: a(SSS, '8k_stars.jpg', 1905513),
  stars2k: a(SSS, 'stars.jpg', 251454),
  sun: a(SSS, '8k_sun.jpg', 3696361),
  mercury: a(SSS, 'mercury.jpg', 872555),
  mercuryTopo: a(SB, 'mercury_topo.jpg', 611789),
  venusSurface: a(SSS, 'venus.jpg', 885075),
  venusTopo: a(SB, 'venus_topo.jpg', 251909),
  earthDay: a(SB, 'earth_4k.jpg', 3443180),
  earthNight: a(SB, 'earth_night_4k.jpg', 995929),
  earthClouds: a(SB, 'earth_clouds_4k.png', 3424929),
  earthOcean: a(SB, 'earth_ocean_reflectance_4k.jpg', 759994),
  earthTopo: a(SB, 'earth_topo_4k.jpg', 413118),
  moon: a(SB, 'moon_4k.jpg', 5987920),
  moonTopo: a(SB, 'moon_topo_4k.jpg', 2719107),
  mars: a(SSS, 'mars.jpg', 750547),
  marsTopo: a(SB, 'mars_topo.jpg', 93144),
  jupiter: a(SB, 'jupiter_4k.jpg', 861367),
  io: a(SB, 'jupiter/satellites/io.jpg', 113606),
  europa: a(SB, 'jupiter/satellites/europa.jpg', 45037),
  ganymede: a(SB, 'jupiter/satellites/ganymede.jpg', 61366),
  saturn: a(SSS, 'saturn.jpg', 199916),
  saturnRing: a(SSS, 'saturn_ring.png', 12119),
  uranus: a(SSS, 'uranus.jpg', 77751),
  neptune: a(SSS, 'neptune.jpg', 241580),
  pluto: a(SB, 'pluto_2k.jpg', 1098046),
  plutoTopo: a(SB, 'pluto_topo_2k.jpg', 587192),
};

export function localName(key) {
  const e = ASSETS[key];
  return key + e.path.slice(e.path.lastIndexOf('.'));
}

export function remoteUrls(key) {
  const e = ASSETS[key];
  const { repo, sha, dir } = e.src;
  const path = (dir + e.path).split('/').map(encodeURIComponent).join('/');
  return [
    `https://cdn.jsdelivr.net/gh/${repo}@${sha}/${path}`,
    `https://raw.githubusercontent.com/${repo}/${sha}/${path}`,
  ];
}

export const THREE_VERSION = '0.169.0';
