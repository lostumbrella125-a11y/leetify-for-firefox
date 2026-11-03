(function (root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LeetifyCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LANGUAGES = {
    cpp: {
      label: "C++17",
      mode: "cpp",
      extension: "cpp",
      template: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Solve ${"${TITLE}"} here.
    return 0;
}`
    },
    python: {
      label: "Python 3",
      mode: "python",
      extension: "py",
      template: `import sys

def solve(data: str) -> str:
    # Solve ${"${TITLE}"} here.
    return ""

if __name__ == "__main__":
    print(solve(sys.stdin.read()))`
    },
    java: {
      label: "Java 17",
      mode: "java",
      extension: "java",
      template: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        // Solve ${"${TITLE}"} here.
    }
}`
    },
    javascript: {
      label: "JavaScript",
      mode: "javascript",
      extension: "js",
      template: `function solve(input) {
  // The Firefox runner calls solve(input) with the complete stdin string.
  // Solve ${"${TITLE}"} here.
  return "";
}`
    }
  };

  function getLanguage(id) {
    return LANGUAGES[id] || LANGUAGES.cpp;
  }

  function starterCode(language, title) {
    return getLanguage(language).template.replace(/\$\{TITLE\}/g, title || "this problem");
  }

  function parseProblemUrl(pathname) {
    const path = String(pathname || "").replace(/\/+$/, "");
    let match = path.match(/^\/problemset\/problem\/([^/]+)\/([^/]+)$/i);
    if (match) {
      return { area: "problemset", contestId: match[1], index: match[2], key: `${match[1]}-${match[2]}` };
    }
    match = path.match(/^\/(contest|gym)\/([^/]+)\/problem\/([^/]+)$/i);
    if (match) {
      return { area: match[1].toLowerCase(), contestId: match[2], index: match[3], key: `${match[2]}-${match[3]}` };
    }
    match = path.match(/^\/group\/([^/]+)\/contest\/([^/]+)\/problem\/([^/]+)$/i);
    if (match) {
      return { area: "group", groupId: match[1], contestId: match[2], index: match[3], key: `${match[2]}-${match[3]}` };
    }
    return null;
  }

  function parseProblemMetadata(doc, locationLike) {
    const route = parseProblemUrl(locationLike && locationLike.pathname);
    if (!route || !doc) return null;

    const statement = doc.querySelector(".problem-statement");
    if (!statement) return null;

    const titleNode = statement.querySelector(".header .title");
    const rawTitle = titleNode ? titleNode.textContent.trim() : `${route.contestId}${route.index}`;
    const title = rawTitle.replace(/^\s*[A-Z][0-9]*\.\s*/, "").trim() || rawTitle;
    const ratingNode = Array.from(doc.querySelectorAll(".tag-box")).find((node) => /^\*\d+$/.test(node.textContent.trim()));
    const tags = Array.from(doc.querySelectorAll(".tag-box"))
      .map((node) => node.textContent.trim())
      .filter((tag) => tag && !/^\*\d+$/.test(tag));

    return {
      ...route,
      title,
      label: `${route.contestId}${route.index}`,
      rating: ratingNode ? ratingNode.textContent.trim().slice(1) : "—",
      tags,
      statement
    };
  }

  function textFromPre(node) {
    if (!node) return "";
    return (node.textContent || "").replace(/\r\n?/g, "\n").trim();
  }

  function parseSampleTests(statement) {
    if (!statement) return [];
    return Array.from(statement.querySelectorAll(".sample-test")).map((sample, index) => ({
      id: `sample-${index + 1}`,
      label: `Sample ${index + 1}`,
      input: textFromPre(sample.querySelector(".input pre")),
      output: textFromPre(sample.querySelector(".output pre"))
    })).filter((test) => test.input || test.output);
  }

  function normalizeOutput(value) {
    return String(value == null ? "" : value)
      .replace(/\r\n?/g, "\n")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  }

  function compareOutputs(actual, expected) {
    return normalizeOutput(actual) === normalizeOutput(expected);
  }

  function executeJavaScript(source, input) {
    const logs = [];
    const consoleProxy = {
      log: (...values) => logs.push(values.join(" ")),
      info: (...values) => logs.push(values.join(" ")),
      error: (...values) => logs.push(values.join(" "))
    };

    try {
      const runner = new Function("input", "console", `"use strict";\n${source}\n\nif (typeof solve !== "function") {\n  throw new Error("Define a solve(input) function to use the local JavaScript runner.");\n}\nreturn solve(input);`);
      const result = runner(String(input || ""), consoleProxy);
      const output = result == null ? logs.join("\n") : String(result);
      return { ok: true, output };
    } catch (error) {
      return { ok: false, output: "", error: error && error.message ? error.message : String(error) };
    }
  }

  function submitPath(meta) {
    if (!meta) return null;
    if (meta.area === "problemset") return "/problemset/submit";
    if (meta.area === "group") return `/group/${meta.groupId}/contest/${meta.contestId}/submit`;
    return `/${meta.area}/${meta.contestId}/submit`;
  }

  return {
    LANGUAGES,
    getLanguage,
    starterCode,
    parseProblemUrl,
    parseProblemMetadata,
    parseSampleTests,
    normalizeOutput,
    compareOutputs,
    executeJavaScript,
    submitPath
  };
});
