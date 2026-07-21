import {toFileName} from './name.ts';
import {saveBlobDownload} from './saver.ts';

export interface PartialArtifactData {
  name: string;
  desc?: string;
  fileName?: string;
  // Note: a SharedArrayBuffer-backed Uint8Array is not accepted (a Blob cannot be created
  // from it).
  data: () => string | Uint8Array<ArrayBuffer> | Blob;
}
export interface ArtifactData {
  readonly name: string;
  readonly desc: string | undefined;
  readonly fileName: string;
  readonly data: () => Blob,
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
  saveBlobDownload({name: fileName, blob: data()});
}
