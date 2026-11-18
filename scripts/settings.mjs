/**
 * Registration of and typed access to this module's settings.
 * @module settings
 */
import { I18N_PREFIX, MODULE_ID, SETTINGS } from "./constants.mjs";
import { HotkeyCollection } from "./hotkeys/hotkey-data.mjs";

export class ModuleSettings {
  /**
   * Register all settings and the configuration menu. Call during the `init` hook.
   * @param {object} options
   * @param {typeof foundry.applications.api.ApplicationV2} options.menu  Window opened by the menu.
   * @param {() => void} options.onChange  Called whenever one of the hotkey lists changed.
   */
  static register({ menu, onChange }) {
    game.settings.register(MODULE_ID, SETTINGS.WORLD_HOTKEYS, {
      scope: "world",
      config: false,
      type: HotkeyCollection,
      default: { hotkeys: [] },
      onChange
    });

    game.settings.register(MODULE_ID, SETTINGS.USER_HOTKEYS, {
      scope: "user",
      config: false,
      type: HotkeyCollection,
      default: { hotkeys: [] },
      onChange
    });

    game.settings.registerMenu(MODULE_ID, SETTINGS.CONFIG_MENU, {
      name: `${I18N_PREFIX}.Settings.menu.name`,
      label: `${I18N_PREFIX}.Settings.menu.label`,
      hint: `${I18N_PREFIX}.Settings.menu.hint`,
      icon: "fa-solid fa-keyboard",
      type: menu,
      restricted: false
    });
  }

  /** @returns {import("./hotkeys/hotkey-math.mjs").Hotkey[]} The GM's hotkeys for everyone (a copy). */
  static get worldHotkeys() {
    return game.settings.get(MODULE_ID, SETTINGS.WORLD_HOTKEYS).toObject().hotkeys;
  }

  /**
   * Replace the world hotkeys (GM only).
   * @param {import("./hotkeys/hotkey-math.mjs").Hotkey[]} hotkeys
   * @returns {Promise<HotkeyCollection>}
   */
  static async setWorldHotkeys(hotkeys) {
    return game.settings.set(MODULE_ID, SETTINGS.WORLD_HOTKEYS, { hotkeys });
  }

  /** @returns {import("./hotkeys/hotkey-math.mjs").Hotkey[]} The current user's own hotkeys (a copy). */
  static get userHotkeys() {
    return game.settings.get(MODULE_ID, SETTINGS.USER_HOTKEYS).toObject().hotkeys;
  }

  /**
   * Replace the current user's hotkeys.
   * @param {import("./hotkeys/hotkey-math.mjs").Hotkey[]} hotkeys
   * @returns {Promise<HotkeyCollection>}
   */
  static async setUserHotkeys(hotkeys) {
    return game.settings.set(MODULE_ID, SETTINGS.USER_HOTKEYS, { hotkeys });
  }
}
