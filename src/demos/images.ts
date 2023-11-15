import {Image, Sheet, layouts} from 'tp-vector/index.ts';

export const name = "Images demo";

export async function getSheets() {

  const [ts, js, esbuild, deno] = (await Promise.all([
    Image.fromAsset(import(`./images_ts.png`)),
    Image.fromURL(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/JavaScript-logo.png/240px-JavaScript-logo.png"),
    Image.fromURL(
      "https://raw.githubusercontent.com/evanw/esbuild/main/images/logo.svg"),
    Image.fromURL(
      "https://upload.wikimedia.org/wikipedia/commons/8/84/Deno.svg"),
  ])).map(img => img.centerAndFitTo1By1());
  const gap = 0.05;

  return Sheet.create({
    options: {name, resolution: {pixelsPerInch: 2000}},
    pieces: layouts.pack({
      pieces: [[
        [ts, js],
        [esbuild, deno],
      ]],
      gap,
    }).setLayer("print"),
    margin: 0,
  });

}
