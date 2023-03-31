import {PartialCutOptions, Sheet, Tf, Transform, gather, PartialViewBox} from '../index.ts';
import {getAxes, getExplainerObject, getExplainerSection} from './explainer_helper.ts';

export async function getSection() {

  const transforms = [
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

  function parseTf(tfString: string): Transform {
    return tfString ? new Function("Tf", `return Tf.${tfString}`)(Tf) as Transform : Tf;
  }

  const viewBox = {minX: -2, maxX: 6, minY: -2, maxY: 5} satisfies PartialViewBox;
  const demoObject = getExplainerObject({width: 3, height: 2});
  return await getExplainerSection(Sheet.create({
    options: {name: "Transform explainer"},
    viewBox,
    margin: 0.1,
    pieces: gather(
      getAxes(viewBox).setLayer("axes"),
      ...transforms.map(tfString => demoObject.transform(parseTf(tfString)).setLayer(tfString)),
    ).setAttributes({stroke: "black"}),
    runs: transforms.map((tfString): PartialCutOptions =>
      ({type: "cut", id: tfString || "(identity)", layers: ["axes", tfString]})),
  }));

}
