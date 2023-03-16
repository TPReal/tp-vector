import {PartialCutOptions, Sheet, Tf, Transform, gather} from '../index.ts';
import {getAxis, getDemoObject, getDemoSection} from './explainer_helper.ts';

const TRANSFORMS = [
  "",
  "translate(1, 2)",
  "translateX(1)",
  "translateY(-1)",
  "moveLeft(1)",
  "moveDown(2)",
  "scale(1.5)",
  "scale(1.5, 0.5)",
  "scale(2, [1.5, 1])",
  "scaleX(1 / 3)",
  "scaleY(-2, 1)",
  "flipY()",
  "flipX(1.5)",
  "flipXY()",
  "swapXY()",
  "rotateRight(20)",
  "rotateLeft(45, [1.5, 1])",
  "rotateRight([1.5, 1])",
  "skewRightDown(45)",
  "skewTopToLeft(60, 1)",
  "skewLeftDown(10, 3)",
  "matrix([-1.2, 0.8, 0.5, 1.4, 3, -1])",
];

const viewBox = {minX: -2, maxX: 6, minY: -2, maxY: 5};

const axes = gather(
  getAxis({min: viewBox.minX, max: viewBox.maxX}),
  getAxis({min: viewBox.minY, max: viewBox.maxY}).rotateRight(),
);

function parseTf(tfString: string): Transform {
  return tfString ? new Function("Tf", `return Tf.${tfString}`)(Tf) as Transform : Tf;
}

export function getExplainer() {
  const demoObject = getDemoObject({width: 3, height: 2});
  return getDemoSection(Sheet.create({
    options: {name: "tf_demo"},
    viewBox,
    margin: 0.1,
    pieces: gather(
      axes.setLayer("axes"),
      ...TRANSFORMS.map(tfString => demoObject.transform(parseTf(tfString)).setLayer(tfString)),
    ).setAttributes({stroke: "black"}),
    runs: TRANSFORMS.map((tfString): PartialCutOptions =>
      ({type: "cut", id: tfString || "(identity)", layers: ["axes", tfString]})),
  }));
}
