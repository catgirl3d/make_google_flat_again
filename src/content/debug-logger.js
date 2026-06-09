(function attachDebugLogger(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../shared/runtime.js");
  const buildFlags = globalScope.MakeGoogleFlatAgain?.buildFlags || require("../shared/build-flags.js");

  const STORE_KEY = "__MGFA_DEBUG__";
  const HISTORY_LIMIT = 120;
  const NOOP_LOGGER = Object.freeze({
    event() {
      return false;
    },
    snapshot() {
      return false;
    },
    read() {
      return null;
    }
  });

  function stableClone(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => stableClone(entry));
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableClone(value[key]);
        return result;
      }, {});
  }

  function stableSerialize(value) {
    return JSON.stringify(stableClone(value));
  }

  function ensureStore() {
    if (!globalScope[STORE_KEY]) {
      globalScope[STORE_KEY] = {
        history: [],
        scopes: {},
        version: 1
      };
    }

    return globalScope[STORE_KEY];
  }

  function remember(scope, label, kind, payload, serialized) {
    const store = ensureStore();
    const scopeState = store.scopes[scope] || { snapshots: {}, serialized: {} };

    scopeState.snapshots[label] = payload;
    scopeState.serialized[label] = serialized;
    store.scopes[scope] = scopeState;
    store.last = {
      kind,
      label,
      payload,
      scope,
      timestamp: Date.now()
    };

    store.history.push(store.last);
    if (store.history.length > HISTORY_LIMIT) {
      store.history.shift();
    }
  }

  function writeLog(scope, label, payload) {
    const prefix = `[MGFA:${scope}] ${label}`;
    if (typeof payload === "undefined") {
      globalScope.console?.log(prefix);
      return;
    }

    globalScope.console?.log(prefix, payload);
  }

  function create(scope) {
    if (!buildFlags.isDevelopment) {
      return NOOP_LOGGER;
    }

    return {
      event(label, payload) {
        const snapshot = typeof payload === "undefined" ? undefined : stableClone(payload);
        remember(scope, label, "event", snapshot, stableSerialize(snapshot));
        writeLog(scope, label, snapshot);
        return true;
      },
      snapshot(label, payload) {
        const snapshot = stableClone(payload);
        const serialized = stableSerialize(snapshot);
        const previous = ensureStore().scopes[scope]?.serialized?.[label];

        if (previous === serialized) {
          return false;
        }

        remember(scope, label, "snapshot", snapshot, serialized);
        writeLog(scope, label, snapshot);
        return true;
      },
      read(label) {
        return ensureStore().scopes[scope]?.snapshots?.[label] || null;
      }
    };
  }

  const api = {
    create,
    stableClone,
    stableSerialize
  };

  runtime.attach("debugLogger", api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
