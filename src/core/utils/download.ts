/**
 * Safe client-side file download utilities.
 * Automatically allocates and revokes object URLs without leaking memory.
 */

export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 1000);
}

export function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string = "application/pdf"
): void {
  const blob = new Blob([bytes as any], { type: mimeType });
  downloadBlob(blob, fileName);
}
