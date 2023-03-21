export function fromBinary({mimeType, binData}: {
  mimeType: string,
  binData: string | Uint8Array | readonly number[],
}) {
  if (typeof binData !== "string")
    // TODO: Optimise.
    binData = String.fromCharCode(...binData);
  return fromBase64({base64Data: btoa(binData), mimeType});
}

export function fromBase64({mimeType, base64Data}: {
  mimeType: string,
  base64Data: string,
}) {
  return `data:${mimeType};base64,${base64Data}`;
}

export async function fromBlob(blob: Blob) {
  return fromBinary({
    mimeType: blob.type,
    binData: new Uint8Array(await blob.arrayBuffer()),
  });
}

export function isDataURI(url: string) {
  return url.startsWith("data:");
}

/**
 * Returns a data URI representing the specified resource.
 * If the URL is a data URI, it is returned directly. Otherwise the resource is fetched and
 * converted to data URI, with the MIME type specified by the server.
 */
export async function urlToDataURI(url: string) {
  if (isDataURI(url))
    return url;
  return await fromBlob(await (await fetch(url)).blob());
}

export const DEFAULT_MIME_TYPE = "application/octet-stream";

const MIME_TYPES_BY_EXT = {
  // Fonts:
  woff: "font/woff",
  woff2: "font/woff2",
  otf: "font/otf",
  ttf: "font/ttf",
  // Images:
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

export function mimeTypeFromExt(ext: string) {
  return (MIME_TYPES_BY_EXT as Partial<Record<string, string>>)[ext] || DEFAULT_MIME_TYPE;
}
