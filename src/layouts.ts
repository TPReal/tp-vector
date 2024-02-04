import {Axis, otherAxis} from './axis.ts';
import {NormaliseArgs} from './normalise_transform.ts';
import {BasicPiece, Piece, gather} from './pieces.ts';
import {OrArray, OrArrayRest, flatten, flattenFilter} from './util.ts';
import {PartialViewBox, PartialViewBoxMargin, viewBoxFromPartial, viewBoxMarginFromPartial} from './view_box.ts';

export type Count = number | {from?: number, to: number, step?: number};

interface CountData {
  from: number;
  step: number;
  count: number;
}

function countDataFromCount(count: Count): CountData {
  if (typeof count === "number")
    return {from: 0, step: 1, count};
  const {from = 0, to, step = 1} = count;
  return {from, step, count: Math.max(Math.floor((to - from) / step + 1e-9) + 1, 0)};
}

function* getMultiIndices(count: OrArray<Count>) {
  const countArr = flatten(count).map(countDataFromCount);
  if (countArr.some(({count}) => !count))
    return;
  const ns = countArr.map(() => 0);
  for (; ;) {
    yield ns.map((n, i) => {
      const {from, step} = countArr[i];
      return from + n * step;
    });
    let d = ns.length - 1;
    while (d >= 0 && ns[d] === countArr[d].count - 1)
      ns[d--] = 0;
    if (d < 0)
      return;
    ns[d]++;
  }
}

/**
 * Iterates over the (possibly multidimensional) count, calls `pieceFunc` in each iteration and
 * gathers the results. The results of the calls are not moved or rotated, only grouped together,
 * so it's `pieceFunc`'s responsibility to arrange the pieces as needed.
 */
export function layout({count, pieceFunc}: {
  count: OrArray<Count>,
  pieceFunc: (...i: number[]) => BasicPiece | undefined,
}) {
  const parts = [];
  for (const mIndex of getMultiIndices(count)) {
    const piece = pieceFunc(...mIndex);
    if (piece)
      parts.push(piece);
  }
  return gather(parts);
}

/** Arranges the copies of the Piece in a `rows` by `columns` grid. */
export function repeat({
  piece,
  rows = 1,
  columns = 1,
  gap = 1,
  gapX = gap,
  gapY = gap,
}: {
  piece: Piece,
  rows?: Count,
  columns?: Count,
  gap?: number,
  gapX?: number,
  gapY?: number,
}) {
  const {width, height} = piece.getBoundingBox();
  const parts = [];
  for (const [r, c] of getMultiIndices([rows, columns]))
    parts.push(piece.translate(c * (width + gapX), r * (height + gapY)));
  return gather(parts);
}

function parseArgs<A extends {pieces: (Piece | undefined)[]}>(
  args: OrArrayRest<Piece | undefined> | [A]): Pick<A, "pieces"> & Partial<A> {
  function isArgsObj(args: OrArrayRest<Piece | undefined> | [A]): args is [A] {
    if (args.length !== 1)
      return false;
    const arg = args[0];
    return !!arg && arg.constructor === Object && Object.hasOwn(arg, "pieces");
  }
  if (isArgsObj(args))
    return args[0];
  return {
    pieces: flatten(args),
  } as Pick<A, "pieces"> & Partial<A>;
}

/**
 * Arranges the pieces in a column, with the default gap.
 * The pieces are translated only along the Y axis, their position on the X axis is left unchanged.
 */
export function column(...pieces: OrArrayRest<Piece | undefined>): Piece;
/**
 * Arranges the pieces in a column, or row if the X axis is specified.
 * The pieces are translated only along the specified axis, their position on the other axis
 * is left unchanged.
 */
export function column(params: {
  pieces: (Piece | undefined)[],
  gap?: number,
  axis?: Axis,
}): Piece;
export function column(...args: OrArrayRest<Piece | undefined> | [{
  pieces: (Piece | undefined)[],
  gap?: number,
  axis?: Axis,
}]) {
  const {
    pieces: piecesArr,
    gap = 1,
    axis = Axis.Y,
  } = parseArgs(args);
  let currentPos = 0;
  const parts = [];
  for (const piece of flattenFilter(piecesArr)) {
    const box = piece.getBoundingBox();
    parts.push(
      axis === Axis.X
        ? piece.translateX(currentPos - box.minX)
        : piece.translateY(currentPos - box.minY));
    currentPos += (axis === Axis.X ? box.width : box.height) + gap;
  }
  return gather(parts);
}

/**
 * Arranges the pieces in a row, with the default gap.
 * The pieces are translated only along the X axis, their position on the Y axis is left unchanged.
 */
export function row(...pieces: OrArrayRest<Piece | undefined>): Piece;
/**
 * Arranges the pieces in a row.
 * The pieces are translated only along the X axis, their position on the Y axis is left unchanged.
 */
