import {PartialCutOptions, PartialPrintOptions, runIdFromPartial, RunOptions} from './options.ts';
import {BasicSheetParams} from './sheet.ts';
import {flatten, OrArray} from './util.ts';

export interface PartialLightBurnCutOptions extends PartialCutOptions {
  lbHint?: PartialLightBurnCutHint;
}

export interface PartialLightBurnPrintOptions extends PartialPrintOptions {
  lbHint?: PartialLightBurnPrintHint;
}

export type PartialLightBurnRunOptions = PartialLightBurnCutOptions | PartialLightBurnPrintOptions;

type PartialLightBurnHintBase = {layer: number, otherFields?: Record<string, unknown>};

type PartialLightBurnHintLink = {link: `${string}/${string | number}/${string}`};
type PartialLightBurnHintPowerSpeed = {powerPercent?: number} &
  ({speedMmPerSec?: number} | {speedMmPerMin: number});

type PartialLightBurnCutHint = PartialLightBurnHintBase &
  (PartialLightBurnHintLink | PartialLightBurnHintPowerSpeed | {});

type PartialLightBurnPrintHint = PartialLightBurnHintBase & {ditherMode?: string} &
  (PartialLightBurnHintLink | PartialLightBurnHintPowerSpeed | {});

export function lightBurnRuns(lbRuns: OrArray<PartialLightBurnRunOptions>) {
  function completeLink(type: RunOptions["type"], link: string) {
    const [a, b, c] = link.split("/");
    const bNum = Number(b);
    const newB = type === "cut" && !Number.isNaN(bNum) ? bNum.toFixed(4) : b;
    return `${a}/${newB}/${c}`;
  }
  const hints: LightBurnHintImpl[] = [];
  const runs: PartialLightBurnRunOptions[] = [];
  lbRuns = flatten(lbRuns);
  for (let i = 0; i < lbRuns.length; i++) {
    const {lbHint, ...run} = lbRuns[i];
    if (lbHint) {
      const {link, powerPercent, speedMmPerSec, speedMmPerMin, ditherMode} =
        lbHint as Partial<Record<string, unknown>>;
      const hint = LightBurnHintImpl.create({
        run: {type: run.type, id: runIdFromPartial(run)},
        lbLayer: lbHint.layer,
        priority: i,
        LinkPath: typeof link === "string" ? completeLink(run.type, link) : undefined,
        maxPower: powerPercent,
        speed: typeof speedMmPerSec === "number" ? speedMmPerSec :
          typeof speedMmPerMin === "number" ? speedMmPerMin / 60 :
            undefined,
        ditherMode,
        ...lbHint.otherFields,
      });
      hints.push(hint);
      runs.push({...run, hint});
    } else
      runs.push(run);
  }
  return {
    runs,
    preserveRunsOrder: true,
    artifacts: (sheet) => {
      if (!hints.length)
        return [];
      const nonEmptyRunIds = new Set(sheet.getNonEmptyRunIds());
      const matchingHints = hints.filter(hint => nonEmptyRunIds.has(hint.run.id));
      return [
        {
          name: `LightBurn layer settings`,
          desc: `An empty LightBurn project with just the configured laser settings for the used layers.\n` +
            `Layers: ${matchingHints.map(h => h.run.id).join(", ")}`,
          fileName: "layer_settings.lbrn",
          data: () => createLightBurnLayersConfig(matchingHints),
        },
        ...hints.length > matchingHints.length ? [{
          name: `LightBurn layer settings (all)`,
          desc: `An empty LightBurn project with just the configured laser settings for the used layers.\n` +
            `Includes also empty layers.\n` +
            `Layers: ${hints.map(h => h.run.id).join(", ")}`,
          fileName: "layer_settings.lbrn",
          data: () => createLightBurnLayersConfig(hints),
        }] : [],
      ];
    },
  } satisfies BasicSheetParams;
}

export interface LightBurnHint {
  readonly isLightBurn: true;
}

class LightBurnHintImpl implements LightBurnHint {

  readonly isLightBurn = true;

  protected constructor(
    readonly run: Pick<RunOptions, "type" | "id">,
    readonly lbLayer: number,
    readonly fields: ReadonlyMap<string, unknown>,
  ) {}

  static create({run, lbLayer, ...rest}: {
    run: Pick<RunOptions, "type" | "id">,
    lbLayer: number,
    [key: string]: unknown,
  }) {
    const fields = new Map<string, unknown>();
    fields.set("index", lbLayer);
    fields.set("name", run.id);
    for (const [key, value] of Object.entries(rest))
      fields.set(key, value);
    return new LightBurnHintImpl(run, lbLayer, fields);
  }

  toString() {
    return `[${String(this.lbLayer).padStart(2, "0")}]`;
  }

}

function createLightBurnLayersConfig(hints: LightBurnHintImpl[]) {
  const data: Record<RunOptions["type"], Map<number, Map<string, unknown>>> =
    {cut: new Map(), print: new Map()};
  for (const {run: {type}, lbLayer, fields} of hints) {
    let joinedFields: Map<string, unknown> | undefined = data[type].get(lbLayer);
    if (!joinedFields) {
      joinedFields = new Map();
      data[type].set(lbLayer, joinedFields);
    }
    for (const [k, newV] of fields) {
      if (newV !== undefined) {
        let v = joinedFields.get(k);
        if (v === undefined)
          v = newV;
        else if (newV !== v) {
          if (k === "priority")
            v = Math.min(Number(v), Number(newV));
          else if (k === "name")
            v = [...new Set(String(v).split(", ")).add(String(newV))].join(", ");
          else
            throw new Error(`Cannot merge LightBurn hint, layer: ${lbLayer}, key: ${k}`);
        }
        joinedFields.set(k, v);
      }
    }
  }
  function xmlValues(fields: Map<string, unknown>) {
    return Array.from(fields, ([k, v]) => {
      if (!/^\w+$/.test(k))
        throw new Error(`Expected a valid field name, got: ${JSON.stringify(k)}`);
      return `<${k} Value=${JSON.stringify(String(
        typeof v === "number" ? Number(v.toFixed(6)) :
          typeof v === "boolean" ? Number(v) :
            v
      ))}/>`;
    }).join("\n    ");
  }
  return `\
<?xml version="1.0" encoding="UTF-8"?>
<LightBurnProject FormatVersion="1">
${Array.from(data.cut.values(), (fields) => `\
  <CutSetting type="Cut">
    ${xmlValues(fields)}
  </CutSetting>`).join("\n")}
${Array.from(data.print.values(), (fields) => `\
  <CutSetting_Img type="Image">
    ${xmlValues(fields)}
  </CutSetting_Img>`).join("\n")}
</LightBurnProject>`;
}
