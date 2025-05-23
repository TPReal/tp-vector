import * as layouts from '../layouts.ts';
import {gather} from '../pieces.ts';
import {Sheet} from '../sheet.ts';
import {Turtle} from '../turtle.ts';

export const name = "Turtle demo";

export function getSheets() {

  return Sheet.create({
    options: {name},
    pieces: layouts.row({
      pieces: [

        (() => {
          let t = Turtle.create();
          const end = t.forward(1).right().forward(0.5);
          for (let speed = 0.35; speed <= 2; speed += 0.3)
            // The same curve with different target speeds.
            t = t.branch(t => t.curveTo(end, {startSpeed: 1.6, targetSpeed: speed}));
          return t;
        })(),

        (() => {
          function fu(t: Turtle, size: number) {
            return t.right().forward(size / 2)
              .halfEllipseRight(size + 2, 2 * size);
          }
          let t = Turtle.create().forward(10);
          for (let i = 1; i <= 5; i++)
            // In each iteration go forward, and then branch to the side.
            t = t.forward(1).branch(fu, i);
          return t;
        })(),

        (() => {
          const n = 11;
          const m = 4;
          return Turtle.create().right(1.75 * 360 / n)
            // Five sides of a self-intersecting regular 11-sided polygon.
            .repeat(5, t => t.right(360 * m / n).forward(1))
            .extendBoundingBox({right: -0.2});
        })(),

        (() => {
          let t = Turtle.create();
          // A spiral.
          for (let i = 1; i < 10; i++)
            t = t.arcLeft(90, i).forward(3).arcLeft(90, i)
          return t.arcLeft(110, 16);
        })(),

        Turtle.create()
          .arcRight(160, 1)
          .branch(t => t
            .right(140)
            // Save this position and angle.
            .push()
          )
          .withPenUp(t => t.arcRight(40, 1))
          .branch(t => t
            .left(140)
            // Draw a curve from the saved position.
            .curveFromPeek({speed: 0.6})
            .curveFromPop({speed: 0.8})
          )
          .arcRight(160, 1),

        (() => {
          // A recursive function for drawing a fractal.
          function rec(t: Turtle, level: number): Turtle {
            if (!level)
              return t;
            return t
              .forward(1 << level)
              .branch(t => t.right(80).andThen(rec, level - 1))
              .branch(t => t.left(80).andThen(rec, level - 1));
          }
          return Turtle.create().andThen(rec, 6);
        })(),

        (() => {
          const n = 13;
          const t = Turtle.create()
            .circle(1)
            .penUp()
            .repeat(n, t => t
              .right(360 / n)
              .branch(t => t
                .strafeRight(1.08)
                .withPenDown(t => t.ellipse(0.2, 0.35))
              )
            );
          // A collection of circles, both as a line and as a figure.
          return gather(
            t.setAttributes({fill: "#ddd", fillRule: "evenodd"})
              .setLayer("print"),
            t,
          );
        })(),

        // A simple curve.
        Turtle.create().right(10)
          .curve(t => t.forward(1).right(90).forward(0.5), {speed: 4})
          .curve(t => t.forward(2).lookDown().right(10).forward(4))
          .curve(t => t.forward(1).left(130).forward(2))
          .extendBoundingBox({left: -1}),

      ].map((pc, i) => pc
        .normalise({target: {side: 1, minX: 0, maxY: 0}})
        .scale(i < 3 ? 1 : 0.6)),
      gap: 0.1,
    }),
    margin: 0.1,
  });

}
