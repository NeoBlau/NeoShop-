import { useRef, useState, type DragEvent, type ReactNode } from 'react';

/**
 * Drag-and-drop target that also works as a plain file button — dragging is a
 * convenience, never the only way in.
 */
export function FileDrop({
  accept,
  buttonLabel,
  disabled = false,
  onFile,
  children,
}: {
  accept: string;
  buttonLabel: string;
  disabled?: boolean;
  onFile: (file: File) => void;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;

    const file = event.dataTransfer.files.item(0);
    if (file) onFile(file);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-[var(--radius-panel)] border border-dashed p-8 text-center transition-colors ${
        dragging ? 'border-accent bg-panel-raised' : 'border-edge-strong bg-panel'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {children}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.item(0);
          if (file) onFile(file);
          // Reset so picking the same file again still fires a change event.
          event.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="border-edge-strong hover:bg-panel-raised mt-4 rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
