(function renderPopup() {
  const extension = globalThis.MakeGoogleFlatAgain;

  if (!extension?.apps || !extension?.guards || !extension?.settings || !extension?.runtime) {
    return;
  }

  const appCountElement = document.getElementById("app-count");
  const appListElement = document.getElementById("app-list");
  const guardCountElement = document.getElementById("guard-count");
  const guardListElement = document.getElementById("guard-list");

  function formatMatches(matches) {
    return matches
      .map((rule) => {
        const prefixes = (rule.pathnamePrefixes || []).join(", ");
        return prefixes ? `${rule.hostname} ${prefixes}` : rule.hostname;
      })
      .join(" | ");
  }

  function createAppItem(app) {
    const item = document.createElement("li");
    item.className = "item-row";

    const summary = document.createElement("div");
    summary.className = "item-summary";

    const icon = document.createElement("img");
    icon.className = "app-icon";
    icon.alt = "";
    icon.src = extension.runtime.getRuntimeUrl(extension.apps.getAssetPath(app));

    const copy = document.createElement("div");

    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = app.label;

    const match = document.createElement("span");
    match.className = "item-meta";
    match.textContent = formatMatches(app.matches);

    copy.appendChild(name);
    copy.appendChild(match);
    summary.appendChild(icon);
    summary.appendChild(copy);
    item.appendChild(summary);

    return item;
  }

  function createGuardItem(rule) {
    const item = document.createElement("li");
    item.className = "guard-item";

    const title = document.createElement("span");
    title.className = "item-name";
    title.textContent = rule.label;

    const description = document.createElement("span");
    description.className = "item-meta";
    description.textContent = rule.description;

    item.appendChild(title);
    item.appendChild(description);
    return item;
  }

  async function init() {
    const options = await extension.settings.getOptions(extension.runtime.getExtensionApi());

    appCountElement.textContent = `${extension.settings.countEnabledApps(options)}/${extension.apps.apps.length}`;
    guardCountElement.textContent = String(extension.guards.pauseRules.length);

    for (const app of extension.apps.apps) {
      appListElement.appendChild(createAppItem(app));
    }

    for (const rule of extension.guards.pauseRules) {
      guardListElement.appendChild(createGuardItem(rule));
    }
  }

  init();
})();
