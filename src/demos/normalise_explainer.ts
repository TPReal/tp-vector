import {PartialCutOptions, PartialViewBox, Sheet, figures, gather} from 'tp-vector/index.ts';
import {NormaliseArgs} from 'tp-vector/normalise_transform.ts';
import {getAxes, getExplainerObject, getExplainerSection} from './explainer_helper.ts';

export async function getSection() {

  const target: PartialViewBox = {centered: true, side: 2};
  const normaliseArgs: {
    args: NormaliseArgs | undefined,
    target?: PartialViewBox,
  }[] = [
      {args: undefined},
      // StringArgs:
      {args: "default"},
      {args: "center"},
      {args: "aboveOrigin"},
      // BoxArgs:
      {args: {target}, target},
      {args: {target, align: "center"}, target},
      {args: {target, align: "bottom"}, target},
      {args: {target, fitting: "fill"}, target},
      {args: {target, fitting: "fill", align: "center"}, target},
      {args: {target, fitting: "stretch"}, target},
      // XYArgs:
      // - Origin:
      {args: {x: "center", y: "aboveOrigin"}},
      {args: {x: "leftOfOrigin"}},
      {args: {y: "center"}},
      // - Box:
      {args: {x: {min: 1, max: 3}}},
      {args: {x: {min: 1, max: 3}, y: {min: 0, max: 1}}},
      {args: {x: {min: 1, max: 3, align: "center"}, y: {min: 0, max: 1}}},
      {args: {x: {min: 1, max: 3}, y: {min: 0, max: 1}, fitting: "stretch"}},
      {args: {x: {min: -2}, y: {max: 0}}},
      {args: {x: {max: 1, pos: "center"}, y: "belowOrigin"}},
      {args: {x: {len: 2, pos: "center", align: "right"}, y: {pos: "default", len: 1}}},
      {args: {x: {len: 2, pos: "center"}, y: {len: 2, pos: "center"}, fitting: "fill"}},
      // - Hold:
      {args: {x: {hold: "right", scale: 0.5}}},
      {args: {x: {min: -1, len: 2, align: "right"}, y: {hold: "center", len: 1}}},
      {args: {x: {min: -1, len: 2}, y: {hold: "top"}}},
      {args: {x: {hold: "right", len: 2}, y: {hold: "bottom"}}},
    ];

  const normalisationArgsWithLabels = normaliseArgs.map(({args, target}) => ({
    args,
    target,
    label: args ? JSON.stringify(args)
      .replaceAll(/([,:])/g, "$1 ")
      .replaceAll(/"([^\\"()]+)":/g, "$1:") :
      "(original)",
  }));

  const viewBox = {minX: -3, maxX: 6, minY: -3, maxY: 4} satisfies PartialViewBox;
  const axes = getAxes(viewBox);
  const demoObject = getExplainerObject({width: 3, height: 2}).translate(2, 1);
  return await getExplainerSection(Sheet.create({
    options: {name: "Normalise explainer"},
    viewBox,
    margin: 0.1,
    pieces: gather(
      axes.setLayer("axes"),
      ...normalisationArgsWithLabels.map(({args, target, label}) => gather(
        (args ? demoObject.normalise(args) : demoObject),
        target && figures.rectangle(target).setAttributes({stroke: "green"}),
      ).setLayer(label)),
    ).setAttributes({stroke: "black"}),
    runs: normalisationArgsWithLabels.map(({label}): PartialCutOptions => ({
      type: "cut",
      id: label,
      layers: ["axes", label],
    })),
  }));

}
