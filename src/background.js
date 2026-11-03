(function () {
  const api = typeof browser !== "undefined" ? browser : chrome;

  if (!api || !api.browserAction) return;

  api.browserAction.onClicked.addListener((tab) => {
    if (!tab || !tab.id) return;
    api.tabs.sendMessage(tab.id, { type: "leetify-toggle" }).catch(() => {
      // The current tab is not a Codeforces problem page.
    });
  });
})();
