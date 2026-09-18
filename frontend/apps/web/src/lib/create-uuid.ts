/** Works on non-secure origins such as `*.localhost.test` where `crypto.randomUUID` is unavailable. */
export function createUuid(): string {
  const cryptoObj = globalThis.crypto;

  if (typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof cryptoObj.getRandomValues === "function") {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Per RFC 4122 §4.4: set version (4) and variant (10xx) bits. Applied during
  // the hex build so the bytes are only ever read through the iterator, which
  // yields `number` rather than `number | undefined`.
  const hex = Array.from(bytes, (byte, index) => {
    const adjusted = index === 6 ? (byte & 0x0f) | 0x40 : index === 8 ? (byte & 0x3f) | 0x80 : byte;
    return adjusted.toString(16).padStart(2, "0");
  }).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
