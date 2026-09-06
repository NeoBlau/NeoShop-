/**
 * The font used for text inside the 3D scene.
 *
 * It has to be named explicitly. Left to itself, troika-three-text (what
 * drei's `<Text>` is built on) downloads a Unicode font-resolver index from a
 * public CDN on first render — which fails without internet access, is blocked
 * by the desktop shell's content security policy, and takes the whole scene
 * down with it, because the failure happens inside a Suspense boundary.
 *
 * Fetched by apps/tools/src/fetch-assets.ts.
 */
export const SCENE_FONT = '/world/fonts/inter.ttf';
