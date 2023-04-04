export async function sleep(timeMillis: number) {
  await new Promise(resolve => setTimeout(resolve, timeMillis));
}

export function loadEvent(object: GlobalEventHandlers | FileReader) {
  return new Promise((resolve, reject) => {
    object.addEventListener("load", resolve, false);
    object.addEventListener("error", event => {
      console.error(`Waiting for the "load" event, got "error"`, object, event);
      reject(event);
    }, false);
  });
}
