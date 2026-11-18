/**
 * Pure hotkey logic: reading key combinations from keyboard events, validation, merging of the
 * world and user lists, display. No Foundry globals, so it is unit tested with `npm test`.
 * @module hotkeys/hotkey-math
 */
import { PROBLEMS, SOURCES } from "../constants.mjs";

/**
 * A key combination. `key` is a `KeyboardEvent#code` (physical key, e.g. "KeyR", "F2").
 * `ctrl` also stands for the Command key on macOS, as in Foundry's own keybindings.
 * @typedef {object} Combo
 * @property {string} key
 * @property {boolean} ctrl
 * @property {boolean} alt
 * @property {boolean} shift
 */

/**
 * One stored hotkey.
 * @typedef {Combo & {id: string, macroUuid: string}} Hotkey
 */

/**
 * The hotkey that applies to a combination, and the list it comes from.
 * @typedef {object} ActiveHotkey
 * @property {Hotkey} hotkey
 * @property {string} source  One of SOURCES.
 */

/**
 * The parts of a keyboard event this module looks at (a real `KeyboardEvent` fits).
 * @typedef {object} KeyEventLike
 * @property {string} code
 * @property {boolean} [ctrlKey]
 * @property {boolean} [metaKey]
 * @property {boolean} [altKey]
 * @property {boolean} [shiftKey]
 * @property {boolean} [isComposing]
 * @property {(key: string) => boolean} [getModifierState]
 */

export class HotkeyMath {
  /** Codes of keys that only modify others; they never form a hotkey on their own. */
  static MODIFIER_CODES = Object.freeze(new Set([
    "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight",
    "MetaLeft", "MetaRight", "OSLeft", "OSRight", "AltGraph", "CapsLock", "NumLock", "Fn", "FnLock"
  ]));

  /** Function keys F1–F24: the only keys allowed without Ctrl or Alt. */
  static FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/;

  /**
   * Read the combination of a key press.
   * Returns null for presses that must never trigger a hotkey: modifier keys alone, IME
   * composition, and AltGr (on Windows AltGr reports Ctrl+Alt, so `Ctrl+Alt+Q` would otherwise
   * swallow the "@" on German keyboards).
   * @param {KeyEventLike} event
   * @returns {Combo|null}
   */
  static fromEvent(event) {
    if (!event?.code || event.isComposing) return null;
    if (HotkeyMath.MODIFIER_CODES.has(event.code)) return null;
    if (event.getModifierState?.("AltGraph")) return null;
    return {
      key: event.code,
      ctrl: Boolean(event.ctrlKey || event.metaKey),
      alt: Boolean(event.altKey),
      shift: Boolean(event.shiftKey)
    };
  }

  /**
   * Canonical id of a combination, e.g. "Control+Shift+KeyR". Equal combinations have equal ids.
   * @param {Combo} combo
   * @returns {string}  Empty when there is no key.
   */
  static comboId(combo) {
    if (!combo?.key) return "";
    const parts = [];
    if (combo.ctrl) parts.push("Control");
    if (combo.alt) parts.push("Alt");
    if (combo.shift) parts.push("Shift");
    parts.push(combo.key);
    return parts.join("+");
  }

  /**
   * Bring raw data (from settings, forms or the API) into the shape of a hotkey.
   * @param {Partial<Hotkey>} raw
   * @returns {Hotkey}
   */
  static normalize(raw = {}) {
    return {
      id: typeof raw.id === "string" ? raw.id : "",
      macroUuid: typeof raw.macroUuid === "string" ? raw.macroUuid.trim() : "",
      key: typeof raw.key === "string" ? raw.key.trim() : "",
      ctrl: Boolean(raw.ctrl),
      alt: Boolean(raw.alt),
      shift: Boolean(raw.shift)
    };
  }

  /**
   * Check one hotkey on its own. Keys that type something or edit text (letters, digits, Enter,
   * arrows …) need Ctrl or Alt, otherwise the hotkey would break normal typing; only F1–F24 may
   * stand alone. Protected keys (browser actions such as F5) are refused in any combination.
   * @param {Hotkey} hotkey
   * @param {object} [options]
   * @param {Iterable<string>} [options.protectedKeys]  Codes that must not be bound.
   * @returns {string|null}  One of PROBLEMS, or null when the hotkey is fine.
   */
  static validate(hotkey, { protectedKeys = [] } = {}) {
    if (!hotkey.key) return PROBLEMS.NO_KEY;
    if (!hotkey.macroUuid) return PROBLEMS.NO_MACRO;
    if (new Set(protectedKeys).has(hotkey.key)) return PROBLEMS.PROTECTED;
    if (!hotkey.ctrl && !hotkey.alt && !HotkeyMath.FUNCTION_KEY.test(hotkey.key)) return PROBLEMS.NEEDS_MODIFIER;
    return null;
  }

