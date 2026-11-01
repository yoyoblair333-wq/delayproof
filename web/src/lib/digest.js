// Canonical code digest: normalise line endings (Windows editors change them)
// and keep exactly one final newline before hashing. Cannot hide a code change.
export function canonical(text) {
  return text.replace(/\r\n?/g, "\n").replace(/\n+$/, "") + "\n";
}
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
