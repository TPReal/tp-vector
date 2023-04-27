import {loadEvent} from './internal_util.ts';

export function fromText({mimeType, text}: {
  mimeType: string,
  text: string,
}) {
  return fromBase64({mimeType, base64Data: btoa(text)});
}

export function fromBase64({mimeType, base64Data}: {
  mimeType: string,
  base64Data: string,
}) {
  return `data:${mimeType};base64,${base64Data}`;
}

export async function fromBlob(blob: Blob) {
  const fileReader = new FileReader();
  const loaded = loadEvent(fileReader);
  fileReader.readAsDataURL(blob);
  await loaded;
  return fileReader.result as string;
}

export function isDataURI(url: string) {
  return url.startsWith("data:");
}

/**
 * Returns a data URI representing the specified resource.
 * If the URL is a data URI, it is returned directly. Otherwise the resource is fetched and
 * converted to a data URI, with the MIME type specified by the server.
 */
export async function urlToDataURI(url: string) {
  if (isDataURI(url))
    return url;
  let blob;
  try {
    blob = await (await fetch(url)).blob();
  } catch (e) {
    throw new Error(`Failed to fetch: ${url}\n${e}`, {cause: e});
  }
  return await fromBlob(blob);
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
