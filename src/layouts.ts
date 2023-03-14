import {Axis} from './axis.ts';
import {BasicPiece, Piece, gather} from './pieces.ts';
import {OrArray, flatten} from './util.ts';
import {PartialViewBox, PartialViewBoxMargin, viewBoxFromPartial, viewBoxMarginFromPartial} from './view_box.ts';

export type Count = number | {from?: number, to: number, step?: number};

interface CountData {
  from: number;
  step: number;
  count: number;
}

function parseCount(count: Count): CountData {
  const {from = 0, to, step = 1} = typeof count === "number" ? {to: count - 1} : count;
  return {from, step, count: Math.floor((to - from) / step + 1e-9) + 1};
}

function* getMultiIndices(count: OrArray<Count>) {
  const countArr = flatten(count).map(parseCount);
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

export function gridRepeat({
  piece,
  gap = 1,
  gapX = gap,
  gapY = gap,
  rows = 1,
  columns = 1,
}: {
  piece: Piece,
  gap?: number,
  gapX?: number,
  gapY?: number,
  rows?: Count,
  columns?: Count,
}) {
  const {width, height} = piece.getBoundingBox();
  const parts = [];
  for (const [r, c] of getMultiIndices([rows, columns]))
    parts.push(piece.translate(c * (width + gapX), r * (height + gapY)));
  return gather(parts);
}

export function stack(pieces: Piece[]): Piece;
export function stack(params: {
  pieces: Piece[],
  gap?: number,
  axis?: Axis,
}): Piece;
export function stack(piecesOrParams: Piece[] | {
  pieces: Piece[],
  gap?: number,
  axis?: Axis,
}) {
  const {
    pieces: piecesArr,
    gap = 1,
    axis = Axis.Y,
  } = Array.isArray(piecesOrParams) ? {pieces: piecesOrParams} : piecesOrParams;
  let currentPos = 0;
  const parts = [];
  for (const piece of piecesArr) {
    const box = piece.getBoundingBox();
    parts.push(
      axis === Axis.X
        ? piece.translateX(currentPos - box.minX)
        : piece.translateY(currentPos - box.minY));
    currentPos += (axis === Axis.X ? box.width : box.height) + gap;
  }
  return gather(parts);
}

export function row(pieces: Piece[]): Piece;
export function row(params: {
  pieces: Piece[],
  gap?: number,
}): Piece;
export function row(piecesOrParams: Piece[] | {
  pieces: Piece[],
  gap?: number,
}) {
  const params = Array.isArray(piecesOrParams) ? {pieces: piecesOrParams} : piecesOrParams;
  return stack({...params, axis: Axis.X});
}

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
    throw new Error(`Should repeat last ${numRepeatBoxes} boxes, but only ${rects.length} specified.`);
  const rectsToRepeat = numRepeatBoxes ? rects.slice(-numRepeatBoxes) : [];
  const fullMargin = viewBoxMarginFromPartial(margin);
  // TODO: Optimise and add support for reordering and rotating.
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
