import { useRef } from "react";

type Props = {
  onFile: (file: File) => void;
  busy: boolean;
};

/** "Upload PDF" button backed by a hidden file input. */
export function UploadButton({ onFile, busy }: Props) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className="upload-btn"
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        {busy ? "Opening…" : "Upload PDF"}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
    </>
  );
}