export function row(params: {
  pieces: (Piece | undefined)[],
  gap?: number,
}): Piece;
export function row(...args: OrArrayRest<Piece | undefined> | [{
  pieces: (Piece | undefined)[],
  gap?: number,
}]) {
  return column({...parseArgs(args), axis: Axis.X});
}

export type PackPiece = Piece | PackPiece[] | PackArgs;

export interface PackArgs {
  pieces: PackPiece[],
  axis?: Axis,
  normaliseItems?: NormaliseArgs | "none",
  gap?: number,
}

const DEFAULT_PACK_NORMALISE_ITEMS: NormaliseArgs = "default";

/**
 * Packs the arguments in a row, similar to what the `row` function does. Each item that is
 * an array, is first packed in a column, similar to what the `column` function does - and so on,
 * recursively.
 */
export function pack(...piecesRow: PackPiece[]): Piece;
/**
 * Packs the piece items in a row (or column, if the Y axis is specified), similar to
 * what the `row` (or `column`) function does. Each item that is an array, is first packed
 * in the opposite direction  - and so on, recursively.
 *
 * At every level, each item is normalised using the specified normalisation args, `"default"`
 * by default.
 */
export function pack(args: PackArgs): Piece;
export function pack(...params: PackPiece[] | [PackArgs]) {
  function isPackArgs(params: PackPiece[] | [PackArgs]): params is [PackArgs] {
    return params.length === 1 && !(params[0] instanceof Piece) && !Array.isArray(params[0]);
  }
  const {
    pieces,
    axis = Axis.X,
    normaliseItems = DEFAULT_PACK_NORMALISE_ITEMS,
    gap = 1,
  } = isPackArgs(params) ? params[0] : {pieces: params};
  function norm(pc: Piece) {
    return normaliseItems === "none" ? pc : pc.normalise(normaliseItems);
  }
  function subPack(pieces: PackPiece[], axis: Axis): Piece {
    return column({
      pieces: pieces.map(o =>
        (o instanceof Piece ? o :
          Array.isArray(o) ? subPack(o, otherAxis(axis)) :
            pack({axis: otherAxis(axis), ...o})
        ).andThen(norm)),
      gap,
      axis,
    });
  }
  return subPack(pieces, axis);
}

/**
 * Packs the specified pieces roughly into a collection of boxes. The pieces are not reordered or
 * or rotated, they are collected into rows and placed, row by row, into the boxes, switching
 * to the next box when the next row doesn't fit.
 */
export function fitInBoxes({
  pieces,
  boxes,
  repeatBoxes = false,
  gap = 1,
  margin = gap,
}: {
  pieces: Piece[],
  boxes: OrArray<PartialViewBox>,
  repeatBoxes?: boolean | "last" | number,
  gap?: number,
  margin?: PartialViewBoxMargin,
}): {
  boxedPieces: (Piece | undefined)[],
  remainingPieces?: Piece[],
} {
  let rects = flatten(boxes).map(viewBoxFromPartial);
  const numRepeatBoxes = !repeatBoxes ? 0 :
    repeatBoxes === true ? rects.length :
      repeatBoxes === "last" ? 1 : repeatBoxes;
  if (numRepeatBoxes > rects.length)
    throw new Error(`Should repeat the last ${numRepeatBoxes} boxes, ` +
      `but only ${rects.length} specified.`);
  const rectsToRepeat = numRepeatBoxes ? rects.slice(-numRepeatBoxes) : [];
  const fullMargin = viewBoxMarginFromPartial(margin);
  let piecesIndex = 0;
  function getRow(width: number) {
    const row = [];
    let curX = fullMargin.left;
    let index = piecesIndex;
    let height = 0;
    while (index < pieces.length) {
      const piece = pieces[index];
      const pieceBox = piece.getBoundingBox();
      if (curX + pieceBox.width > width - fullMargin.right)
        break;
      row.push(piece.normalise("default").translateX(curX));
      curX += pieceBox.width + gap;
      if (pieceBox.height > height)
        height = pieceBox.height;
      index++;
    }
    return row.length ? {
      row: gather(row),
      height,
      accept: () => {
        piecesIndex = index;
      },
    } : undefined;
  }
  const boxedPieces: (Piece | undefined)[] = [];
  let addedAny;
  do {
    addedAny = false;
    for (const rect of rects) {
      const rows: Piece[] = [];
      let curY = fullMargin.top;
      for (; ;) {
        const rowData = getRow(rect.width);
        if (!rowData)
          break;
        if (curY + rowData.height > rect.height - fullMargin.bottom)
          break;
        rowData.accept();
        rows.push(rowData.row.translateY(curY));
        curY += rowData.height + gap;
      }
      if (rows.length) {
        addedAny = true;
        boxedPieces.push(gather(rows).translate(rect.minX, rect.minY));
      } else
        boxedPieces.push(undefined);
    }
    rects = rectsToRepeat;
  } while (addedAny);
  if (piecesIndex < pieces.length)
    return {boxedPieces, remainingPieces: pieces.slice(piecesIndex)};
  return {boxedPieces};
}
