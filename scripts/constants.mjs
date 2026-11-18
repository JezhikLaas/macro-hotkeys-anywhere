/**
 * Central constants for the module. Import from here instead of repeating literals.
 * Pure data only: no Foundry globals, so it can be imported by unit tests.
 * @module constants
 */

/** Module id as declared in module.json. */
export const MODULE_ID = "macro-hotkeys-anywhere";

/** Prefix for i18n keys. */
export const I18N_PREFIX = "MACRO_HOTKEYS_ANYWHERE";

/** Hard limits of the data model. */
export const LIMITS = Object.freeze({
  /** Maximum number of hotkeys per list (world or user). */
  MAX_HOTKEYS: 100
});

/** Keys of this module's settings. */
export const SETTINGS = Object.freeze({
  /** World setting: hotkeys the GM defines for everyone (HotkeyCollection). */
  WORLD_HOTKEYS: "worldHotkeys",
  /** User setting: the current user's own hotkeys (HotkeyCollection). They win over world hotkeys. */
  USER_HOTKEYS: "userHotkeys",
  /** Settings menu that opens the configuration window. */
  CONFIG_MENU: "config"
});

/** The two hotkey lists. */
export const SOURCES = Object.freeze({
  /** Defined by the GM, applies to every user. */
  WORLD: "world",
  /** Defined by the user, applies to that user only. */
  USER: "user"
});

/**
 * Data attribute (without `data-`) of elements that record a key combination. The global
 * listener never fires a macro for a key pressed in such an element.
 */
export const RECORD_ATTRIBUTE = `${MODULE_ID}-record`;

/**
 * Elements in which the global listener stays out of the way: our own recorder and Foundry's
 * controls configuration (it records key presses for core keybindings).
 */
export const EXCLUDED_SELECTOR = `[data-${RECORD_ATTRIBUTE}], #controls-config, .controls-config`;

/** Validation results of a hotkey (see HotkeyMath.validate). */
export const PROBLEMS = Object.freeze({
  NO_MACRO: "noMacro",
  NO_KEY: "noKey",
  NEEDS_MODIFIER: "needsModifier",
  PROTECTED: "protected",
  DUPLICATE: "duplicate"
});

/** Template paths. */
export const TEMPLATES = Object.freeze({
  CONFIG: `modules/${MODULE_ID}/templates/hotkey-config.hbs`
});
