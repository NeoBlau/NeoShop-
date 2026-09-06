import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useInput } from './input.js';

/**
 * Touch controls: a thumbstick on the left for walking, a drag anywhere on the
 * right for looking.
 *
 * Both write into the same input store the keyboard and mouse use, so there is
 * one movement implementation rather than a phone-shaped copy of it.
 */

const STICK_RADIUS = 52;
const LOOK_SENSITIVITY = 0.0055;

export function TouchControls() {
  const setMove = useInput((state) => state.setMove);
  const addLook = useInput((state) => state.addLook);

  const stickRef = useRef<HTMLDivElement>(null);
  const stickPointer = useRef<number | null>(null);
  const lookPointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateStick = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const base = stickRef.current?.getBoundingClientRect();
      if (!base) return;

      const centreX = base.left + base.width / 2;
      const centreY = base.top + base.height / 2;
      let dx = event.clientX - centreX;
      let dy = event.clientY - centreY;

      const distance = Math.hypot(dx, dy);
      if (distance > STICK_RADIUS) {
        dx = (dx / distance) * STICK_RADIUS;
        dy = (dy / distance) * STICK_RADIUS;
      }

      setKnob({ x: dx, y: dy });
      // Screen y grows downwards; forward is negative y.
      setMove(dx / STICK_RADIUS, -dy / STICK_RADIUS);
    },
    [setMove],
  );

  const releaseStick = useCallback(() => {
    stickPointer.current = null;
    setKnob({ x: 0, y: 0 });
    setMove(0, 0);
  }, [setMove]);

  return (
    <>
      {/* Look area: everything except the stick. Pointer events pass through
          to the canvas for taps, so a product can still be tapped. */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={(event) => {
          if (stickPointer.current === event.pointerId) return;
          lookPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const active = lookPointer.current;
          if (!active || active.id !== event.pointerId) return;

          addLook(
            (event.clientX - active.x) * LOOK_SENSITIVITY,
            (event.clientY - active.y) * LOOK_SENSITIVITY,
          );
          active.x = event.clientX;
          active.y = event.clientY;
        }}
        onPointerUp={(event) => {
          if (lookPointer.current?.id === event.pointerId) lookPointer.current = null;
        }}
        onPointerCancel={() => {
          lookPointer.current = null;
        }}
      />

      <div
        ref={stickRef}
        className="border-edge-strong bg-void/50 absolute bottom-6 left-6 h-32 w-32 touch-none rounded-full border backdrop-blur"
        onPointerDown={(event) => {
          event.stopPropagation();
          stickPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateStick(event);
        }}
        onPointerMove={(event) => {
          if (stickPointer.current !== event.pointerId) return;
          event.stopPropagation();
          updateStick(event);
        }}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
      >
        <div
          className="bg-accent/80 absolute top-1/2 left-1/2 h-12 w-12 rounded-full"
          style={{ transform: `translate(-50%, -50%) translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>
    </>
  );
}
