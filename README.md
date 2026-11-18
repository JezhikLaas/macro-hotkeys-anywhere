# Macro Hotkeys Anywhere

A Foundry VTT module that binds **macros to key combinations that also work while you are typing** –
in the chat, in text fields of sheets, in journal editors and in the macro editor.

Foundry's own keybindings and the hotbar number keys are switched off as soon as a text field has the
focus. That is sensible for single keys, but it also blocks combinations such as `Ctrl+Shift+R` that
never type anything. This module listens for its hotkeys before Foundry does, so they work everywhere.

> **Status:** 0.1. Requires Foundry VTT v14.

## Installation

In Foundry's setup screen: **Add-on Modules → Install Module**, paste the manifest URL of the latest
release into the field at the bottom and click **Install**. Then enable **Macro Hotkeys Anywhere** in
your world.

## AI Info
This module has been developed with the help of Claude.

## Using it

**Game Settings → Configure Settings → Macro Hotkeys Anywhere → Configure hotkeys.**

- **My hotkeys**: only for you, available to every user. They win over a hotkey for everyone that uses
  the same keys.
- **Hotkeys for everyone**: set by the GM, active for all users who may execute the macro. Players see
  this list read-only.

Click **Add hotkey**, press the key combination, choose the macro, **Save**. Click a key field again to
record a new combination; Backspace clears it, Escape cancels.

### Rules for key combinations

- Letters, digits and other typing keys need **Ctrl** or **Alt** (Shift alone is not enough), otherwise
  you could no longer type them. Only **F1–F24** work without a modifier.
- Keys reserved for the browser (e.g. F5) cannot be bound.
- **AltGr** combinations are ignored, so characters such as `@`, `€` or `{` on German keyboards keep
  working. Avoid `Ctrl+Alt` combinations on keys that produce such characters anyway.
- A hotkey replaces whatever the key combination would otherwise do in Foundry or the browser.
- On macOS, **Cmd** counts as Ctrl.

### Inside the macro

Script macros started by a hotkey receive two extra variables:

- `event` – the key press,
- `focusedElement` – the element that had the focus (e.g. the text field), or `body`.

Example: insert the current in-world time at the cursor of the focused text field.

```js
const el = focusedElement;
if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
  el.setRangeText(`[${game.time.worldTime}] `, el.selectionStart, el.selectionEnd, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
```

## API

`game.modules.get("macro-hotkeys-anywhere").api`:

- `openConfig()` – open the configuration window,
- `active()` – the hotkeys currently in effect for this user,
- `userHotkeys`, `worldHotkeys` – the stored lists,
- `run(macroUuid)` – run a macro the way a hotkey does.

## License

MIT
