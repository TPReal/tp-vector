import { ElemArgs, element, joinElements } from './instructions.ts';
import { Side } from './options.ts';
import { LaserSVGParams, PartialLaserSVGParams, Sheet } from './sheet.ts';
import { flatten, OrArrayRest } from './util.ts';
// deno-lint-ignore-file
// TODO: Implement.
// @ts-nocheck Not implemented yet.


export type ParamsRecord = Readonly<Record<string, unknown>>;

interface CommonStep {
  readonly notes?: string;
  readonly extraParams?: ParamsRecord;
}

interface SheetSVGParams {
  sheet: Sheet;
  laserSVGParams: LaserSVGParams;
}

interface TextStep extends CommonStep {
  readonly type: "text";
  readonly text: string;
}
interface LoadMaterialStep extends CommonStep {
  readonly type: "loadMaterial";
  readonly material?: ParamsRecord;
  readonly side: Side | "auto";
}
interface LoadRunsStep extends CommonStep {
  readonly type: "loadRuns";
  readonly sheetSVGParams: SheetSVGParams;
}
interface ExecuteRunStep extends CommonStep {
  readonly type: "executeRun";
  readonly runId: string;
  readonly sheetSVGParams?: SheetSVGParams;
  readonly laserParams?: ParamsRecord;
}
export type Step = TextStep | LoadMaterialStep | LoadRunsStep | ExecuteRunStep;

interface LoadRunsStepArgs extends CommonStep {
  readonly sheet?: Sheet;
  readonly laserSVGParams?: PartialLaserSVGParams;
}

type OptStepParams<T, Skip extends keyof T = never> = {
  [key in Exclude<keyof T, "type" | Skip>]?: T[key]
};

export class Project {

  protected constructor(
    readonly name: string,
    readonly steps: readonly Step[],
  ) {
  }

  static create(name: string) {
    return new Project(name, []);
  }

  private addStep(step: Step) {
    return new Project(this.name, [...this.steps, step]);
  }

  text(text: string, params: OptStepParams<TextStep, "text"> = {}) {
    return this.addStep({type: "text", ...params, text});
  }

  loadMaterial({
    side = "auto",
    ...params
  }: OptStepParams<LoadMaterialStep> = {}) {
    return this.addStep({type: "loadMaterial", ...params, side});
  }

  loadSheet(sheet: Sheet, params?: OptStepParams<LoadRunsStepArgs, "sheet">) {
    return this.loadRuns({...params, sheet});
  }

  loadRuns(params: {sheet: Sheet} & OptStepParams<LoadRunsStepArgs>): Project;
  loadRuns(params: {laserSVGParams: PartialLaserSVGParams} &
    OptStepParams<LoadRunsStepArgs>): Project;
  loadRuns({
    sheet = this.getCurrentSheet(),
    laserSVGParams,
    ...paramsRest
  }: OptStepParams<LoadRunsStepArgs>) {
    return this.addStep({
      type: "loadRuns",
      ...paramsRest,
      sheetSVGParams: {
        sheet,
        laserSVGParams: sheet.laserSVGParamsFromPartial(laserSVGParams),
      },
    });
  }

  executeRun(runId: string, params: OptStepParams<ExecuteRunStep, "runId"> = {}) {
    const sheet = this.getCurrentSheet();
    if (!sheet.getRunIds().includes(runId))
      throw new Error(`Current sheet (${sheet.name || `unnamed`}) does not have run with id ` +
        `${JSON.stringify(runId)}, it has runs: ${JSON.stringify(sheet.getRunIds())}`);
    return this.addStep({
      type: "executeRun",
      ...params,
      runId,
      sheetSVGParams: this.getLaserSVGParamsForRun(runId),
    });
  }

  private getLaserSVGParamsForRun(runId: string): SheetSVGParams | undefined {
    const {sheet, laserSVGParams} =
      this.requireLastStep<LoadRunsStep>(["loadRuns"]).sheetSVGParams;
    return laserSVGParams.runsSelector.runs.includes(runId) ? undefined : {
      sheet,
      laserSVGParams: sheet.laserSVGParamsFromPartial(
        {runsSelector: {runs: [runId]}}),
    };
  }

  private getCurrentSheet() {
    return this.requireLastStep<LoadRunsStep>(["loadRuns"]).sheetSVGParams.sheet;
  }

  private filterSteps<S extends Step>(types: Step["type"][], steps = this.steps): S[] {
    return steps.filter((step): step is S => types.includes(step.type));
  }

  private findLastStep<S extends Step>(types: S["type"][], steps = this.steps) {
    return this.filterSteps<S>(types, steps)?.at(-1);
  }

  private requireLastStep<S extends Step>(types: S["type"][]) {
    const last = this.findLastStep(types);
    if (!last)
      throw new Error(`Expect an earlier step of one of types: [${types.join(", ")}]`);
    return last;
  }

