const test = require("node:test");
const assert = require("node:assert/strict");

const { collect, getReplacementSource } = require("../src/content/logo-probe.js");

function createElement({ src = "", srcset = "", replacementSource = "" } = {}) {
  return {
    _replacementSource: replacementSource,
    getAttribute(name) {
      if (name === "src") {
        return src;
      }

      if (name === "srcset") {
        return srcset;
      }

      return "";
    }
  };
}

test("getReplacementSource reads the CSS marker from computed styles", () => {
  const element = createElement({ replacementSource: '"header-tasks"' });
  const viewLike = {
    getComputedStyle(target) {
      assert.equal(target, element);
      return {
        getPropertyValue() {
          return target._replacementSource;
        }
      };
    }
  };

  assert.equal(getReplacementSource(element, viewLike), "header-tasks");
});

test("collect reports Tasks logo candidates and replacement matches", () => {
  const element = createElement({
    src: "https://www.gstatic.com/images/branding/productlogos/tasks_2026/v2/web/192px.svg",
    replacementSource: '"header-tasks"'
  });
  const documentLike = {
    querySelectorAll(selector) {
      return selector.includes("tasks_2026") ? [element] : [];
    }
  };
  const viewLike = {
    location: {
      hostname: "tasks.google.com",
      pathname: "/tasks/"
    },
    getComputedStyle(target) {
      return {
        getPropertyValue() {
          return target._replacementSource;
        }
      };
    }
  };

  assert.deepEqual(collect(viewLike, documentLike), {
    hostname: "tasks.google.com",
    pathname: "/tasks/",
    tasksProductlogo: {
      count: 1,
      replacementMatched: true,
      replacementSources: ["header-tasks"],
      sampleSources: [
        {
          src: "https://www.gstatic.com/images/branding/productlogos/tasks_2026/v2/web/192px.svg",
          srcset: ""
        }
      ]
    }
  });
});
