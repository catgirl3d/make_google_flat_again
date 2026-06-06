(function attachHeaderSurface(globalScope) {
  const runtime = globalScope.__MGFA_RUNTIME__ || require("../../shared/runtime.js");
  const appsApi = globalScope.MakeGoogleFlatAgain?.apps || require("../../shared/apps.js");
  const debugApi = globalScope.MakeGoogleFlatAgain?.debugLogger || require("../debug-logger.js");
  const guardsApi = globalScope.MakeGoogleFlatAgain?.guards || require("../../shared/guards.js");
  const settingsApi = globalScope.MakeGoogleFlatAgain?.settings || require("../../shared/settings.js");
  const surfaceRegistry = globalScope.MakeGoogleFlatAgain?.surfaceRegistry || require("../surface-registry.js");
  const logger = debugApi.create("header");

  const OVERLAY_ID = "mgfa-header-overlay";
  const STYLE_ID = "mgfa-header-style";
  const ATTR_NAME = "data-mgfa-header-app";
  const CSS_DETECTION_ATTR = "data-mgfa-header-css-detection";
  const ORIGINAL_ICON_ATTR = "data-mgfa-header-original-icon";
  const ORIGINAL_LOCKUP_ATTR = "data-mgfa-header-original-lockup";

  function roundRectValue(value) {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  function rectSnapshot(rect) {
    if (!rect) {
      return null;
    }

    return {
      height: roundRectValue(rect.height),
      left: roundRectValue(rect.left),
      top: roundRectValue(rect.top),
      width: roundRectValue(rect.width)
    };
  }

  function elementSnapshot(element) {
    if (!element) {
      return null;
    }

    const className = typeof element.className === "string" ? element.className : "";

    return {
      className: className.slice(0, 120),
      id: element.id || null,
      tag: element.tagName?.toLowerCase() || null,
      text: meaningfulInnerText(element).slice(0, 60)
    };
  }

  function normalized(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isTransparent(color) {
    return !color || color === "transparent" || color === "rgba(0, 0, 0, 0)";
  }

  function parseRgb(color) {
    const match = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) {
      return null;
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  function luminance(rgb) {
    if (!rgb) {
      return 1;
    }

    const [r, g, b] = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function nearestBackground(element) {
    let node = element;

    for (let i = 0; node && i < 10; i += 1, node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      if (!isTransparent(color)) {
        return color;
      }
    }

    const bodyColor = document.body ? getComputedStyle(document.body).backgroundColor : "";
    if (!isTransparent(bodyColor)) {
      return bodyColor;
    }

    const htmlColor = document.documentElement ? getComputedStyle(document.documentElement).backgroundColor : "";
    if (!isTransparent(htmlColor)) {
      return htmlColor;
    }

    return "#f6f8fc";
  }

  function isDarkPage() {
    return luminance(parseRgb(nearestBackground(document.body || document.documentElement))) < 0.35;
  }

  function gmailTextColor(target) {
    let node = target;

    for (let i = 0; node && i < 8; i += 1, node = node.parentElement) {
      const color = getComputedStyle(node).color;
      const rgb = parseRgb(color);
      if (rgb) {
        const lum = luminance(rgb);
        if (lum > 0.15 || isDarkPage()) {
          return color;
        }
      }
    }

    return isDarkPage() ? "#e8eaed" : "#5f6368";
  }

  function rectLooksUsable(rect, config) {
    if (!rect) {
      return false;
    }

    if (rect.width < 14 || rect.width > 240) {
      return false;
    }

    if (rect.height < 14 || rect.height > 86) {
      return false;
    }

    if (rect.left < 0 || rect.left > config.maxLeft) {
      return false;
    }

    if (rect.top < 0 || rect.top > config.maxTop) {
      return false;
    }

    return true;
  }

  function meaningfulInnerText(element) {
    return String(element?.innerText || element?.textContent || "").trim();
  }

  function nodeText(node) {
    const parts = [];
    if (!node) {
      return "";
    }

    for (let i = 0, element = node; element && i < 7; i += 1, element = element.parentElement) {
      parts.push(element.getAttribute?.("src"));
      parts.push(element.getAttribute?.("href"));
      parts.push(element.getAttribute?.("xlink:href"));
      parts.push(element.getAttribute?.("alt"));
      parts.push(element.getAttribute?.("aria-label"));
      parts.push(element.getAttribute?.("title"));
      parts.push(element.getAttribute?.("data-tooltip"));
      parts.push(element.getAttribute?.("data-ogsr-up"));
      parts.push(element.className);
      parts.push(element.id);
    }

    return normalized(parts.filter(Boolean).join(" "));
  }

  function styleLooksLikeIcon(element) {
    try {
      const style = getComputedStyle(element);
      if (style.backgroundImage && style.backgroundImage !== "none") return true;
      if (style.maskImage && style.maskImage !== "none") return true;
      if (style.webkitMaskImage && style.webkitMaskImage !== "none") return true;

      const before = getComputedStyle(element, "::before");
      const after = getComputedStyle(element, "::after");

      if (before.backgroundImage && before.backgroundImage !== "none") return true;
      if (after.backgroundImage && after.backgroundImage !== "none") return true;
      if (before.webkitMaskImage && before.webkitMaskImage !== "none") return true;
      if (after.webkitMaskImage && after.webkitMaskImage !== "none") return true;
    } catch (_) {
      return false;
    }

    return false;
  }

  function scoreCandidate(element, app) {
    const config = app.surfaces.header;
    const rect = element.getBoundingClientRect();

    if (!rectLooksUsable(rect, config)) {
      return -1;
    }

    const text = nodeText(element);
    let score = 0;

    for (const keyword of config.keywords || []) {
      if (text.includes(normalized(keyword))) {
        score += 25;
      }
    }

    const tag = element.tagName?.toLowerCase();
    if (tag === "img") score += 12;
    if (tag === "svg") score += 8;
    if (tag === "image") score += 8;

    if (config.useExtendedDetection) {
      if (styleLooksLikeIcon(element)) score += 16;

      const classAndId = normalized(`${element.className || ""} ${element.id || ""}`);
      if (/docs.*icon|icon.*docs|product.*icon|app.*icon|logo/.test(classAndId)) {
        score += 14;
      }

      const innerText = meaningfulInnerText(element);
      if (app.id !== "gmail" && innerText.length > 3 && rect.width > 70) {
        score -= 24;
      }
    }

    if (rect.left < 90) score += 10;
    if (rect.top < 70) score += 10;
    if (rect.width <= 80) score += 8;

    if (config.useExtendedDetection && rect.left < 80 && rect.top < 55) {
      score += 18;
    }

    return score;
  }

  function selectorsForApp(app) {
    const config = app.surfaces.header;
    const common = config.useExtendedDetection
      ? [
          "img",
          "svg",
          "image",
          "[role='img']",
          "[class*='docs-icon' i]",
          "[class*='product-icon' i]",
          "[class*='app-icon' i]",
          "[class*='logo' i]"
        ]
      : ["img", "svg", "image", "[role='img']"];

    const specific = (config.keywords || []).flatMap((keyword) => {
      const escaped = keyword.replace(/"/g, '\\"');
      return [
        `img[src*="${escaped}" i]`,
        `img[alt*="${escaped}" i]`,
        `[aria-label*="${escaped}" i] img`,
        `[aria-label*="${escaped}" i] svg`,
        `[title*="${escaped}" i] img`,
        `[title*="${escaped}" i] svg`
      ];
    });

    return Array.from(new Set([...(config.targetSelectors || []), ...specific, ...common]));
  }

  function pointCandidates(app) {
    const config = app.surfaces.header;

    if (!config.useExtendedDetection) {
      return [];
    }

    const found = new Set();
    const maxX = Math.min(config.maxLeft, Math.max(90, Math.round(window.innerWidth * 0.28)));
    const maxY = Math.min(config.maxTop, 100);

    try {
      for (let x = 4; x <= maxX; x += 12) {
        for (let y = 4; y <= maxY; y += 12) {
          for (const element of document.elementsFromPoint(x, y)) {
            if (!element || element === document.documentElement || element === document.body) {
              continue;
            }

            found.add(element);
          }
        }
      }
    } catch (_) {
      return [];
    }

    return Array.from(found);
  }

  function forcedBrandingTarget(app) {
    const selector = app.surfaces.header.forceBrandingSelector;

    if (!selector) {
      return null;
    }

    const target = document.querySelector(selector);
    if (!target) {
      return null;
    }

    return rectLooksUsable(target.getBoundingClientRect(), app.surfaces.header) ? target : null;
  }

  function inspectDocsBranding(app) {
    if (!["docs", "sheets", "slides", "forms"].includes(app.id)) {
      return null;
    }

    const brandingLogo = document.querySelector("#docs-branding-logo");
    return {
      exists: Boolean(brandingLogo),
      rect: rectSnapshot(brandingLogo?.getBoundingClientRect()),
      target: elementSnapshot(brandingLogo)
    };
  }

  function supportsStaticBrandingCss(app) {
    return Boolean(app && ["docs", "sheets", "slides", "forms"].includes(app.id));
  }

  function hasStaticBrandingTarget() {
    return Boolean(document.querySelector("#docs-branding-logo .docs-branding-icon-img"));
  }

  function hasStaticHomeImageTarget(app) {
    if (!supportsStaticBrandingCss(app)) {
      return false;
    }

    const selectorByAppId = {
      docs: 'a[href*="docs.google.com/document/"] > img[src*="productlogos/docs_2026"], a[href*="docs.google.com/document/"] > img[srcset*="productlogos/docs_2026"]',
      sheets: 'a[href*="docs.google.com/spreadsheets/"] > img[src*="productlogos/sheets_2026"], a[href*="docs.google.com/spreadsheets/"] > img[srcset*="productlogos/sheets_2026"]',
      slides: 'a[href*="docs.google.com/presentation/"] > img[src*="productlogos/slides_2026"], a[href*="docs.google.com/presentation/"] > img[srcset*="productlogos/slides_2026"]',
      forms: 'a[href*="docs.google.com/forms/"] > img[src*="productlogos/forms_2026"], a[href*="docs.google.com/forms/"] > img[srcset*="productlogos/forms_2026"]'
    };

    const selector = selectorByAppId[app.id];
    return Boolean(selector && document.querySelector(selector));
  }

  function resolveHeaderTarget(app) {
    const docsBranding = inspectDocsBranding(app);
    const forcedTarget = forcedBrandingTarget(app);
    if (forcedTarget) {
      return {
        bestScore: null,
        candidateCount: 1,
        docsBranding,
        strategy: "forced",
        target: forcedTarget
      };
    }

    let candidates = [];

    for (const selector of selectorsForApp(app)) {
      try {
        candidates = candidates.concat(Array.from(document.querySelectorAll(selector)));
      } catch (_) {
        // Defensive: invalid selector from Google-side markup variations should not break the surface.
      }
    }

    candidates = Array.from(new Set(candidates.concat(pointCandidates(app))));

    let best = null;
    let bestScore = -1;

    for (const element of candidates) {
      const score = scoreCandidate(element, app);
      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }

    if (best && bestScore >= app.surfaces.header.minScore) {
      return {
        bestScore,
        candidateCount: candidates.length,
        docsBranding,
        strategy: "scored",
        target: best
      };
    }

    const fallbackSelector = app.surfaces.header.useExtendedDetection
      ? "img, svg, image, [role='img'], [class*='docs-icon' i], [class*='product-icon' i], [class*='app-icon' i], [class*='logo' i]"
      : "img, svg, image, [role='img']";

    const fallbackCandidates = Array.from(new Set([...document.querySelectorAll(fallbackSelector), ...pointCandidates(app)]))
      .filter((element) => rectLooksUsable(element.getBoundingClientRect(), app.surfaces.header))
      .filter((element) => {
        return !app.surfaces.header.useExtendedDetection || app.id === "gmail" || !(meaningfulInnerText(element).length > 3 && element.getBoundingClientRect().width > 70);
      })
      .sort((leftElement, rightElement) => {
        const leftRect = leftElement.getBoundingClientRect();
        const rightRect = rightElement.getBoundingClientRect();
        return leftRect.left + leftRect.top - (rightRect.left + rightRect.top);
      });

    return {
      bestScore,
      candidateCount: candidates.length,
      docsBranding,
      strategy: fallbackCandidates[0] ? "fallback" : "none",
      target: fallbackCandidates[0] || null
    };
  }

  function looksLikeSingleIcon(app, rect) {
    if (rect.width <= 58) {
      return true;
    }

    if (["docs", "sheets", "slides", "forms", "calendar", "drive", "meet", "chat", "keep", "maps"].includes(app.id) && rect.width <= 90) {
      return true;
    }

    return false;
  }

  function clearHeaderMarks() {
    document.querySelectorAll(`[${ORIGINAL_ICON_ATTR}='1'], [${ORIGINAL_LOCKUP_ATTR}='1']`).forEach((element) => {
      element.removeAttribute(ORIGINAL_ICON_ATTR);
      element.removeAttribute(ORIGINAL_LOCKUP_ATTR);
    });
  }

  function markOriginal(target, attr) {
    document.querySelectorAll(`[${ORIGINAL_ICON_ATTR}='1'], [${ORIGINAL_LOCKUP_ATTR}='1']`).forEach((element) => {
      if (element !== target || !attr) {
        element.removeAttribute(ORIGINAL_ICON_ATTR);
        element.removeAttribute(ORIGINAL_LOCKUP_ATTR);
        return;
      }

      if (attr === ORIGINAL_ICON_ATTR) {
        element.removeAttribute(ORIGINAL_LOCKUP_ATTR);
      }

      if (attr === ORIGINAL_LOCKUP_ATTR) {
        element.removeAttribute(ORIGINAL_ICON_ATTR);
      }
    });

    if (attr && target.getAttribute(attr) !== "1") {
      target.setAttribute(attr, "1");
    }
  }

  function buildHideCss(app) {
    const scopedRoots = (app.surfaces.header.hideRoots || []).map((selector) => `html[${ATTR_NAME}="${app.id}"] ${selector}`);
    const docsScopedRoots = scopedRoots.length
      ? `
html[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] ${app.surfaces.header.hideRoots.join(`,\nhtml[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] `)},
html[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] ${app.surfaces.header.hideRoots.map((selector) => `${selector} *`).join(`,\nhtml[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] `)} {
  opacity: 0 !important;
  visibility: hidden !important;
  transition: none !important;
  animation: none !important;
}

html[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] ${app.surfaces.header.hideRoots.map((selector) => `${selector}::before`).join(`,\nhtml[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] `)},
html[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] ${app.surfaces.header.hideRoots.map((selector) => `${selector}::after`).join(`,\nhtml[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] `)},
html[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] ${app.surfaces.header.hideRoots.map((selector) => `${selector} *::before`).join(`,\nhtml[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] `)},
html[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] ${app.surfaces.header.hideRoots.map((selector) => `${selector} *::after`).join(`,\nhtml[${ATTR_NAME}="${app.id}"][${CSS_DETECTION_ATTR}="1"] `)} {
  opacity: 0 !important;
  visibility: hidden !important;
  background-image: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
  content: none !important;
  transition: none !important;
  animation: none !important;
}
`.trim()
      : "";

    return `
[${ORIGINAL_ICON_ATTR}="1"],
[${ORIGINAL_LOCKUP_ATTR}="1"] {
  opacity: 0 !important;
  visibility: hidden !important;
}

[${ORIGINAL_ICON_ATTR}="1"] *,
[${ORIGINAL_LOCKUP_ATTR}="1"] * {
  opacity: 0 !important;
  visibility: hidden !important;
}

[${ORIGINAL_ICON_ATTR}="1"]::before,
[${ORIGINAL_ICON_ATTR}="1"]::after,
[${ORIGINAL_LOCKUP_ATTR}="1"]::before,
[${ORIGINAL_LOCKUP_ATTR}="1"]::after,
[${ORIGINAL_ICON_ATTR}="1"] *::before,
[${ORIGINAL_ICON_ATTR}="1"] *::after,
[${ORIGINAL_LOCKUP_ATTR}="1"] *::before,
[${ORIGINAL_LOCKUP_ATTR}="1"] *::after {
  opacity: 0 !important;
  visibility: hidden !important;
  background-image: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
  content: none !important;
}

.mgfa-gmail-lockup {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  background: transparent !important;
  white-space: nowrap !important;
}

.mgfa-gmail-lockup img {
  width: 32px !important;
  height: 32px !important;
  object-fit: contain !important;
  display: block !important;
  flex: 0 0 auto !important;
}

.mgfa-gmail-lockup span {
  font-family: "Google Sans", Roboto, Arial, sans-serif !important;
  font-size: 22px !important;
  line-height: 1 !important;
  font-weight: 400 !important;
  letter-spacing: -0.2px !important;
}

${docsScopedRoots}
`.trim();
  }

  function ensureStyleElement() {
    let styleElement = document.getElementById(STYLE_ID);

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleElement);
      logger.event("style-created", { id: STYLE_ID });
    }

    return styleElement;
  }

  function ensureOverlayElement() {
    let overlay = document.getElementById(OVERLAY_ID);

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.setAttribute("aria-hidden", "true");
      overlay.style.position = "fixed";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "2147483647";
      overlay.style.backgroundRepeat = "no-repeat";
      overlay.style.backgroundPosition = "center";
      overlay.style.backgroundSize = "contain";
      overlay.style.boxSizing = "border-box";
      overlay.style.contain = "layout paint style";
      overlay.style.willChange = "left, top, width, height, background-image";
      overlay.style.display = "none";
      document.documentElement.appendChild(overlay);
      logger.event("overlay-created", { id: OVERLAY_ID });
    }

    return overlay;
  }

  function setOverlayAsIcon(overlay, iconUrl, size) {
    overlay.className = "";
    overlay.textContent = "";
    overlay.style.backgroundImage = `url("${iconUrl}")`;
    overlay.style.backgroundRepeat = "no-repeat";
    overlay.style.backgroundPosition = "center";
    overlay.style.backgroundSize = "contain";
    overlay.style.width = `${size}px`;
    overlay.style.height = `${size}px`;
  }

  function setOverlayAsGmailLockup(overlay, target, size, app) {
    overlay.className = "mgfa-gmail-lockup";
    overlay.style.backgroundImage = "none";
    overlay.style.width = "auto";
    overlay.style.height = `${size}px`;

    let image = overlay.querySelector("img");
    let label = overlay.querySelector("span");

    if (!image) {
      image = document.createElement("img");
      image.alt = "";
      image.decoding = "async";
      overlay.appendChild(image);
    }

    if (!label) {
      label = document.createElement("span");
      overlay.appendChild(label);
    }

    image.src = runtime.getRuntimeUrl(appsApi.getAssetPath(app));
    label.textContent = app.label;
    label.style.color = gmailTextColor(target);
  }

  function getHeaderApp(options) {
    const app = appsApi.findPrimaryApp(window.location);

    if (!app || !app.surfaces?.header) {
      return null;
    }

    if (!settingsApi.appEnabled(app.id, options)) {
      return null;
    }

    return app;
  }

  function scheduleNextMidnight(callback) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 5, 0);
    return window.setTimeout(callback, Math.max(1000, next.getTime() - now.getTime()));
  }

  function start(context) {
    let started = false;
    let observer = null;
    let scheduled = false;
    let missingTargetCount = 0;
    let midnightTimer = null;

    function cleanup(reason) {
      logger.snapshot("cleanup", {
        cssDetection: document.documentElement?.getAttribute(CSS_DETECTION_ATTR) || null,
        overlayPresent: Boolean(document.getElementById(OVERLAY_ID)),
        reason: reason || "unspecified",
        stylePresent: Boolean(document.getElementById(STYLE_ID))
      });
      document.documentElement?.removeAttribute("data-mgfa-critical-branding");
      document.getElementById(OVERLAY_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
      document.documentElement?.removeAttribute(ATTR_NAME);
        document.documentElement?.removeAttribute(CSS_DETECTION_ATTR);
      clearHeaderMarks();

      if (midnightTimer) {
        clearTimeout(midnightTimer);
        midnightTimer = null;
      }
    }

    function scheduleMidnightRefresh(app) {
      if (app.id !== "calendar") {
        if (midnightTimer) {
          clearTimeout(midnightTimer);
          midnightTimer = null;
        }
        return;
      }

      if (midnightTimer) {
        clearTimeout(midnightTimer);
      }

      midnightTimer = scheduleNextMidnight(() => {
        apply();
        scheduleMidnightRefresh(app);
      });
    }

    function apply() {
      const pauseRule = guardsApi.getPauseRule(window.location);
      if (!document.body || pauseRule) {
        cleanup(!document.body ? "missing-body" : `paused:${pauseRule.id}`);
        return;
      }

      const app = getHeaderApp(context.options);

      if (!app) {
        cleanup("no-app");
        return;
      }

      if (supportsStaticBrandingCss(app) && (hasStaticBrandingTarget() || hasStaticHomeImageTarget(app))) {
        document.getElementById(OVERLAY_ID)?.remove();
        document.getElementById(STYLE_ID)?.remove();
        clearHeaderMarks();
        document.documentElement?.setAttribute(ATTR_NAME, app.id);
        document.documentElement?.removeAttribute(CSS_DETECTION_ATTR);
        logger.snapshot("static-branding-active", {
          appId: app.id,
          docsBranding: inspectDocsBranding(app),
          homeImageTarget: hasStaticHomeImageTarget(app)
        });
        scheduleMidnightRefresh(app);
        return;
      }

      const config = app.surfaces.header;
      const resolution = resolveHeaderTarget(app);
      const target = resolution.target;
      const overlay = ensureOverlayElement();
      const styleElement = ensureStyleElement();

      if (config.useExtendedDetection) {
        document.documentElement?.setAttribute(CSS_DETECTION_ATTR, "1");
      } else {
        document.documentElement?.removeAttribute(CSS_DETECTION_ATTR);
      }

      document.documentElement?.setAttribute(ATTR_NAME, app.id);
      styleElement.textContent = buildHideCss(app);

      logger.snapshot("resolution", {
        appId: app.id,
        bestScore: resolution.bestScore,
        candidateCount: resolution.candidateCount,
        cssDetection: config.useExtendedDetection,
        docsBranding: resolution.docsBranding,
        missingTargetCount,
        paused: false,
        started,
        strategy: resolution.strategy,
        styleLength: styleElement.textContent.length,
        target: elementSnapshot(target),
        targetRect: rectSnapshot(target?.getBoundingClientRect())
      });

      if (!target) {
        missingTargetCount += 1;
        if (missingTargetCount >= 3) {
          overlay.style.display = "none";
        }
        logger.snapshot("target-missing", {
          appId: app.id,
          missingTargetCount,
          strategy: resolution.strategy
        });
        return;
      }

      const rect = target.getBoundingClientRect();
      if (!rectLooksUsable(rect, config)) {
        missingTargetCount += 1;
        if (missingTargetCount >= 3) {
          overlay.style.display = "none";
        }
        logger.snapshot("target-invalid-rect", {
          appId: app.id,
          missingTargetCount,
          rect: rectSnapshot(rect),
          strategy: resolution.strategy
        });
        return;
      }

      missingTargetCount = 0;

      const singleIcon = looksLikeSingleIcon(app, rect);
      const gmailLockup = app.id === "gmail" && !singleIcon && rect.width > 65;
      const markAttr = gmailLockup ? ORIGINAL_LOCKUP_ATTR : singleIcon ? ORIGINAL_ICON_ATTR : null;

      markOriginal(target, markAttr);

      const rawSize = rect.width <= 58 ? Math.min(rect.width, rect.height) : rect.height * 0.84;
      const size = Math.max(config.sizeMin, Math.min(config.sizeMax, Math.round(rawSize)));
      const coverWidth = singleIcon ? size : Math.max(size, Math.min(42, Math.round(size * 1.12)));
      const baseLeft = Math.round(rect.left);
      const baseTop = Math.round(rect.top + (rect.height - size) / 2);

      logger.snapshot("sizing", {
        appId: app.id,
        configSizeMax: config.sizeMax,
        configSizeMin: config.sizeMin,
        rawSize: Math.round(rawSize),
        resolvedSize: Number.isFinite(size) ? size : null,
        singleIcon
      });

      if (gmailLockup) {
        setOverlayAsGmailLockup(overlay, target, size, app);
        overlay.style.left = `${baseLeft}px`;
        overlay.style.top = `${baseTop}px`;
        overlay.style.backgroundColor = "transparent";
        overlay.style.borderRadius = "0";
      } else {
        const useHeaderCover = Boolean(config.useExtendedDetection);
        const coverPadding = useHeaderCover ? config.coverPadding || 3 : 0;
        const backgroundColor = useHeaderCover || !singleIcon ? nearestBackground(target) : "transparent";
        const iconUrl = runtime.getRuntimeUrl(appsApi.getAssetPath(app));

        setOverlayAsIcon(overlay, iconUrl, size);
        overlay.style.left = `${baseLeft - coverPadding}px`;
        overlay.style.top = `${baseTop - coverPadding}px`;
        overlay.style.width = `${coverWidth + coverPadding * 2}px`;
        overlay.style.height = `${size + coverPadding * 2}px`;
        overlay.style.backgroundSize = `${size}px ${size}px`;
        overlay.style.backgroundColor = backgroundColor;
        overlay.style.borderRadius = useHeaderCover ? "6px" : "0";
      }

      overlay.style.display = "block";
      logger.snapshot("placement", {
        appId: app.id,
        backgroundColor: overlay.style.backgroundColor || null,
        coverWidth,
        gmailLockup,
        overlayRect: {
          height: overlay.style.height,
          left: overlay.style.left,
          top: overlay.style.top,
          width: overlay.style.width
        },
        singleIcon,
        strategy: resolution.strategy,
        target: elementSnapshot(target),
        targetRect: rectSnapshot(rect)
      });
      scheduleMidnightRefresh(app);
    }

    function schedule(delay = 80) {
      if (scheduled) {
        return;
      }

      scheduled = true;
      window.setTimeout(() => {
        scheduled = false;
        apply();
      }, delay);
    }

    function startObserver() {
      if (observer || !document.documentElement) {
        return;
      }

      observer = new MutationObserver((mutations) => {
        const onlyOurOverlay = mutations.every((mutation) => {
          const target = mutation.target;
          return target?.id === OVERLAY_ID || target?.id === STYLE_ID;
        });

        if (!onlyOurOverlay) {
          schedule(160);
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "srcset", "href", "alt", "aria-label", "title", "style", "class"]
      });
    }

    function startSurface() {
      apply();
      if (started) {
        return;
      }

      started = true;
      logger.event("surface-started", { readyState: document.readyState });
      startObserver();
      [200, 500, 1000, 2000, 4000, 7000].forEach((delay) => window.setTimeout(apply, delay));
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startSurface, { once: true });
    } else {
      startSurface();
    }

    window.addEventListener("load", () => schedule(150), { once: true });
    window.addEventListener("resize", () => schedule(50), { passive: true });
    window.addEventListener("popstate", () => schedule(80), { passive: true });
    window.addEventListener("hashchange", () => schedule(80), { passive: true });
    window.addEventListener("focus", () => schedule(100), { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        schedule(100);
      }
    }, { passive: true });
  }

  const api = {
    name: "header",
    start,
    resolveHeaderTarget,
    rectLooksUsable,
    buildHideCss,
    looksLikeSingleIcon,
    supportsStaticBrandingCss
  };

  if (typeof document !== "undefined" && typeof window !== "undefined") {
    const initialApp = appsApi.findPrimaryApp(window.location);
    if (initialApp) {
      if (supportsStaticBrandingCss(initialApp) && (hasStaticBrandingTarget() || hasStaticHomeImageTarget(initialApp))) {
        logger.event("static-branding-detected-early", { appId: initialApp.id, readyState: document.readyState });
      }
    }
  }

  surfaceRegistry.register(api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
