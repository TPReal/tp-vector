import * as figures from '../figures.ts';
import {gather} from '../pieces.ts';
import {Point} from '../point.ts';
import {Sheet} from '../sheet.ts';
import {turtleSolve} from '../solver.ts';
import {Turtle} from '../turtle.ts';

export const name = "Solver demo";

export function getSheets() {

  const angleRange = [-78, 130];
  const angleStep = 8;
  const ballCenter: Point = [2, -4];
  const ballR = 1.82;

  const pieces = gather(
    Turtle.create()
      .right(angleRange[0])
      .branches((angleRange[1] - angleRange[0]) / angleStep, (t, i) =>
        t.right(angleStep * i)
          .andThen(t => t.angleDeg > 0 ?
            t.forward(1) :
            // Go forward to the y=-1 line.
            t.andThen(turtleSolve, {
              action: (t, x) => t.forward(x),
              findZero: t => t.pos[1] + 1,
            })
          )
          .circle(0.05)
          // Make an arc ending on the y=-2 line.
          .andThen(turtleSolve, {
            action: (t, x) => t.arcLeft(t.angleDeg, Math.sign(t.angleDeg) * x),
            findZero: t => t.pos[1] + 2,
          })
          .circle(0.05)
          // Make an arc ending on the ball, or 175 degrees if not hitting the ball.
          .andThen(t => {
            const action = (t: Turtle, x: number) => t.arcLeft(Math.sign(t.pos[0]) * x, t.pos[0]);
            const t0 = performance.now();
            try {
              return t.andThen(turtleSolve, {
                testAction: action,
                findZero: t => (t.pos[0] - ballCenter[0]) ** 2 + (t.pos[1] - ballCenter[1]) ** 2 - ballR ** 2,
                params: {
                  maxStep: 5, valueOnNotFound: -1
                },
                action: (t, x) => x >= 0 ? t.andThen(action, x).circle(0.05) : t.andThen(action, 175),
              });
            } finally {
              const t1 = performance.now();
              console.debug(`Solver time: ${(t1 - t0).toFixed(1)}ms`);
            }
          })
      ),
    figures.circle({center: ballCenter, radius: ballR - 0.1}),
  );

  return Sheet.create({
    options: {name},
    pieces,
  });

}
