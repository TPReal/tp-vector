import {Font, Sheet, Turtle, createText, figures, gather, layouts} from 'tp-vector/index.ts';

export const name = "Coins";

export async function getSheets() {

  const coin1 = await (async () => {
    const p = {
      coinR: 11,
      outerR: 10.5,
      dentsR: 10,
      numDents: 16,
      dentToSpaceRatio: 1.7,
      dentAngle: 130,
      dentSpeed: 3,
      dentCirclePos: 0.9,
      dentCircleR: 0.5,
    };
    const t = Turtle.create()
      .circle(p.outerR)
      .right(360 / p.numDents * (0.5 / (p.dentToSpaceRatio + 1)))
      .withPenUp(t => t.strafeLeft(p.dentsR))
      .repeat(p.numDents, t => t
        .arcRight(360 / p.numDents * (p.dentToSpaceRatio / (p.dentToSpaceRatio + 1)), p.dentsR)
        .right(p.dentAngle)
        .curveTo(
          t.arcRight(360 / p.numDents, p.dentsR).left(p.dentAngle),
          {speed: p.dentSpeed},
        )
        .right(p.dentAngle)
      )
      .penUp()
      .arcRight(-360 / p.numDents * (0.5 / (p.dentToSpaceRatio + 1)), p.dentsR)
      .strafeRight(p.dentCirclePos)
      .repeat(p.numDents, t => t
        .withPenDown(t => t.circle(p.dentCircleR))
        .arcRight(360 / p.numDents, p.dentsR - p.dentCirclePos)
      );
    const dents = t.setAttributes({fillRule: "evenodd"});
    return gather(
      figures.circle({radius: p.coinR}),
      gather(
        dents,
        createText("1", {
          font: (await Font.googleFonts("Sawarabi Mincho", {text: "1"}))
            .setFontAttributes({bold: true}),
          size: 13,
        }).center(),
      ).andThen(pc => gather(
        pc.setLayer("print"),
        pc.flipX().setLayer("print_back"),
      )),
    );
  })();

  const coin2 = await (async () => {
    const p = {
      coinR: 10,
      outerR: 9.3,
      dentsR: 8.5,
      numDents: 10,
      dentAngle: 50,
      dentSpeed: 3,
    };
    const innerShapeT = Turtle.create()
      .branch(t => t
        .left(360 / p.numDents / 4)
        .withPenUp(t => t.strafeLeft(p.dentsR))
        .repeat(p.numDents, t => t
          .right(p.dentAngle)
          .curveTo(
            t.arcRight(360 / p.numDents, p.dentsR).right(p.dentAngle),
            {speed: p.dentSpeed},
          )
          .left(p.dentAngle)
        )
      );
    const t = innerShapeT.circle(p.outerR + 0.2);
    return gather(
      figures.circle({radius: p.coinR}),
      gather(
        t.setAttributes({fillRule: "evenodd"}),
        createText("2", {
          font: await Font.googleFonts("Domine", {text: "2"}),
          size: 18,
        }).center().moveDown(0.5),
      ).andThen(pc => gather(
        pc.setLayer("print"),
        pc.flipX().setLayer("print_back"),
      )),
      // Additionally score the inner shape.
      innerShapeT.setLayer("score"),
      innerShapeT.flipX().setLayer("score_back"),
    );
  })();

  const coin5 = await (async () => {
    const p = {
      coinR: 12,
      outerR: 11.5,
      innerR: 10.6,
      numDents: 18,
    };
    const t = Turtle.create()
      .lookLeft()
      .left(360 / p.numDents / 4)
      .withPenUp(t => t.strafeLeft(p.innerR))
      .repeat(p.numDents, t => t
        .arcRight(360 / p.numDents / 2, p.innerR)
        .strafeLeft(p.outerR - p.innerR)
        .arcRight(360 / p.numDents / 2, p.outerR)
        .strafeRight(p.outerR - p.innerR)
      );
    return gather(
      figures.circle({radius: p.coinR}),
      gather(
        t.setAttributes({fillRule: "evenodd"}),
        createText("5", {
          font: (await Font.googleFonts("Vidaloka", {text: "5"})).setFontAttributes({bold: true}),
          size: 20,
        }).center().moveDown(1)
          .setAttributes({fill: "white"}),
      ).andThen(pc => gather(
        pc.setLayer("print"),
        pc.flipX().setLayer("print_back"),
      )),
    );
  })();

  const coins = [coin1, coin2, coin5];

  return Sheet.create({
    options: {name, millimetersPerUnit: 1},
    pieces: layouts.column({
      pieces: coins.map((_c, i) => layouts.row(
        ...coins.slice(i), ...coins.slice(0, i),
      )),
      gap: -1,
    }),
    runs: [
      {type: "print", id: "print_back", side: "back"},
      {type: "cut", id: "score_back", side: "back"},
      {type: "print"},
      {type: "cut", id: "score"},
      {type: "cut"},
    ],
  });

  // See a photo: wiki/demos_coins.jpg

}
