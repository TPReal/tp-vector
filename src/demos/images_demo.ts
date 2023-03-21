import {Sheet, layouts, Image} from '../index.ts';

const [ts, js, esbuild, deno] = (await Promise.all([
  Image.fromAsset(import(`./images_demo_ts.png`)),
  Image.fromURL(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/JavaScript-logo.png/240px-JavaScript-logo.png"),
  Image.fromURL(
    "https://raw.githubusercontent.com/evanw/esbuild/main/images/logo.svg"),
  Image.fromURL(
    "https://upload.wikimedia.org/wikipedia/commons/8/84/Deno.svg"),
])).map(img => img.centerAndFitTo1By1());
const gap = 0.05;

export const SHEET = Sheet.create({
  options: {name: "Images demo", resolution: {pixelsPerInch: 2000}},
  pieces: layouts.column({
    pieces: [[ts, js], [esbuild, deno]].map(pieces => layouts.row({pieces, gap})),
    gap,
  }).setLayer("print"),
  margin: 0,
});
