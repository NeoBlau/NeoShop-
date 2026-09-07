import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, MathUtils, Vector3 } from 'three';
import { movementFromKeys, useInput } from './input.js';
import { groundAt, nearestWalkable, resolveMove, type NavigationGrid } from './navigation.js';

/**
 * First-person movement through the world.
 *
 * Desktop: WASD to walk, mouse to look once the canvas is clicked (pointer
 * lock). Touch: the on-screen joystick writes into the same input store, so
 * there is one movement implementation rather than two.
 */

const EYE_HEIGHT = 1.65;
const WALK_SPEED = 3.2;
const SPRINT_SPEED = 6.0;
/** How quickly the camera reaches the target velocity. Higher is snappier. */
const ACCELERATION = 9;
const LOOK_SENSITIVITY = 0.0022;
const PITCH_LIMIT = Math.PI / 2 - 0.12;

export function PlayerControls({
  grid,
  enabled = true,
  startPosition = [0, EYE_HEIGHT, 0],
  startYaw = 0,
}: {
  /** The location's map of where a person may stand. */
  grid: NavigationGrid;
  enabled?: boolean;
  startPosition?: [number, number, number];
  /** Radians about Y. Zero looks down -Z, the renderer's own default. */
  startYaw?: number;
}) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);

  const held = useRef(new Set<string>());
  const velocity = useRef(new Vector3());
  const euler = useRef(new Euler(0, 0, 0, 'YXZ'));
  const started = useRef(false);

  const setMove = useInput((state) => state.setMove);
  const addLook = useInput((state) => state.addLook);
  const consumeLook = useInput((state) => state.consumeLook);
  const setSprint = useInput((state) => state.setSprint);
  const setPointerLocked = useInput((state) => state.setPointerLocked);

  if (!started.current) {
    started.current = true;

    // A spawn from a stale manifest, or one that lands a centimetre inside a
    // kerb, would leave the buyer unable to move at all. Nudge onto the map.
    const landing = nearestWalkable(grid, startPosition[0], startPosition[2]);
    camera.position.set(
      landing?.x ?? startPosition[0],
      startPosition[1],
      landing?.z ?? startPosition[2],
    );
    // Set rather than read: the renderer aims a fresh camera at the world
    // origin, and a view that is correct only while the scene happens to be
    // centred there is a view that breaks silently.
    euler.current.set(0, startYaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler.current);
  }

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      // Let the browser have its shortcuts back while a field has focus.
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      held.current.add(event.code);
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') setSprint(true);

      const movement = movementFromKeys(held.current);
      setMove(movement.x, movement.y);
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      held.current.delete(event.code);
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') setSprint(false);

      const movement = movementFromKeys(held.current);
      setMove(movement.x, movement.y);
    };

    // A tab switch leaves keys stuck down; clear on blur.
    const handleBlur = (): void => {
      held.current.clear();
      setMove(0, 0);
      setSprint(false);
    };

    const handleMouseMove = (event: MouseEvent): void => {
      if (document.pointerLockElement !== domElement) return;
      addLook(event.movementX * LOOK_SENSITIVITY, event.movementY * LOOK_SENSITIVITY);
    };

    const handlePointerLockChange = (): void => {
      setPointerLocked(document.pointerLockElement === domElement);
    };

    // Captured for the cleanup: the ref may point elsewhere by then.
    const heldKeys = held.current;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      heldKeys.clear();
    };
  }, [addLook, domElement, enabled, setMove, setPointerLocked, setSprint]);

  useFrame((_state, delta) => {
    if (!enabled) return;

    const look = consumeLook();
    if (look.x !== 0 || look.y !== 0) {
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= look.x;
      euler.current.x = MathUtils.clamp(euler.current.x - look.y, -PITCH_LIMIT, PITCH_LIMIT);
      camera.quaternion.setFromEuler(euler.current);
    }

    const input = useInput.getState();
    const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;

    // Movement is horizontal only: looking at the ceiling must not launch the
    // buyer into it.
    const forward = new Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new Vector3().crossVectors(forward, camera.up).normalize();

    const target = new Vector3()
      .addScaledVector(forward, input.move.y * speed)
      .addScaledVector(right, input.move.x * speed);

    // Damped rather than instant: a hard stop on key release feels like ice in
    // reverse, and a ramp costs one lerp per frame.
    velocity.current.lerp(target, Math.min(1, ACCELERATION * delta));

    // Walls are real: the location's own geometry decided where they are, and
    // the camera is tested against that map rather than against a rectangle
    // somebody typed. Kerbs, bollards, café chairs and the Vespa are all in it.
    const nextX = camera.position.x + velocity.current.x * delta;
    const nextZ = camera.position.z + velocity.current.z * delta;
    const moved = resolveMove(grid, camera.position.x, camera.position.z, nextX, nextZ);

    // Kill the velocity along an axis that was refused, so walking into a wall
    // does not store up speed that fires the buyer sideways at the next gap.
    if (moved.x === camera.position.x) velocity.current.x = 0;
    if (moved.z === camera.position.z) velocity.current.z = 0;

    // The street is not flat. Eye height follows the pavement, smoothed, so a
    // kerb is a step rather than a jolt.
    const eyeTarget = groundAt(grid, moved.x, moved.z) + EYE_HEIGHT;
    const eye = camera.position.y + (eyeTarget - camera.position.y) * Math.min(1, 12 * delta);

    camera.position.set(moved.x, eye, moved.z);
  });

  return null;
}

export { EYE_HEIGHT };
