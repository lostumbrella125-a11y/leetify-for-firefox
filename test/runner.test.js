const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { createJavaScriptRunner, workerSource } = require("../src/runner.js");

class VmWorker {
  constructor(source) {
    this.terminated = false;
    const worker = this;
    const self = {
      postMessage(message) {
        if (!worker.terminated && worker.onmessage) worker.onmessage({ data: message });
      }
    };
    const context = { self, Promise, setTimeout, clearTimeout };
    vm.runInNewContext(source, context);
    this.handleMessage = context.self.onmessage;
  }

  postMessage(message) {
    this.handleMessage({ data: message });
  }

  terminate() {
    this.terminated = true;
  }
}

function vmWorkerFactory(source) {
  return new VmWorker(source);
}

test("runs user code in the worker protocol and returns its output", async () => {
  const runner = createJavaScriptRunner({ workerFactory: vmWorkerFactory, timeoutMs: 100 });
  const result = await runner.run("function solve(input) { return input.trim().toUpperCase(); }", "abc\n");

  assert.deepEqual(result, { ok: true, output: "ABC" });
});

test("uses captured console output when solve returns no value", async () => {
  const runner = createJavaScriptRunner({ workerFactory: vmWorkerFactory, timeoutMs: 100 });
  const result = await runner.run("function solve(input) { console.log(input); }", "sample");

  assert.deepEqual(result, { ok: true, output: "sample" });
});

test("reports missing solve functions and runtime errors", async () => {
  const runner = createJavaScriptRunner({ workerFactory: vmWorkerFactory, timeoutMs: 100 });
  const missing = await runner.run("const answer = 42;", "");
  const runtime = await runner.run("function solve() { throw new Error('broken'); }", "");

  assert.equal(missing.ok, false);
  assert.match(missing.error, /solve\(input\)/);
  assert.deepEqual(runtime, { ok: false, output: "", error: "broken" });
});

test("times out a worker that does not produce a result", async () => {
  let terminated = false;
  const runner = createJavaScriptRunner({
    timeoutMs: 15,
    workerFactory: () => ({
      postMessage() {},
      terminate() { terminated = true; }
    })
  });

  const result = await runner.run("function solve() { while (true) {} }", "");

  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
  assert.match(result.error, /timed out after 15 ms/);
  assert.equal(terminated, true);
});

test("terminating a reusable runner settles active work and blocks later runs", async () => {
  let terminated = false;
  const runner = createJavaScriptRunner({
    workerFactory: () => ({
      postMessage() {},
      terminate() { terminated = true; }
    })
  });
  const pending = runner.run("function solve() {}", "");
  runner.terminate();

  assert.deepEqual(await pending, { ok: false, output: "", error: "JavaScript runner was terminated.", terminated: true });
  assert.equal(terminated, true);
  assert.equal((await runner.run("function solve() {}", "")).terminated, true);
  assert.match(workerSource(), /self\.onmessage/);
});
