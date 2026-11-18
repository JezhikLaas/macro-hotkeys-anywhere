# CLAUDE.md – macro-hotkeys-anywhere

Notes for Claude (and every other human or AI contributor) working on this module.

## What this module does

Foundry VTT module that binds **macros to key combinations that also fire while a text field has
the focus** (inputs, textareas, chat, ProseMirror journal editors, the CodeMirror macro editor).

Foundry's own keybindings (`game.keybindings`) and the hotbar number keys are skipped by the
`KeyboardManager` while an input/textarea/contenteditable element has the focus
(`KeyboardManager#hasFocus`). No existing package solved this when the module was started
(Nov 2026; closest: *Macro Keybinds*, which uses core keybindings).

Requirements (agreed with the maintainer):

- Own configuration window: any number of rows "macro ↔ key combination", keys recorded by pressing them.
- Two lists: **personal hotkeys** per user (user-scoped setting) and **hotkeys for everyone** defined by
  the GM (world setting). A personal hotkey wins over a world hotkey with the same keys.
- Hotkeys fire everywhere, in every text field and outside of them.

## Core architecture decisions

- **One global `keydown` listener on `window` in the capture phase** (`HotkeyListener`). It runs before
  Foundry, ProseMirror and CodeMirror. On a match it calls `preventDefault()` +
  `stopImmediatePropagation()` (no character is typed, no core keybinding runs) and executes the macro.
  It does **not** use `game.keybindings` at all.
- **Hotkeys are stored by `KeyboardEvent#code`** (physical key) plus `ctrl`/`alt`/`shift`, like Foundry's
  own keybindings. `ctrl` also matches the Meta/Command key.
- **Typing must never break:** keys that type or edit (letters, digits, Enter, arrows …) require Ctrl or
  Alt; only F1–F24 may stand alone (`HotkeyMath.validate`). `KeyboardManager.PROTECTED_KEYS` are refused.
- **AltGr is ignored** (`getModifierState("AltGraph")`): Windows reports AltGr as Ctrl+Alt, so a
  `Ctrl+Alt+Q` hotkey would otherwise swallow "@" on German keyboards.
- **Excluded elements** (`EXCLUDED_SELECTOR`): our own key recorder (`data-macro-hotkeys-anywhere-record`)
  and Foundry's controls configuration, so recording keys there still works.
- Macros are executed with `macro.execute({ event, focusedElement })`; a script macro can use
  `focusedElement` (the text field) e.g. to insert text at the cursor. `canExecute` is checked first.
- **Pure logic is separate** (`hotkeys/hotkey-math.mjs`) and has no Foundry globals, so it is unit tested.

### Do not

- Do not route hotkeys through `game.keybindings` (that is exactly what is suppressed in text fields).
- Do not allow bare printable keys; do not relax the AltGr check.
- Do not use jQuery, `Application` (v1), `FormApplication` or `Dialog` (v1).

## Target platform

- Foundry VTT **v14** (`compatibility.minimum` 14, verified 14.370). No dependencies.

## Coding conventions

(Same as `daggerheart-currency` / `fcb-npc-trackers`.)

- Vanilla JavaScript, native ES modules (`.mjs`), no build step, no dependencies.
- Classes for everything with state or behaviour; private `#fields` / `#methods`; `static` for stateless helpers.
- UI only with **ApplicationV2** + `HandlebarsApplicationMixin`; `actions` for clicks, `form.handler` for forms.
- Settings with structured data use a `foundry.abstract.DataModel` as `type`.
- Namespaced Foundry API only (`foundry.applications.*`, `foundry.utils.*`, `foundry.helpers.*`).
- One responsibility per file; filenames `kebab-case.mjs`, classes `PascalCase`.
- All user-facing strings via i18n (`lang/en.json`, `lang/de.json`), keys under
  `MACRO_HOTKEYS_ANYWHERE.*`. Keep both files in sync.
