(function renderPopup() {
  const extension = globalThis.MakeGoogleFlatAgain;

  if (!extension?.apps || !extension?.settings || !extension?.runtime) {
    return;
  }

  const appCountElement = document.getElementById("app-count");
  const appListElement = document.getElementById("app-list");
  const extensionEnabledInput = document.getElementById("extension-enabled");
  const extensionStatusText = document.getElementById("extension-status-text");
  const extensionStatusGlow = document.getElementById("extension-status-glow");
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
        return prefixes ? `${rule.hostname}${prefixes}` : rule.hostname;
      })
      .join("\n");
  }
 
  function createAppItem(app) {
    const isEnabled = currentOptions.apps[app.id] !== false;
    const isMasterEnabled = currentOptions.enabled !== false;
    const item = document.createElement("li");
    item.className = "app-grid-item";
 
    const button = document.createElement("button");
    button.type = "button";
    button.className = `app-card ${isEnabled ? "is-enabled" : ""} ${!isMasterEnabled ? "is-master-disabled" : ""}`;
    button.setAttribute("role", "switch");
    button.setAttribute("aria-checked", isEnabled ? "true" : "false");
    button.title = `${app.label}\nDomains:\n${formatMatches(app.matches)}`;
    button.disabled = isSaving || !isMasterEnabled;
 
    const icon = document.createElement("img");
    icon.className = "app-icon";
    icon.alt = "";
    icon.src = extension.runtime.getRuntimeUrl(extension.apps.getAssetPath(app));
 
    const name = document.createElement("span");
    name.className = "app-name";
    name.textContent = app.label;
 
    button.appendChild(icon);
    button.appendChild(name);
 
    button.addEventListener("click", () => {
      void updateOptions((nextOptions) => {
        nextOptions.apps[app.id] = !currentOptions.apps[app.id];
      });
    });
 
    item.appendChild(button);
    return item;
  }
 

  function updateStatus(message, tone) {
    statusMessage = message || "";
    statusTone = tone || "info";
  }
 
  function syncStatusUi() {
    const isEnabled = currentOptions.enabled !== false;
    if (extensionStatusText) {
      extensionStatusText.textContent = isEnabled ? "Active" : "Disabled";
    }
    if (extensionStatusGlow) {
      extensionStatusGlow.className = `status-glow ${isEnabled ? "is-active" : "is-disabled"}`;
    }
    extensionEnabledInput.checked = isEnabled;
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
