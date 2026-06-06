# Make Google Flat Again

A Firefox extension aimed at restoring older, flatter, and more distinguishable Google Workspace icons instead of the new gradient redesign.

## Idea

This project is not a full "theme for all of Google". It is a targeted replacement of visual elements:

- older app icons
- specific sprites and SVG assets
- CSS rules responsible for the new icons

The base approach is local overrides through WebExtension content scripts, without a heavy build setup or unnecessary dependencies.

Chrome compatibility may come later, but the starting point is Firefox.

## Goals

- Firefox-first
- zero-dependency base
- local assets and local logic
- clear structure without a build step at the start
- the ability to fix icons app by app: Drive, Docs, Sheets, Gmail, and so on

## Plan

1. Build a list of Google Workspace surfaces that are actually worth fixing.
2. Document the selectors, sprites, SVGs, and URLs involved in rendering the new icons.
3. Replace them with older versions through local CSS/SVG overrides.
4. Verify that this does not break adjacent flows or different `docs.google.com` products.
5. Package it as a Firefox extension suitable for manual installation.

## Principles

- minimal changes
- a single source of truth for target matching
