import {Sheet, Turtle, figures, gather, layouts} from '../index.ts';

const N = 15, M = 10;

const p = {
  x1B: 0.1,
  angle1B: 7,
  fwdBase: 0.25,
  fwdB: 0.1,
  y2B: 0.05,
  x2Base: 0.25,
  x2B: 0.05,
  angle2B: 10,
  speedBase: 0.35,
  speedB: 0.05,
}

function rb(b: number, base = 0) {
  return base + (Math.random() - 0.5) * 2 * b;
}

function jigsaw(len: number) {
  let t0 = Turtle.create().lookDown();
  let t = t0.withPenUp(t => t.strafeRight(rb(p.x1B)).right(rb(p.angle1B)));
  for (let i = 0; i < len; i++) {
    const mid = t0.forward(rb(p.y2B, 0.5))
      .strafeRight((Math.random() < 0.5 ? 1 : -1) * rb(p.x2B, p.x2Base))
      .right(rb(p.angle2B));
    t0 = t0.forward(1);
    const out = t0.strafeRight(rb(p.x1B)).right(rb(p.angle1B));
    t = t.forward(rb(p.fwdB, p.fwdBase)).curveTo(mid, {speed: rb(p.speedB, p.speedBase)})
      .curveTo(out.back(rb(p.fwdB, p.fwdBase)), {speed: rb(p.speedB, p.speedBase)}).goTo(out.pos);
  }
  return t;
}

const jigsawPuzzle = gather(
  layouts.layout({
    count: {from: 1, to: N - 1},
    pieceFunc: i => jigsaw(M).moveRight(i),
  }),
  layouts.layout({
    count: {from: 1, to: M - 1},
    pieceFunc: i => jigsaw(N).rotateLeft().moveDown(i),
  }),
  figures.rectangle({width: N, height: M, cornerRadius: 0.3}),
);

export const SHEET = Sheet.create({
  options: {name: "Jigsaw puzzle"},
  pieces: jigsawPuzzle,
  margin: 0,
});
