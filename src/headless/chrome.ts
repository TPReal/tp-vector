/// <reference lib="deno.ns" />

type Params = Record<string, unknown>;
// deno-lint-ignore no-explicit-any
type Result = any;

interface Message {
  readonly id?: number;
  readonly method?: string;
  readonly params?: Result;
  readonly result?: Result;
  readonly error?: {readonly message: string};
}

const STARTUP_TIMEOUT_MILLIS = 20_000;
const CONNECTION_LOST = "The connection to the browser was lost.";

/** A headless Chrome process with a single page, controlled over the DevTools Protocol. */
export class Chrome {

  /** Warnings and errors reported by the page since the last call of {@link takeLogs}. */
  private logs: string[] = [];
  private lastId = 0;
  private readonly pending = new Map<number, PromiseWithResolvers<Result>>();
  private sessionId: string | undefined;

  private constructor(
    private readonly process: Deno.ChildProcess,
    private readonly tempDir: string,
    private readonly socket: WebSocket,
    private readonly proxyCredentials: {username: string, password: string} | undefined,
    private readonly timeoutMillis: number,
  ) {}

  /**
   * Starts the browser with a blank page, using a proxy if the environment specifies one.
   *
   * The page runs without the Chrome's own sandbox, which cannot be nested in another sandbox or
   * in a container, so it should only load trusted code.
   *
   * If the page does not finish an evaluation within the timeout, the connection is dropped, as
   * the page might be stuck in a loop, and it cannot be used any more.
   */
  static async launch(executable: string, {timeoutMillis}: {timeoutMillis: number}) {
    const tempDir = await Deno.makeTempDir({prefix: "tp-vector-chrome-"});
    try {
      return await Chrome.start(executable, tempDir, timeoutMillis);
    } catch (e) {
      await Deno.remove(tempDir, {recursive: true});
      throw e;
    }
  }

  private static async start(executable: string, tempDir: string, timeoutMillis: number) {
    const proxy = URL.parse(Deno.env.get("HTTPS_PROXY") ?? Deno.env.get("https_proxy") ?? "");
    const process = new Deno.Command(executable, {
      args: [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--remote-debugging-port=0",
        `--user-data-dir=${tempDir}/profile`,
        // Credentials are not accepted here, see onMessage.
        ...proxy ? [`--proxy-server=${proxy.protocol}//${proxy.host}`] : [],
        "about:blank",
      ],
      env: {HOME: tempDir, XDG_CONFIG_HOME: tempDir, XDG_CACHE_HOME: tempDir},
      stdin: "null",
      stdout: "null",
      stderr: "piped",
    }).spawn();
    try {
      const socket = new WebSocket(await readDevToolsURL(process));
      await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
      });
      const chrome = new Chrome(process, tempDir, socket, proxy?.username ? {
        username: decodeURIComponent(proxy.username),
        password: decodeURIComponent(proxy.password),
      } : undefined, timeoutMillis);
      socket.onmessage = event => chrome.onMessage(JSON.parse(event.data));
      socket.onclose = () => chrome.rejectPending();
      await chrome.attachToPage();
      return chrome;
    } catch (e) {
      await stopProcess(process);
      throw e;
    }
  }

  private async attachToPage() {
    const {targetInfos} = await this.send("Target.getTargets");
    const {targetId} = targetInfos.find(({type}: {type: string}) => type === "page");
    ({sessionId: this.sessionId} = await this.send("Target.attachToTarget", {targetId, flatten: true}));
    await this.send("Runtime.enable");
    if (this.proxyCredentials)
      await this.send("Fetch.enable", {handleAuthRequests: true, patterns: [{urlPattern: "http*"}]});
  }

  private onMessage({id, method, params, result, error}: Message) {
    if (id !== undefined) {
      const {resolve, reject} = this.pending.get(id)!;
      this.pending.delete(id);
      if (error)
        reject(new Error(error.message));
      else
        resolve(result);
    } else if (method === "Runtime.consoleAPICalled") {
      if (params.type === "warning" || params.type === "error")
        this.logs.push(params.args.map(({value, description}: Result) => value ?? description).join(" "));
    } else if (method === "Runtime.exceptionThrown") {
      const {exception, text} = params.exceptionDetails;
      this.logs.push(exception?.description ?? text);
    } else if (method === "Fetch.requestPaused")
      this.respond("Fetch.continueRequest", {requestId: params.requestId});
    else if (method === "Fetch.authRequired")
      this.respond("Fetch.continueWithAuth", {
        requestId: params.requestId,
        authChallengeResponse: {response: "ProvideCredentials", ...this.proxyCredentials},
      });
  }

  private rejectPending() {
    for (const {reject} of this.pending.values())
      reject(new Error(CONNECTION_LOST));
    this.pending.clear();
  }

  private send(method: string, params: Params = {}): Promise<Result> {
    if (!this.connected)
      return Promise.reject(new Error(CONNECTION_LOST));
    const id = ++this.lastId;
    const promise = Promise.withResolvers<Result>();
    this.pending.set(id, promise);
    this.socket.send(JSON.stringify({id, method, params, sessionId: this.sessionId}));
    return promise.promise;
  }

  /** Sends a response to an event, which has nothing left to respond to if the page is gone. */
  private respond(method: string, params: Params) {
    this.send(method, params).catch(() => {});
  }

  get connected() {
    return this.socket.readyState === WebSocket.OPEN;
  }

  async navigate(url: string) {
    await this.send("Page.navigate", {url});
  }

  /** Evaluates the expression in the page, and returns the awaited, JSON-serialisable result. */
  async evaluate<T>(expression: string): Promise<T> {
    let timer;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.socket.close();
        reject(new Error(`Timed out after ${this.timeoutMillis / 1000} s.`));
      }, this.timeoutMillis);
    });
    try {
      const {result, exceptionDetails} = await Promise.race([timeout, this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })]);
      if (exceptionDetails)
        throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    } finally {
      clearTimeout(timer);
    }
  }

  takeLogs() {
    const logs = this.logs;
    this.logs = [];
    return logs;
  }

  async close() {
    this.socket.close();
    await stopProcess(this.process);
    await Deno.remove(this.tempDir, {recursive: true});
  }

}

async function stopProcess(process: Deno.ChildProcess) {
  try {
    process.kill();
  } catch {
    // It has already exited.
  }
  await process.status;
}

/** Reads the URL which the browser prints on startup, then keeps draining the output. */
async function readDevToolsURL(process: Deno.ChildProcess) {
  const reader = process.stderr.pipeThrough(new TextDecoderStream()).getReader();
  let output = "";
  const timeout = setTimeout(() => reader.cancel(), STARTUP_TIMEOUT_MILLIS);
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done)
        throw new Error(`The browser did not start. Its output:\n${output}`);
      output += value;
      const url = output.match(/ws:\/\/\S+/)?.[0];
      if (url) {
        (async () => {
          while (!(await reader.read()).done)
            ;
        })().catch(() => {});
        return url;
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}
