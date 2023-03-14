import {PartialCutOptions, PartialViewBox, Sheet, gather} from '../index.ts';
import {NormaliseArgs} from '../normalise_transform.ts';
import {getAxis, getDemoObject, getDemoSection} from './helpers.ts';

const centeredSq: PartialViewBox = {centered: true, side: 2};

const NORMALISATION_ARGS: (NormaliseArgs | undefined)[] = [
  undefined,
  // StringArgs:
  "default",
  "center",
  // BoxArgs:
  {target: centeredSq},
  {target: centeredSq, align: {y: "bottom"}},
  {target: centeredSq, fitting: "fill"},
  {target: centeredSq, fitting: "fill", align: {x: "right"}},
  {target: centeredSq, fitting: "stretch"},
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

const normalisationArgsWithLabels = NORMALISATION_ARGS.map(args => {
  if (!args)
    return {args, label: "(original)"};
  const label = JSON.stringify(args).replace(/,/g, ", ").replace(/"([^\\"()]+)":/g, "$1:");
  return {args, label};
});

const viewBox = {minX: -3, maxX: 6, minY: -3, maxY: 4};

const axes = gather(
  getAxis({min: viewBox.minX, max: viewBox.maxX}),
  getAxis({min: viewBox.minY, max: viewBox.maxY}).rotateRight(),
);

export function getDemo() {
  const demoObject = getDemoObject({width: 3, height: 2}).translate(2, 1);
  return getDemoSection(Sheet.create({
    options: {name: "tf_demo"},
    viewBox,
    margin: 0.1,
    pieces: gather(
      axes.setLayer("axes"),
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
