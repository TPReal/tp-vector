import {Point, pointDebugString} from '../point.ts';
import {roundReasonably} from '../util.ts';
import {ViewBox} from '../view_box.ts';

interface WindowWithPointsList extends Window {
  pointsList?: ClickedPointsList;
}

interface ClickedPointsList {
  arr: Point[];
  str: string;
  log(): void;
}

export function getPreviewClickHandler(viewBox: ViewBox) {
  let prevPoint: Point | undefined;
  let totalDist = 0;
  let totalDistNumPoints = 1;
  const windowWithPointsList = window as WindowWithPointsList;
  const pointsList: ClickedPointsList = {
    arr: [],
    str: "",
    log() {
      console.log(this.str);
    },
  };
  return (event: MouseEvent) => {
    event.preventDefault();
    document.getSelection()?.empty();
    const elem = event.currentTarget as HTMLElement;
    const point: Point = [
      viewBox.minX + event.offsetX / elem.clientWidth * viewBox.width,
      viewBox.minY + event.offsetY / elem.clientHeight * viewBox.height,
    ];
    pointsList.arr.push(point);
    pointsList.str += `${pointDebugString(point)},\n`;
    windowWithPointsList.pointsList = pointsList;
    console.log(`Point ${pointDebugString(point)}`, point);
    setTimeout(() => {
      const pointStr = `Point: ${pointDebugString(point)}`;
      if (prevPoint) {
        const distToPrev = Math.hypot(point[0] - prevPoint[0], point[1] - prevPoint[1]);
        totalDist += distToPrev;
        totalDistNumPoints++;
        prevPoint = point;
        if (!confirm(`\
${pointStr}
Previous point: ${pointDebugString(prevPoint)}
Distance from previous point: ${roundReasonably(distToPrev, {significantDigits: 4})}

Total distance (${totalDistNumPoints} points): ${roundReasonably(totalDist, {significantDigits: 4})}
Continue collecting points and summing up distances?`)) {
          totalDist = 0;
          totalDistNumPoints = 1;
          prevPoint = undefined;
          pointsList.arr = [];
          pointsList.str = "";
        }
      } else {
        prevPoint = point;
        alert(pointStr);
        console.log(`Points are stored in window.pointsList`);
      }
    });
  };
}
