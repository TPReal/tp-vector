import {Sheet, createText, figures, gather, layouts, Turtle, Font} from '../index.ts';

export async function getSheet() {

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
    let t = Turtle.create()
      .circle(p.outerR)
      .right(360 / p.numDents * (0.5 / (p.dentToSpaceRatio + 1)))
      .withPenUp(t => t.strafeLeft(p.dentsR));
    for (let i = 0; i < p.numDents; i++)
      t = t
        .arcRight(360 / p.numDents * (p.dentToSpaceRatio / (p.dentToSpaceRatio + 1)), p.dentsR)
        .right(p.dentAngle)
        .curveTo(
          t.arcRight(360 / p.numDents, p.dentsR).left(p.dentAngle),
          {speed: p.dentSpeed},
        )
        .right(p.dentAngle);
    t = t
      .penUp()
      .arcRight(-360 / p.numDents * (0.5 / (p.dentToSpaceRatio + 1)), p.dentsR)
      .strafeRight(p.dentCirclePos);
    for (let i = 0; i < p.numDents; i++)
      t = t
        .withPenDown(t => t.circle(p.dentCircleR))
        .arcRight(360 / p.numDents, p.dentsR - p.dentCirclePos);
    const dents = t.setAttributes({fillRule: "evenodd"});
    return gather(
      figures.circle({radius: p.coinR}),
      gather(
        dents,
        createText("1", {
          font: (await Font.googleFonts("Sawarabi Mincho"))
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
    let t = Turtle.create()
      .circle(p.outerR + 0.2)
      .left(360 / p.numDents / 4)
      .withPenUp(t => t.strafeLeft(p.dentsR));
    for (let i = 0; i < p.numDents; i++)
      t = t
        .right(p.dentAngle)
        .curveTo(
          t.arcRight(360 / p.numDents, p.dentsR).right(p.dentAngle),
          {speed: p.dentSpeed},
        )
        .left(p.dentAngle);
    return gather(
      figures.circle({radius: p.coinR}),
      gather(
        t.setAttributes({fillRule: "evenodd"}),
        createText("2", {
          font: await Font.googleFonts("Domine"),
          size: 18,
        }).center().moveDown(0.5),
      ).andThen(pc => gather(
        pc.setLayer("print"),
        pc.flipX().setLayer("print_back"),
      )),
    );
  })();

  const coin5 = await (async () => {
    const p = {
      coinR: 12,
      outerR: 11.5,
      innerR: 10.6,
      numDents: 18,
    };
    let t = Turtle.create()
      .lookLeft()
      .left(360 / p.numDents / 4)
      .withPenUp(t => t.strafeLeft(p.innerR));
    for (let i = 0; i < p.numDents; i++)
      t = t
        .arcRight(360 / p.numDents / 2, p.innerR)
        .strafeLeft(p.outerR - p.innerR)
        .arcRight(360 / p.numDents / 2, p.outerR)
        .strafeRight(p.outerR - p.innerR);
    return gather(
      figures.circle({radius: p.coinR}),
      gather(
        t.setAttributes({fillRule: "evenodd"}),
        createText("5", {
          font: (await Font.googleFonts("Vidaloka")).setFontAttributes({bold: true}),
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
    options: {name: "Coins", millimetersPerUnit: 1},
    pieces: layouts.column({
      pieces: [0, 1, 2].map(i => layouts.row(
        ...coins.slice(i), ...coins.slice(0, i),
      )),
      gap: -1,
    }),
    runs: [
      {type: "print", id: "print_back", side: "back"},
      {type: "print"},
      {type: "cut"},
    ],
  });

}
