// deno-lint-ignore no-explicit-any
let JSZip: any;

/**
 * Fetches and returns the JSZip library.
 * @see https://stuk.github.io/jszip/
 */
export async function getJSZip() {
  if (!JSZip) {
    const code = await (await fetch("https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js")).text();
    JSZip = new Function(`${code};return JSZip;`)();
  }
  return JSZip;
}

export async function newJSZip() {
  return new (await getJSZip())();
}
