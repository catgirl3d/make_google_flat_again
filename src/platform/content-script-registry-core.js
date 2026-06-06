(function attachContentScriptRegistryCore(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../shared/runtime.js");

  function normalizeDesiredScript(script) {
    return {
      id: String(script.id),
      matches: Array.isArray(script.matches) ? [...script.matches] : [],
      cssFile: script.cssFile,
      runAt: script.runAt || "document_start"
    };
  }

  function normalizeSyncPayload(payload) {
    return {
      managedIds: Array.isArray(payload?.managedIds) ? [...payload.managedIds] : [],
      desiredScripts: Array.isArray(payload?.desiredScripts)
        ? payload.desiredScripts.map((script) => normalizeDesiredScript(script))
        : []
    };
  }

  function buildRegistration(desiredScript) {
    return {
      id: desiredScript.id,
      matches: [...desiredScript.matches],
      css: [desiredScript.cssFile],
      runAt: desiredScript.runAt || "document_start",
      persistAcrossSessions: true
    };
  }

  function createContentScriptRegistry({ getRootApi }) {
    function getScriptingApi(extensionApi) {
      const api = getRootApi(extensionApi);
      return api?.scripting ? api : null;
    }

    function callScriptingMethod(extensionApi, methodName, args, failureMessage) {
      const api = getScriptingApi(extensionApi);
      const method = api?.scripting?.[methodName];

      if (typeof method !== "function") {
        return Promise.resolve(undefined);
      }

      try {
        if (method.length <= args.length) {
          return Promise.resolve(method.apply(api.scripting, args));
        }

        return new Promise((resolve, reject) => {
          method.apply(api.scripting, [
            ...args,
            (result) => {
              const currentApi = getRootApi(extensionApi);

              if (currentApi?.runtime?.lastError) {
                reject(new Error(currentApi.runtime.lastError.message || failureMessage));
                return;
              }

              resolve(result);
            }
          ]);
        });
      } catch (error) {
        return Promise.reject(error);
      }
    }

    async function getRegisteredManagedIds(managedIds, extensionApi) {
      const scriptingApi = getScriptingApi(extensionApi);

      if (!scriptingApi?.scripting?.getRegisteredContentScripts) {
        return null;
      }

      const registeredScripts = await callScriptingMethod(
        extensionApi,
        "getRegisteredContentScripts",
        [{ ids: managedIds }],
        "Failed to list registered content scripts."
      );

      return Array.isArray(registeredScripts)
        ? registeredScripts.map((script) => script.id).filter(Boolean)
        : [];
    }

    async function syncManagedCssScripts(payload, extensionApi) {
      const normalizedPayload = normalizeSyncPayload(payload);
      const scriptingApi = getScriptingApi(extensionApi);

      if (!scriptingApi?.scripting?.registerContentScripts || !scriptingApi.scripting.unregisterContentScripts) {
        return {
          managedIds: normalizedPayload.managedIds,
          desiredScripts: normalizedPayload.desiredScripts,
          removedIds: [],
          addedIds: [],
          skipped: true
        };
      }

      const desiredById = new Map(normalizedPayload.desiredScripts.map((script) => [script.id, script]));
      let currentManagedIds = await getRegisteredManagedIds(normalizedPayload.managedIds, extensionApi);
      let usedFallback = false;

      if (currentManagedIds === null) {
        usedFallback = true;
        currentManagedIds = [...normalizedPayload.managedIds];
      }

      const staleIds = currentManagedIds.filter((scriptId) => !desiredById.has(scriptId));
      const missingScripts = usedFallback
        ? normalizedPayload.desiredScripts
        : normalizedPayload.desiredScripts.filter((script) => !currentManagedIds.includes(script.id));

      if (usedFallback && normalizedPayload.managedIds.length > 0) {
        await callScriptingMethod(
          extensionApi,
          "unregisterContentScripts",
          [{ ids: normalizedPayload.managedIds }],
          "Failed to clear managed content scripts."
        );
      } else if (staleIds.length > 0) {
        await callScriptingMethod(
          extensionApi,
          "unregisterContentScripts",
          [{ ids: staleIds }],
          "Failed to unregister stale content scripts."
        );
      }

      if (missingScripts.length > 0) {
        await callScriptingMethod(
          extensionApi,
          "registerContentScripts",
          [missingScripts.map((script) => buildRegistration(script))],
          "Failed to register content scripts."
        );
      }

      return {
        managedIds: normalizedPayload.managedIds,
        desiredScripts: normalizedPayload.desiredScripts,
        removedIds: usedFallback ? [...normalizedPayload.managedIds] : staleIds,
        addedIds: missingScripts.map((script) => script.id),
        usedFallback
      };
    }

    return {
      buildRegistration,
      syncManagedCssScripts
    };
  }

  const api = {
    buildRegistration,
    createContentScriptRegistry
  };

  runtime.attach("contentScriptRegistryCore", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
