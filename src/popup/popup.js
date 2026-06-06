(function renderPopup() {
  const extension = globalThis.MakeGoogleFlatAgain;

  if (!extension?.apps || !extension?.guards || !extension?.settings || !extension?.runtime) {
    return;
  }

  const appCountElement = document.getElementById("app-count");
  const appListElement = document.getElementById("app-list");
  const extensionEnabledInput = document.getElementById("extension-enabled");
  const extensionStatusElement = document.getElementById("extension-status");
  const guardCountElement = document.getElementById("guard-count");
  const guardListElement = document.getElementById("guard-list");
  const saveStatusElement = document.getElementById("save-status");
  const extensionApi = extension.runtime.getExtensionApi();

  let currentOptions = extension.settings.normalizeOptions(extension.settings.DEFAULT_OPTIONS);
  let isSaving = false;
  let statusMessage = "";
  let statusTone = "info";

  function formatMatches(matches) {
    return matches
      .map((rule) => {
        const prefixes = (rule.pathnamePrefixes || []).join(", ");
        return prefixes ? `${rule.hostname} ${prefixes}` : rule.hostname;
      })
      .join(" | ");
  }

  function createToggleControl(inputId, checked, onChange) {
    const label = document.createElement("label");
    label.className = "switch";
    label.setAttribute("for", inputId);

    const input = document.createElement("input");
    input.id = inputId;
    input.className = "toggle-input";
    input.type = "checkbox";
    input.checked = checked;
    input.disabled = isSaving;
    input.addEventListener("change", onChange);

    const track = document.createElement("span");
    track.className = "toggle-ui";
    track.setAttribute("aria-hidden", "true");

    label.appendChild(input);
    label.appendChild(track);

    return label;
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

    const row = document.createElement("div");
    row.className = "toggle-row";
    row.appendChild(summary);
    row.appendChild(createToggleControl(`app-toggle-${app.id}`, currentOptions.apps[app.id] !== false, () => {
      void updateOptions((nextOptions) => {
        nextOptions.apps[app.id] = !currentOptions.apps[app.id];
      });
    }));

    item.appendChild(row);

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

  function updateStatus(message, tone) {
    statusMessage = message || "";
    statusTone = tone || "info";
  }

  function syncStatusUi() {
    extensionStatusElement.textContent = currentOptions.enabled === false ? "Off" : "On";
    extensionStatusElement.className = currentOptions.enabled === false ? "pill pill-off" : "pill";
    extensionEnabledInput.checked = currentOptions.enabled !== false;
    extensionEnabledInput.disabled = isSaving;
    saveStatusElement.textContent = statusMessage;
    saveStatusElement.dataset.tone = statusTone;
    appCountElement.textContent = `${extension.settings.countEnabledApps(currentOptions)}/${extension.apps.apps.length}`;
  }

  function renderApps() {
    appListElement.replaceChildren(...extension.apps.apps.map((app) => createAppItem(app)));
  }

  async function updateOptions(mutator) {
    if (isSaving) {
      return;
    }

    const nextOptions = {
      enabled: currentOptions.enabled !== false,
      apps: { ...currentOptions.apps }
    };

    mutator(nextOptions);

    isSaving = true;
    currentOptions = extension.settings.normalizeOptions(nextOptions);
    updateStatus("Saving settings...", "info");
    syncStatusUi();
    renderApps();

    try {
      currentOptions = await extension.settings.setOptions(currentOptions, extensionApi);
      updateStatus("Settings saved.", "info");
    } catch (error) {
      currentOptions = await extension.settings.getOptions(extensionApi);
      updateStatus(error?.message || "Failed to save settings.", "error");
    } finally {
      isSaving = false;
      syncStatusUi();
      renderApps();
    }
  }

  async function init() {
    currentOptions = await extension.settings.getOptions(extensionApi);
    updateStatus("", "info");
    syncStatusUi();
    renderApps();

    guardCountElement.textContent = String(extension.guards.pauseRules.length);

    for (const rule of extension.guards.pauseRules) {
      guardListElement.appendChild(createGuardItem(rule));
    }

    extensionEnabledInput.addEventListener("change", () => {
      void updateOptions((nextOptions) => {
        nextOptions.enabled = extensionEnabledInput.checked;
      });
    });

    const stopObserving = extension.settings.observeOptions((nextOptions) => {
      currentOptions = nextOptions;
      syncStatusUi();
      renderApps();
    }, extensionApi);

    window.addEventListener("unload", stopObserving, { once: true });
  }

  init();
})();
