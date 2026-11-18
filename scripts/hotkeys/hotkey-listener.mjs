/**
 * The global key listener that runs macros, also while a text field has the focus.
 *
 * Foundry's own keybindings (and the hotbar number keys) are skipped by the KeyboardManager while
 * an input, textarea or contenteditable element has the focus. This listener sits on `window` in
 * the capture phase, so it sees every key press before Foundry, ProseMirror or CodeMirror do. When
 * a press matches a hotkey, it stops the event (no character is typed, no core keybinding runs)
 * and executes the macro.
 * @module hotkeys/hotkey-listener
 */
import { EXCLUDED_SELECTOR, I18N_PREFIX } from "../constants.mjs";
import { Logger } from "../logger.mjs";
import { ModuleSettings } from "../settings.mjs";
import { HotkeyMath } from "./hotkey-math.mjs";

export class HotkeyListener {
  /** Hotkeys in effect, by combination id. @type {Map<string, import("./hotkey-math.mjs").ActiveHotkey>} */
  static #active = new Map();

  /** Whether the listener is attached. */
  static #installed = false;

  /**
   * Attach the listener and read the hotkeys. Call once from `ready`.
   */
  static install() {
    if (HotkeyListener.#installed) return;
    window.addEventListener("keydown", HotkeyListener.#onKeyDown, { capture: true });
    HotkeyListener.#installed = true;
    HotkeyListener.rebuild();
  }

  /**
   * Re-read both hotkey lists. Called on `ready` and whenever a list changed.
   */
  static rebuild() {
    if (!game.ready) return;
    HotkeyListener.#active = HotkeyMath.merge(ModuleSettings.worldHotkeys, ModuleSettings.userHotkeys, {
      protectedKeys: HotkeyListener.protectedKeys
    });
    Logger.debug(`${HotkeyListener.#active.size} hotkeys active.`, [...HotkeyListener.#active.keys()]);
  }

  /** @returns {Map<string, import("./hotkey-math.mjs").ActiveHotkey>} The hotkeys in effect (a copy). */
  static get active() {
    return new Map(HotkeyListener.#active);
  }

  /** @returns {string[]} Key codes Foundry reserves for the browser (never bindable). */
  static get protectedKeys() {
    return foundry.helpers?.interaction?.KeyboardManager?.PROTECTED_KEYS ?? [];
  }

  /**
   * @param {KeyboardEvent} event
   */
  static #onKeyDown(event) {
    if (!HotkeyListener.#active.size) return;
    const target = event.target;
    if (target instanceof Element && target.closest(EXCLUDED_SELECTOR)) return;
    const combo = HotkeyMath.fromEvent(event);
    if (!combo) return;
    const entry = HotkeyListener.#active.get(HotkeyMath.comboId(combo));
    if (!entry) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    // Holding the keys down must not run the macro again and again.
    if (event.repeat) return;
    HotkeyListener.run(entry.hotkey.macroUuid, event);
  }

  /**
   * Execute a macro the way a hotkey does. The macro's script gets `event` (the key press) and
   * `focusedElement` (the element that had the focus, e.g. the text field) as variables.
   * @param {string} macroUuid
   * @param {KeyboardEvent} [event]
   * @returns {Promise<unknown>}  The macro's return value; undefined when it did not run.
   */
  static async run(macroUuid, event) {
    const focusedElement = document.activeElement;
    let macro = fromUuidSync(macroUuid, { strict: false });
    if (macro?.documentName !== "Macro") macro = await fromUuid(macroUuid).catch(() => null);
    if (macro?.documentName !== "Macro") {
      ui.notifications.warn(game.i18n.format(`${I18N_PREFIX}.Errors.macroMissing`, { uuid: macroUuid }));
      return undefined;
    }
    if (!macro.canExecute) {
      ui.notifications.warn(game.i18n.format(`${I18N_PREFIX}.Errors.noPermission`, { name: macro.name }));
      return undefined;
    }
    try {
      return await macro.execute({ event, focusedElement });
    } catch (err) {
      Logger.error(`Macro "${macro.name}" failed.`, err);
      ui.notifications.error(game.i18n.format(`${I18N_PREFIX}.Errors.macroFailed`, { name: macro.name }));
      return undefined;
    }
  }
}
