import {NormaliseArgs, PartialCutOptions, PartialViewBox, Sheet, figures, gather} from 'tp-vector/index.ts';
import {getAxes, getExplainerObject, getExplainerSection} from './explainer_helper.ts';

export const name = "Normalise explainer";

export const element = async () => {

  const objBox = {minX: 2, width: 3, minY: 1, height: 2} satisfies PartialViewBox;
  const target: PartialViewBox = {centered: true, side: 2};
  const tBase = {minX: -10, maxX: 10, minY: -10, maxY: 10};
  const normaliseArgs: {
    args: NormaliseArgs | undefined,
    target?: PartialViewBox,
    holdX?: number,
    holdY?: number,
  }[] = [
      {args: undefined},
      // StringArgs:
      {args: "default"},
      {args: "center"},
      {args: "aboveOrigin"},
      // BoxArgs:
      {args: {target}, target},
      {args: {target, align: "center"}, target},
      {args: {target, align: {x: "right", y: "bottom"}}, target},
      {args: {target, fitting: "fill"}, target},
      {args: {target, fitting: "fill", align: "center"}, target},
      {args: {target, fitting: "stretch"}, target},
      // XYArgs:
      // - Origin:
      {args: {x: "rightOfOrigin", y: "aboveOrigin"}},
      {args: {x: "rightOfOrigin"}},
      // - Box:
      {args: {x: {min: 1, max: 3}}, target: {...tBase, x: {min: 1, max: 3}}},
      {args: {x: {min: 1, max: 3}, y: {min: 0, max: 1}}, target: {x: {min: 1, max: 3}, y: {min: 0, max: 1}}},
      {args: {x: {min: 1, max: 3, align: "center"}, y: {min: 0, max: 1}}, target: {x: {min: 1, max: 3}, y: {min: 0, max: 1}}},
      {args: {x: {min: 1, max: 3}, y: {min: 0, max: 1}, fitting: "stretch"}, target: {x: {min: 1, max: 3}, y: {min: 0, max: 1}}},
      {args: {x: {min: -2}, y: {max: 0}}, target: {x: {min: -2, max: 10}, y: {max: 0, min: -10}}},
      {args: {x: {max: 1, pos: "center"}, y: "belowOrigin"}, target: {...tBase, x: {max: 1, pos: "center"}}},
      {args: {x: {len: 2, pos: "center", align: "right"}, y: {pos: "default", len: 1}}, target: {x: {len: 2, pos: "center"}, y: {pos: "default", len: 1}}},
      {args: {x: {len: 2, pos: "center"}, y: {len: 2, pos: "center"}, fitting: "fill"}, target: {x: {len: 2, pos: "center"}, y: {len: 2, pos: "center"}}},
      // - Hold:
      {args: {x: {hold: "right", scale: 0.5}}, target: {...tBase, x: {max: objBox.minX + objBox.width, len: objBox.width * 0.5}}, holdX: objBox.minX + objBox.width},
      {args: {x: {min: -1, len: 2, align: "right"}, y: {hold: "center", len: 1}}, target: {x: {min: -1, len: 2}, y: {min: objBox.minY + objBox.height / 2 - 1 / 2, len: 1}}, holdY: objBox.minY + objBox.height / 2},
      {args: {x: {min: -1, len: 2}, y: {hold: "top"}}, target: {...tBase, x: {min: -1, len: 2}}, holdY: objBox.minY},
      {args: {x: {hold: "right", len: 2}, y: {hold: "bottom"}}, target: {...tBase, x: {max: objBox.minX + objBox.width, len: 2}}, holdX: objBox.minX + objBox.width, holdY: objBox.minY + objBox.height},
      {args: {x: {hold: "right", len: 2}}, target: {x: {max: objBox.minX + objBox.width, len: 2}, y: {min: objBox.minY, len: objBox.height}}, holdX: objBox.minX + objBox.width},
      {args: {x: {hold: "right", len: 2}, y: "hold"}, target: {x: {max: objBox.minX + objBox.width, len: 2}, y: {min: objBox.minY, len: objBox.height}}, holdX: objBox.minX + objBox.width, holdY: objBox.minY + objBox.height / 2},
      {args: {x: {hold: "right", scale: 0.5}, y: "hold"}, target: {x: {max: objBox.minX + objBox.width, len: objBox.width / 2}, y: {min: objBox.minY, len: objBox.height}}, holdX: objBox.minX + objBox.width, holdY: objBox.minY + objBox.height / 2},
      {args: {x: {hold: "right", len: 2}, y: "hold", fitting: "stretch"}, target: {x: {max: objBox.minX + objBox.width, len: 2}, y: {min: objBox.minY, len: objBox.height}}, holdX: objBox.minX + objBox.width, holdY: objBox.minY + objBox.height / 2},
      // Mixed:
      {args: {x: "rightOfOrigin", y: {hold: "top", scale: 0.5}}, target: {...tBase, y: {min: objBox.minY, len: objBox.height * 0.5}}, holdY: objBox.minY},
    ];

  const normalisationArgsWithLabels = normaliseArgs.map(({args, target, holdX, holdY}) => ({
    args,
    target,
    holdX,
    holdY,
    label: args ? JSON.stringify(args)
      .replaceAll(/([,:])/g, "$1 ")
      .replaceAll(/"([^\\"()]+)":/g, "$1:") :
      "(original)",
  }));

  const viewBox = {minX: -3, maxX: 6, minY: -3, maxY: 4} satisfies PartialViewBox;
  const axes = getAxes(viewBox);
  const demoObject = getExplainerObject(objBox);
  return await getExplainerSection(Sheet.create({
    options: {name},
    viewBox,
    margin: 0.1,
    pieces: gather(
      axes.setLayer("axes"),
      ...normalisationArgsWithLabels.map(({args, target, holdX, holdY, label}) => gather(
        (args ? demoObject.normalise(args) : demoObject),
        target && figures.rectangle(target).setAttributes({stroke: "green"}),
        holdX === undefined ? undefined :
          figures.line([holdX, -10], [holdX, 10]).setAttributes({stroke: "violet"}),
        holdY === undefined ? undefined :
          figures.line([-10, holdY], [10, holdY]).setAttributes({stroke: "violet"}),
      ).setLayer(label)),
    ).setAttributes({stroke: "black"}),
    runs: normalisationArgsWithLabels.map(({label}): PartialCutOptions => ({
      type: "cut",
      id: label,
      layers: ["axes", label],
    })),
  }));

};