  getInstructions() {
    const stepNodes: (Node | undefined)[] = [];
    function addStep(instruction: ElemArgs, {type, notes, extraParams}: Step) {
      stepNodes.push(element({
        tagName: "li",
        ...classes("step-info", `step-type-${type}`),
        children: joinElements([
          element({
            ...classes("instruction"),
            children: instruction,
          }),
          paramsToElement(extraParams, "params"),
          notesToElement(notes),
        ], {glue: ` `}),
      }));
    }
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      if (step.type === "text")
        addStep(step.text, step);
      else if (step.type === "loadMaterial")
        addStep([
          `Load material`,
          this.needsSideInfo(step, i) && [` `, sideToElement(step.side), ` side up`],
          step.material && joinElements(paramsToElement(step.material), {pre: `, `}),
        ], step);
      // else if (step.type === "loadRuns")
      //   addText(`Load sheet`, step,
      //     { sheet: (sheet: Sheet) => sheet.name },
      //     laserSVGParamsTextFunction(),
      //   );
      // else if (step.type === "executeRun")
      //   addText(`Execute run ${step.runId}`, step);
      else {
        const exhaustive: never = step;
      }
    }
    return element({
      ...classes("project-instructions"),
      children: [
        element({
          ...classes("project-name-info"),
          children: [
            `Project `,
            element({
              ...classes("project-name"),
              children: this.name,
            }),
            `:`,
          ],
        }),
        stepNodes.length ? element({
          tagName: "ol",
          ...classes("steps-info"),
          children: stepNodes,
        }) : joinElements(element({
          ...classes("no-steps", "special-value"),
          children: `(no steps)`,
        }), {pre: ` `}),
      ],
      assert: true,
    });
  }

  private needsSideInfo({side}: LoadMaterialStep, stepIndex: number) {
    if (side !== "front")
      return true;
    const laterSteps = this.steps.slice(stepIndex + 1);
    const loadStepIndex = laterSteps.findIndex(step => step.type === "loadMaterial");
    const reverseStepIndex = laterSteps.findIndex(step => step.type === "reverseMaterial");
    return reverseStepIndex >= 0 && (reverseStepIndex < loadStepIndex || loadStepIndex < 0);
  }

  static getDefaultCSS() {
    return DEFAULT_CSS;
  }

  static getDefaultStyleElement() {
    return element({tagName: "style", children: Project.getDefaultCSS(), assert: true});
  }

  static installDefaultStyle() {
    document.head.appendChild(Project.getDefaultStyleElement());
  }


}

const CLASSES_PREFIX = "tp-vector-";

function cls(cls: string) {
  return CLASSES_PREFIX + cls;
}

function classes(...classes: OrArrayRest<string>) {
  return {classes: flatten(classes).map(cls)};
}

function laserSVGParamsToElement(
  {format, runsSelector: {runs, cornersMarker, reversingFrame}}: LaserSVGParams) {
  return element({
    ...classes("laser-svg-params"),
    children: joinElements([
      element({
        ...classes("runs-info"),
        children: runs === "all" ?
          element({...classes("all-runs", "special-value"), children: `all runs`}) :
          joinElements(
            runs.map(run => element({...classes("run-name"), children: run})),
            {glue: `, `}),
      }),
      element({
        ...classes("additions-info"),
        children: joinElements([
          cornersMarker &&
          element({...classes("addition", "corners-marker"), children: `corners marker`}),
          reversingFrame &&
          element({...classes("addition", "reversing-frame"), children: `reversing frame`}),
        ], {pre: `(`, glue: `, `, post: `)`}),
      }),
      format !== "SVG" && element({
        ...classes("format-info"),
        children: [`(format=`, format, `)`],
      }),
    ], {glue: ` `}),
    assert: true,
  });
}

function paramsToElement(params: ParamsRecord | undefined, name?: string) {
  if (!params)
    return undefined;
  return element({
    ...classes("params-info"),
    children: joinElements(Object.entries(params).flatMap(([key, value]) => [
      element({...classes("key"), children: key}),
      `=`,
      element({...classes("value"), children: JSON.stringify(value)}),
    ]), {
      pre: [
        name && [element({...classes("params-name"), children: name}), `=`],
        `{`,
      ],
      glue: `, `,
      post: `}`,
    }),
  });
}

function notesToElement(notes: string | undefined) {
  return element({
    ...classes("notes-info"),
    children: joinElements(
      element({...classes("notes"), children: notes}),
      {pre: `(notes: `, post: `)`}),
  });
}

function sideToElement(side: Side | undefined) {
  return element({
    ...classes("material-side"),
    children: side,
  });
}

const DEFAULT_CSS = `
`;
