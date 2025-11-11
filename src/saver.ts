export function saveDownload({name, url, cleanup}: {
  name: string,
  url: string,
  cleanup?: () => void,
}) {
  const link = document.createElement("a");
  link.style.display = "none";
  link.download = name;
  link.href = url;
  link.onclick = cleanup || null;
  document.body.append(link);
  link.click();
  link.remove();
}

export function saveBlobDownload({name, blob}: {name: string, blob: Blob}) {
  const url = URL.createObjectURL(blob);
  saveDownload({
    name, url, cleanup: () => {
      requestAnimationFrame(() => {
        URL.revokeObjectURL(url);
      });
    },
  });
}