- CSS classes prefixed `macro-hotkeys-anywhere`; constants live in `scripts/constants.mjs`.
- JSDoc on every public class/method. Code, comments and commits in **English**; discussion with the
  maintainer in German.
- Public API: `game.modules.get("macro-hotkeys-anywhere").api`. No other globals.

## Layout

```
module.json                     manifest
package.json                    dev tooling only (npm test)
scripts/
  main.mjs                      entry point: hooks + public API, no logic
  constants.mjs                 module id, setting keys, sources, problems, selectors (pure data)
  logger.mjs                    prefixed console logging
  settings.mjs                  ModuleSettings: registration (incl. menu) + typed getters/setters
  hotkeys/
    hotkey-math.mjs             HotkeyMath: pure combo reading, validation, merge, display
    hotkey-data.mjs             DataModels: HotkeyData, HotkeyCollection
    hotkey-listener.mjs         HotkeyListener: global capture listener, macro execution
  apps/
    hotkey-config.mjs           HotkeyConfig: configuration window (both lists, key recorder)
lang/                           en.json, de.json
styles/                         macro-hotkeys-anywhere.css
templates/                      hotkey-config.hbs
tests/                          node:test unit tests for pure logic
```

### Settings

- `worldHotkeys` (world, `config: false`, `HotkeyCollection`): GM hotkeys for everyone.
- `userHotkeys` (**user** scope, `config: false`, `HotkeyCollection`): the user's own hotkeys; follows the
  user across devices.
- Menu `config` (`restricted: false`, every user may open it). Players see the world list read-only and
  only when it is not empty.
- Both settings call `HotkeyListener.rebuild()` in `onChange`; saving in the window also rebuilds.

## UI conventions

- Key field = button. Click → recording (`data-macro-hotkeys-anywhere-record`, focused). The next non-modifier
  key press is taken; Backspace/Delete clear, Escape or leaving the field cancels **without re-render**
  (so a click on Save that caused the blur is not lost).
- "Add" creates a row and starts recording right away.
- Problems are shown per row; Save refuses while any row has a problem. Rows without key and macro are dropped.
- Conflicts with Foundry keybindings (`game.keybindings.activeKeys`, matched by `HotkeyMath.matchesBinding` like
  v14's `KeyboardManager#testContext`) are shown as a **note only**, never block Save; GM-restricted actions are
  skipped for players.
- Every template part renders exactly one root element (`*__root`).

## Release

- `.github/workflows/release.yaml` (identical to the other modules): tag `vX.Y.Z` → tests, version/URLs
  into `module.json`, GitHub release with `module.json` + `module.zip`. Keep `module.json` URLs empty.
- Update `CHANGELOG.md` with every user-visible change.

## Testing

- Unit tests: `npm test` (Node ≥ 20, built-in `node:test`). Covers `hotkey-math.mjs`.
- The capture listener was checked in Chromium (Playwright) with stubbed Foundry globals: hotkeys fire in
  `input`, `textarea`, `contenteditable` and outside, typed text stays intact, a bubbling window listener
  (stand-in for Foundry) does not see the key, AltGr passes through, the recorder is excluded.
- To verify in a real v14 world (not coverable outside Foundry): user-scoped setting load/save and
  `onChange`, settings menu with an ApplicationV2 class, `selectOptions` with `blank`, ProseMirror journal
  editor and CodeMirror macro editor, the controls-config exclusion selector (`#controls-config`),
  `KeyboardManager.getKeycodeDisplayString`, the keybinding conflict note (incl. module keybindings),
  execution of world hotkeys by players without macro permission.

## Roadmap

1. ~~Scaffold, pure logic + tests, listener, configuration window~~
2. Test in a real v14 world, fix what shows up, release v0.2.0
3. Ideas: "Assign hotkey" entry in the macro directory context menu; show the hotkey in the macro sheet;
   optional per-hotkey switch "only outside text fields".
