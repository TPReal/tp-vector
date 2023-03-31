import {PartialCutOptions, PartialViewBox, Sheet, gather} from '../index.ts';
import {NormaliseArgs} from '../normalise_transform.ts';
import {getAxes, getExplainerObject, getExplainerSection} from './explainer_helper.ts';

export async function getSection() {

  const centeredSquare: PartialViewBox = {centered: true, side: 2};
  const normaliseArgs: (NormaliseArgs | undefined)[] = [
    undefined,
    // StringArgs:
    "default",
    "center",
    // BoxArgs:
    {target: centeredSquare},
    {target: centeredSquare, align: {y: "bottom"}},
    {target: centeredSquare, fitting: "fill"},
    {target: centeredSquare, fitting: "fill", align: {x: "right"}},
    {target: centeredSquare, fitting: "stretch"},
    // XYArgs:
    // - Origin:
    {x: "center", y: "aboveOrigin"},
    {x: "leftOfOrigin"},
    {y: "center"},
    // - Box:
    {x: {min: 1, max: 3}},
    {x: {min: 1, max: 3}, y: {min: 0, max: 1}},
    {x: {min: 1, max: 3, align: "center"}, y: {min: 0, max: 1}},
    {x: {min: 1, max: 3}, y: {min: 0, max: 1}, fitting: "stretch"},
    {x: {min: -2}, y: {max: 0}},
    {x: {max: 1, pos: "center"}, y: "belowOrigin"},
    {x: {len: 2, pos: "center", align: "right"}, y: {pos: "default", len: 1}},
    {x: {len: 2, pos: "center"}, y: {len: 2, pos: "center"}, fitting: "fill"},
    // - Hold:
    {x: {hold: "right", scale: 0.5}},
    {x: {min: -1, len: 2, align: "right"}, y: {hold: "center", len: 1}},
    {x: {min: -1, len: 2}, y: {hold: "top"}},
    {x: {hold: "right", len: 2}, y: {hold: "bottom"}},
  ];

  const normalisationArgsWithLabels = normaliseArgs.map(args => {
    if (!args)
      return {args, label: "(original)"};
    const label = JSON.stringify(args)
      .replaceAll(/([,:])/g, "$1 ")
      .replaceAll(/"([^\\"()]+)":/g, "$1:");
    return {args, label};
  });

  const viewBox = {minX: -3, maxX: 6, minY: -3, maxY: 4} satisfies PartialViewBox;
  const demoObject = getExplainerObject({width: 3, height: 2}).translate(2, 1);
  return await getExplainerSection(Sheet.create({
    options: {name: "Normalise explainer"},
    viewBox,
    margin: 0.1,
    pieces: gather(
      getAxes(viewBox).setLayer("axes"),
      ...normalisationArgsWithLabels.map(({args, label}) => {
        let object = demoObject;
        if (args)
          object = object.normalise(args);
        return object.setLayer(label);
      }),
    ).setAttributes({stroke: "black"}),
    runs: normalisationArgsWithLabels.map(({label}): PartialCutOptions => ({
      type: "cut",
      id: label,
      layers: ["axes", label],
    })),
  }));

}
