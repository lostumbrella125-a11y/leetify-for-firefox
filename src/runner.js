(function (root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LeetifyRunner = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (scope) {
  const DEFAULT_TIMEOUT_MS = 2000;

  function errorMessage(error) {
    if (error && error.message) return error.message;
    return String(error);
  }

  function failure(error, extra) {
    return { ok: false, output: "", error: errorMessage(error), ...(extra || {}) };
  }

  function workerSource() {
    return `
      "use strict";
      self.onmessage = async function (event) {
        const payload = event.data || {};
        const logs = [];
        const formatValue = function (value) {
          if (typeof value === "string") return value;
          try {
            const serialized = JSON.stringify(value);
            return serialized === undefined ? String(value) : serialized;
          } catch (error) {
            return String(value);
          }
        };
        const consoleProxy = {
          log: (...values) => logs.push(values.map(formatValue).join(" ")),
          info: (...values) => logs.push(values.map(formatValue).join(" ")),
          error: (...values) => logs.push(values.map(formatValue).join(" "))
        };

        try {
          const runner = new Function(
            "input",
            "console",
            "\\"use strict\\";\\n" + String(payload.source || "") + "\\n\\n" +
              "if (typeof solve !== \\"function\\") {\\n" +
              "  throw new Error(\\"Define a solve(input) function to use the local JavaScript runner.\\");\\n" +
              "}\\nreturn solve(input);"
          );
          const result = runner(String(payload.input == null ? "" : payload.input), consoleProxy);
          const resolved = result && typeof result.then === "function" ? await result : result;
          const output = resolved == null ? logs.join("\\n") : String(resolved);
          self.postMessage({ type: "result", result: { ok: true, output } });
        } catch (error) {
          self.postMessage({ type: "result", result: { ok: false, output: "", error: error && error.message ? error.message : String(error) } });
        }
      };
    `;
  }

  function defaultWorkerFactory(source) {
    if (!scope || typeof scope.Worker !== "function") {
      throw new Error("Web Workers are unavailable in this browser.");
    }
    if (!scope.Blob || !scope.URL || typeof scope.URL.createObjectURL !== "function") {
      throw new Error("Blob workers are unavailable in this browser.");
    }
    const blob = new scope.Blob([source], { type: "text/javascript" });
    const url = scope.URL.createObjectURL(blob);
    try {
      return new scope.Worker(url);
    } finally {
      scope.URL.revokeObjectURL(url);
    }
  }

  function timeoutValue(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.max(1, Math.floor(number)) : fallback;
  }

  function createJavaScriptRunner(options) {
    const config = options || {};
    const defaultTimeout = timeoutValue(config.timeoutMs, DEFAULT_TIMEOUT_MS);
    const makeWorker = typeof config.workerFactory === "function"
      ? config.workerFactory
      : defaultWorkerFactory;
    const activeRuns = new Set();
    let terminated = false;

    function run(source, input, runOptions) {
      if (terminated) return Promise.resolve(failure("JavaScript runner has been terminated.", { terminated: true }));

      const timeoutMs = timeoutValue(runOptions && runOptions.timeoutMs, defaultTimeout);
      return new Promise((resolve) => {
        let worker;
        let timer;
        let settled = false;

        const cleanup = () => {
          clearTimeout(timer);
          if (worker) {
            activeRuns.delete(finish);
            try {
              worker.terminate();
            } catch (error) {
              // A worker that already stopped is safe to discard.
            }
          }
        };
        const finish = (result) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        };

        try {
          worker = makeWorker(workerSource());
          if (!worker) throw new Error("The JavaScript worker could not be created.");
          activeRuns.add(finish);
          worker.onmessage = (event) => {
            const data = event && event.data;
            if (!data || data.type !== "result") {
              finish(failure("The JavaScript worker returned an invalid result."));
              return;
            }
            finish(data.result && typeof data.result === "object"
              ? { ...data.result }
              : failure("The JavaScript worker returned an invalid result."));
          };
          worker.onerror = (event) => finish(failure(event && (event.error || event.message) || "The JavaScript worker failed."));
          worker.onmessageerror = () => finish(failure("The JavaScript worker could not send its result."));
          timer = setTimeout(() => finish(failure(`Execution timed out after ${timeoutMs} ms.`, { timedOut: true })), timeoutMs);
          worker.postMessage({ source: String(source == null ? "" : source), input: String(input == null ? "" : input) });
        } catch (error) {
          finish(failure(error));
        }
      });
    }

    function terminate() {
      if (terminated) return;
      terminated = true;
      Array.from(activeRuns).forEach((finish) => finish(failure("JavaScript runner was terminated.", { terminated: true })));
    }

    return { run, terminate, workerSource, DEFAULT_TIMEOUT_MS };
  }

  return { DEFAULT_TIMEOUT_MS, workerSource, createJavaScriptRunner };
});
