import {toFileName} from './name.ts';
import {saveDownload} from './saver.ts';

export interface PartialArtifactData {
  name: string;
  desc?: string;
  fileName?: string;
  data: () => string | Uint8Array | Blob;
}
export interface ArtifactData {
  name: string;
  desc: string | undefined;
  fileName: string;
  data: () => Blob,
}
export function artifactDataFromPartial({
  name,
  desc,
  fileName = toFileName(name),
  data,
}: PartialArtifactData): ArtifactData {
  return {
    name,
    desc,
    fileName,
    data: () => {
      const d = data();
      return typeof d === "string" ? new Blob([d], {type: "text/plain;charset=utf-8"}) :
        d instanceof Uint8Array ? new Blob([d], {type: "application/octet-stream"}) :
          d;
    },
  };
}

export function saveArtifact({fileName, data}: ArtifactData) {
  const url = URL.createObjectURL(data());
  saveDownload({
    name: fileName, url, cleanup: () => {
      requestAnimationFrame(() => {
        URL.revokeObjectURL(url);
      });
    }
  });
}
