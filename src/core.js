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
    const path = String(pathname || "").split(/[?#]/)[0].replace(/\/+$/, "");
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

  function parseSubmissionRoute(pathname) {
    const path = String(pathname || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    let match = path.match(/^\/problemset\/(submit|status)(?:\/([^/]+)(?:\/problem)?\/([^/]+))?$/i);
    if (match) {
      return { area: "problemset", action: match[1].toLowerCase(), contestId: match[2], index: match[3] };
    }
    match = path.match(/^\/(contest|gym)\/([^/]+)\/(submit|status)(?:\/(?:problem\/)?([^/]+))?$/i);
    if (match) {
      return { area: match[1].toLowerCase(), contestId: match[2], action: match[3].toLowerCase(), index: match[4] };
    }
    match = path.match(/^\/group\/([^/]+)\/contest\/([^/]+)\/(submit|status)(?:\/(?:problem\/)?([^/]+))?$/i);
    if (match) {
      return { area: "group", groupId: match[1], contestId: match[2], action: match[3].toLowerCase(), index: match[4] };
    }
    return null;
  }

  function queryFirst(doc, selectors) {
    if (!doc || typeof doc.querySelector !== "function") return null;
    for (const selector of selectors) {
      try {
        const node = doc.querySelector(selector);
        if (node) return node;
      } catch (error) {
        // Try the next known DOM shape.
      }
    }
    return null;
  }

  function parseSubmissionForm(doc) {
    return {
      form: queryFirst(doc, ["form#submitForm", "form[action*='/submit']"]),
      source: queryFirst(doc, [
        "textarea[name='sourceCode']",
        "textarea#sourceCode",
        "textarea#sourceCodeTextarea",
        "textarea[name='source']",
        "textarea#source",
        "textarea[name='programSource']"
      ]),
      language: queryFirst(doc, [
        "select[name='programTypeId']",
        "select[name='programType']",
        "select#programTypeId",
        "select#programType"
      ]),
      problem: queryFirst(doc, [
        "select[name='submittedProblemIndex']",
        "select#submittedProblemIndex",
        "select[name='problemIndex']"
      ]),
      problemCode: queryFirst(doc, [
        "input[name='submittedProblemCode']",
        "input#submittedProblemCode",
        "input[name='problemCode']"
      ])
    };
  }

  function optionText(option) {
    return String(option && (option.textContent || option.label || option.text || option.value) || "").trim();
  }

  function languageOptionScore(option, language) {
    const text = optionText(option);
    const value = String(option && option.value || "");
    const haystack = `${text} ${value}`;
    if (language === "cpp") {
      if (!/(?:c\+\+|gnu\s*c\+\+|clang)/i.test(haystack)) return -1;
      return (/(?:17|20|23)/i.test(text) ? 30 : /gnu\s*c\+\+/i.test(text) ? 15 : 10) + (/c\+\+/i.test(text) ? 3 : 0);
    }
    if (language === "python") {
      if (!/(?:python|pypy)/i.test(haystack)) return -1;
      return /(?:python\s*3|pypy\s*3)/i.test(text) ? 30 : 10;
    }
    if (language === "java") {
      if (!/java(?!script)/i.test(haystack)) return -1;
      return /(?:17|21|11|openjdk)/i.test(text) ? 30 : 10;
    }
    if (language === "javascript") {
      if (!/(?:javascript|node\.?js|ecmascript)/i.test(haystack)) return -1;
      return 30;
    }
    return -1;
  }

  function findLanguageOption(options, language) {
    const candidates = Array.from(options || []).map((option, index) => ({ option, index, score: languageOptionScore(option, language) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((left, right) => right.score - left.score);
    return candidates.length ? candidates[0].option : null;
  }

  function findProblemOption(options, problem) {
    const index = String(problem && problem.index || problem || "").trim().toUpperCase();
    if (!index) return null;
    const contestId = String(problem && problem.contestId || "").trim();
    const escaped = index.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const optionsList = Array.from(options || []);
    const exact = optionsList.find((option) => String(option.value || "").trim().toUpperCase() === index);
    if (exact) return exact;
    const labelled = optionsList.find((option) => new RegExp(`^${escaped}\\s*[.) :-]`, "i").test(optionText(option)));
    if (labelled) return labelled;
    return optionsList.find((option) => {
      const text = optionText(option).toUpperCase();
      return text.includes(`${contestId}${index}`) || text.includes(`PROBLEM ${index}`);
    }) || null;
  }

  function normalizeVerdict(value) {
    const verdict = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (/^(?:ok|accepted|pretests passed|hacked)$/i.test(verdict) || /\b(?:ok|accepted)\b/i.test(verdict)) {
      return { status: "accepted", verdict };
    }
    if (/(?:testing|running|queued|queue|pending|judging|in queue)/i.test(verdict)) {
      return { status: "pending", verdict };
    }
    if (verdict) return { status: "failed", verdict };
    return { status: "unknown", verdict: "" };
  }

  function problemFromHref(href) {
    const value = String(href || "");
    const path = value.match(/https?:\/\/[^/]+([^?#]*)/i);
    return parseProblemUrl(path ? path[1] : value.split(/[?#]/)[0]);
  }

  function parseSubmissionRows(doc) {
    if (!doc || typeof doc.querySelectorAll !== "function") return [];
    let rows;
    try {
      rows = Array.from(doc.querySelectorAll("tr"));
    } catch (error) {
      return [];
    }
    return rows.map((row) => {
      const cells = typeof row.querySelectorAll === "function" ? Array.from(row.querySelectorAll("td")) : [];
      const problemLink = queryFirst(row, ["a[href*='/problem/']", "a[href*='/problemset/problem/']"]);
      const authorLink = queryFirst(row, ["a[href*='/profile/']"]);
      const verdictNode = queryFirst(row, [
        ".submissionVerdictWrapper",
        ".verdict-accepted",
        ".verdict-wrong-answer",
        ".verdict-testing",
        "td:last-child"
      ]);
      const verdict = normalizeVerdict(verdictNode ? verdictNode.textContent : "");
      const problem = problemFromHref(problemLink && problemLink.href);
      return {
        id: cells[0] ? optionText(cells[0]) : "",
        problem,
        handle: authorLink ? optionText(authorLink) : "",
        verdict: verdict.verdict,
        status: verdict.status,
        text: optionText(row)
      };
    }).filter((row) => row.problem || row.verdict || row.status !== "unknown");
  }

  function parseCurrentUserHandle(doc) {
    const link = queryFirst(doc, [
      ".userbox a[href*='/profile/']",
      "#header a[href*='/profile/']",
      "a[href*='/profile/']"
    ]);
    if (!link) return "";
    const match = String(link.href || "").match(/\/profile\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : optionText(link);
  }

  function getProblemStats(doc, problem, handle) {
    const key = problem && problem.key ? problem.key : `${problem && problem.contestId}-${problem && problem.index}`;
    const currentHandle = handle || parseCurrentUserHandle(doc);
    const rows = parseSubmissionRows(doc).filter((row) => row.problem && row.problem.key === key);
    const ownRows = currentHandle ? rows.filter((row) => !row.handle || row.handle === currentHandle) : rows;
    return {
      attempts: ownRows.length,
      solved: ownRows.some((row) => row.status === "accepted"),
      latest: ownRows[0] || null,
      handle: currentHandle,
      hasData: ownRows.length > 0
    };
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

  function highlightCode(source, language) {
    const escaped = String(source == null ? "" : source)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const keywords = language === "python"
      ? "and|as|assert|async|await|break|class|continue|def|elif|else|for|from|if|import|in|is|lambda|not|or|pass|print|raise|return|try|while|with|yield"
      : "class|const|else|for|function|if|import|new|private|public|return|static|switch|this|throw|try|var|void|while|async|await|break|case|continue|extends|interface|package|protected|implements|using|namespace|auto|bool|int|long|double|float|char|true|false|null|undefined|final|boolean|String";
    const tokenPattern = new RegExp(`(//[^\\n]*|#[^\\n]*|/\\*[\\s\\S]*?\\*/)|(&quot;(?:\\\\.|[^&]|&(?!quot;))*?&quot;|'(?:\\\\.|[^'])*'|\\x60(?:\\\\.|[^\\x60])*\\x60)|(\\b(?:${keywords})\\b)|(\\b\\d+(?:\\.\\d+)?\\b)`, "g");
    return escaped.replace(tokenPattern, (match, comment, string, keyword, number) => {
      if (comment) return `<span class="tok-comment">${comment}</span>`;
      if (string) return `<span class="tok-string">${string}</span>`;
      if (keyword) return `<span class="tok-keyword">${keyword}</span>`;
      if (number) return `<span class="tok-number">${number}</span>`;
      return match;
    });
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
    parseSubmissionRoute,
    parseSubmissionForm,
    findLanguageOption,
    findProblemOption,
    normalizeVerdict,
    parseSubmissionRows,
    parseCurrentUserHandle,
    getProblemStats,
    parseProblemMetadata,
    parseSampleTests,
    normalizeOutput,
    compareOutputs,
    highlightCode,
    executeJavaScript,
    submitPath
  };
});
