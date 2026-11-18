/**
 * Entry point. Registers hooks only; all logic lives in dedicated classes.
 * @module main
 */
import { MODULE_ID } from "./constants.mjs";
import { Logger } from "./logger.mjs";
import { ModuleSettings } from "./settings.mjs";
import { HotkeyConfig } from "./apps/hotkey-config.mjs";
import { HotkeyListener } from "./hotkeys/hotkey-listener.mjs";
import { HotkeyMath } from "./hotkeys/hotkey-math.mjs";

/**
 * Public API, exposed as `game.modules.get("macro-hotkeys-anywhere").api`.
 */
class HotkeyApi {
  /** Pure helpers (combination ids, validation, display). */
  HotkeyMath = HotkeyMath;

  /**
   * Open the hotkey configuration window.
   * @returns {Promise<HotkeyConfig>}
   */
  openConfig() {
    return HotkeyConfig.open();
  }

  /**
   * The hotkeys currently in effect for this user, as `[comboId, {hotkey, source}]` pairs.
   * @returns {Map<string, import("./hotkeys/hotkey-math.mjs").ActiveHotkey>}
   */
  active() {
    return HotkeyListener.active;
  }

  /** @returns {import("./hotkeys/hotkey-math.mjs").Hotkey[]} The current user's own hotkeys. */
  get userHotkeys() {
    return ModuleSettings.userHotkeys;
  }

  /** @returns {import("./hotkeys/hotkey-math.mjs").Hotkey[]} The GM's hotkeys for everyone. */
  get worldHotkeys() {
    return ModuleSettings.worldHotkeys;
  }

  /**
   * Run a macro the way a hotkey does (with `focusedElement` in its scope).
   * @param {string} macroUuid
   * @returns {Promise<unknown>}
   */
  run(macroUuid) {
    return HotkeyListener.run(macroUuid);
  }
}

Hooks.once("init", () => {
  ModuleSettings.register({ menu: HotkeyConfig, onChange: () => HotkeyListener.rebuild() });
  game.modules.get(MODULE_ID).api = new HotkeyApi();
  Logger.info("Initialized.");
});

Hooks.once("ready", () => {
  HotkeyListener.install();
  Logger.info(`Ready (${HotkeyListener.active.size} hotkeys active).`);
});