  /**
   * Our modifier flags and the names Foundry's keybindings use for them
   * (`KeyboardManager.MODIFIER_KEYS`).
   */
  static MODIFIER_NAMES = Object.freeze({ ctrl: "Control", alt: "Alt", shift: "Shift" });

  /**
   * Whether a key press with this combination would trigger a Foundry keybinding. Mirrors the
   * key-down check of `KeyboardManager#testContext` (v14): every required modifier must be pressed,
   * any other pressed modifier must be one of the action's optional (reserved) modifiers.
   * @param {Combo} combo
   * @param {object} binding  An entry of `game.keybindings.activeKeys`.
   * @param {string} binding.key
   * @param {string[]} [binding.requiredModifiers]
   * @param {string[]} [binding.optionalModifiers]
   * @returns {boolean}
   */
  static matchesBinding(combo, { key, requiredModifiers = [], optionalModifiers = [] } = {}) {
    if (!combo?.key || combo.key !== key) return false;
    for (const [flag, name] of Object.entries(HotkeyMath.MODIFIER_NAMES)) {
      if (requiredModifiers.includes(name)) {
        if (!combo[flag]) return false;
      } else if (combo[flag] && !optionalModifiers.includes(name)) return false;
    }
    return true;
  }

  /**
   * The keybindings a combination would take away from Foundry (our listener runs first and stops
   * the event).
   * @template {{key: string, requiredModifiers?: string[], optionalModifiers?: string[]}} B
   * @param {Combo} combo
   * @param {Iterable<B>} bindings
   * @returns {B[]}
   */
  static conflictingBindings(combo, bindings) {
    return [...(bindings ?? [])].filter(binding => HotkeyMath.matchesBinding(combo, binding));
  }

  /**
   * Ids of hotkeys whose combination occurs more than once in the same list.
   * @param {Hotkey[]} hotkeys
   * @returns {Set<string>}
   */
  static duplicates(hotkeys) {
    const byCombo = new Map();
    for (const hotkey of hotkeys) {
      const combo = HotkeyMath.comboId(hotkey);
      if (!combo) continue;
      byCombo.set(combo, [...(byCombo.get(combo) ?? []), hotkey.id]);
    }
    return new Set([...byCombo.values()].filter(ids => ids.length > 1).flat());
  }

  /**
   * The hotkeys that are in effect, by combination id. Invalid hotkeys are skipped. A user hotkey
   * replaces a world hotkey with the same combination; within a list the first one wins.
   * @param {Hotkey[]} worldHotkeys
   * @param {Hotkey[]} userHotkeys
   * @param {object} [options]  Passed on to {@link HotkeyMath.validate}.
   * @returns {Map<string, ActiveHotkey>}
   */
  static merge(worldHotkeys, userHotkeys, options) {
    const active = new Map();
    for (const [source, list] of [[SOURCES.USER, userHotkeys], [SOURCES.WORLD, worldHotkeys]]) {
      for (const raw of list ?? []) {
        const hotkey = HotkeyMath.normalize(raw);
        if (HotkeyMath.validate(hotkey, options)) continue;
        const combo = HotkeyMath.comboId(hotkey);
        if (!active.has(combo)) active.set(combo, { hotkey, source });
      }
    }
    return active;
  }

  /**
   * Short display label of a key code when nothing better is available:
   * "KeyR" → "R", "Digit1" → "1", "Numpad1" → "Num 1", anything else unchanged.
   * @param {string} code
   * @returns {string}
   */
  static keyLabel(code) {
    if (!code) return "";
    const match = /^(?:Key|Digit)(.)$/.exec(code);
    if (match) return match[1];
    if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
    return code;
  }

  /**
   * Display string of a combination, e.g. "Ctrl + Shift + R".
   * @param {Combo} combo
   * @param {object} [labels]
   * @param {string} [labels.ctrl]
   * @param {string} [labels.alt]
   * @param {string} [labels.shift]
   * @param {(code: string) => string} [labels.key]  Display of the key itself.
   * @returns {string}  Empty when there is no key.
   */
  static format(combo, { ctrl = "Ctrl", alt = "Alt", shift = "Shift", key = HotkeyMath.keyLabel } = {}) {
    if (!combo?.key) return "";
    const parts = [];
    if (combo.ctrl) parts.push(ctrl);
    if (combo.alt) parts.push(alt);
    if (combo.shift) parts.push(shift);
    parts.push(key(combo.key));
    return parts.join(" + ");
  }
}
