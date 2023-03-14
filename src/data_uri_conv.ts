export function fromBinary({mimeType, binData}: {
  mimeType: string,
  binData: string,
}) {
  return fromBase64({base64Data: btoa(binData), mimeType});
}

export function fromBase64({mimeType, base64Data}: {
  mimeType: string,
  base64Data: string,
}) {
  return `data:${mimeType};charset=utf-8;base64,${base64Data}`;
}
