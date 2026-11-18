/**
 * Window for editing the hotkeys: the user's own list (everyone) and the list for everyone (GM).
 * @module apps/hotkey-config
 */
import { I18N_PREFIX, LIMITS, MODULE_ID, PROBLEMS, RECORD_ATTRIBUTE, SOURCES, TEMPLATES } from "../constants.mjs";
import { Logger } from "../logger.mjs";
import { ModuleSettings } from "../settings.mjs";
import { HotkeyListener } from "../hotkeys/hotkey-listener.mjs";
import { HotkeyMath } from "../hotkeys/hotkey-math.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * @typedef {import("../hotkeys/hotkey-math.mjs").Hotkey} Hotkey
 */

export class HotkeyConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** The one open window, if any. @type {HotkeyConfig|null} */
  static #instance = null;

  /**
   * Working copy of both lists. Persisted by Save only.
   * @type {{world: Hotkey[], user: Hotkey[]}}
   */
  #draft = {
    world: ModuleSettings.worldHotkeys.map(HotkeyMath.normalize),
    user: ModuleSettings.userHotkeys.map(HotkeyMath.normalize)
  };

  /** The row currently recording a key combination. @type {{source: string, id: string}|null} */
  #recording = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: [MODULE_ID],
    window: {
      icon: "fa-solid fa-keyboard",
      title: `${I18N_PREFIX}.Config.title`,
      contentClasses: ["standard-form"],
      resizable: true
    },
    position: { width: 640, height: "auto" },
    form: {
      handler: HotkeyConfig.#onForm,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      add: HotkeyConfig.#onAdd,
      remove: HotkeyConfig.#onRemove,
      record: HotkeyConfig.#onRecord,
      clearKey: HotkeyConfig.#onClearKey,
      cancel: HotkeyConfig.#onCancel
    }
  };

  /** @override */
  static PARTS = {
    form: { template: TEMPLATES.CONFIG, scrollable: [".macro-hotkeys-anywhere__lists"] }
  };

  /**
   * Open the window (or bring the open one to the front).
   * @returns {Promise<HotkeyConfig>}
   */
  static async open() {
    const app = HotkeyConfig.#instance ?? new HotkeyConfig();
    HotkeyConfig.#instance = app;
    await app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isGM = game.user.isGM;
    const userCombos = new Set(this.#draft.user.map(h => HotkeyMath.comboId(h)).filter(Boolean));
    const worldCombos = new Set(this.#draft.world.map(h => HotkeyMath.comboId(h)).filter(Boolean));

    const sections = [
      this.#section(SOURCES.USER, true, { other: worldCombos, note: "overridesWorld" }),
      this.#section(SOURCES.WORLD, isGM, { other: userCombos, note: "overriddenByUser" })
    ].filter(section => section.editable || section.rows.length);

    return Object.assign(context, { sections, maxHotkeys: LIMITS.MAX_HOTKEYS });
  }

  /**
   * Template data of one list.
   * @param {string} source    One of SOURCES.
   * @param {boolean} editable
   * @param {{other: Set<string>, note: string}} overlap  Combinations of the other list and the note shown for them.
   * @returns {object}
   */
  #section(source, editable, { other, note }) {
    const hotkeys = this.#draft[source];
    const duplicates = HotkeyMath.duplicates(hotkeys);
    const macroChoices = HotkeyConfig.#macroChoices(source, hotkeys);
    const protectedKeys = HotkeyListener.protectedKeys;
    const rows = hotkeys.map((hotkey, index) => {
      const problem = duplicates.has(hotkey.id)
        ? PROBLEMS.DUPLICATE
        : HotkeyMath.validate(hotkey, { protectedKeys });
      const recording = this.#recording?.source === source && this.#recording.id === hotkey.id;
      const combo = HotkeyMath.comboId(hotkey);
      const idleLabel = HotkeyConfig.formatCombo(hotkey) || game.i18n.localize(`${I18N_PREFIX}.Config.noKey`);
      return {
        ...hotkey,
        index,
        recording,
        idleLabel,
        keyLabel: recording ? game.i18n.localize(`${I18N_PREFIX}.Config.pressKeys`) : idleLabel,
        macroLabel: macroChoices.find(c => c.value === hotkey.macroUuid)?.label ?? "",
        // An empty new row is not an error yet; it is dropped on save.
        problem: problem && (hotkey.key || hotkey.macroUuid) ? game.i18n.localize(`${I18N_PREFIX}.Problems.${problem}`) : "",
        note: !problem && combo && other.has(combo) ? game.i18n.localize(`${I18N_PREFIX}.Config.${note}`) : "",
        conflict: problem ? "" : HotkeyConfig.#conflictNote(hotkey)
      };
    });
    return {
      source,
      editable,
      title: game.i18n.localize(`${I18N_PREFIX}.Config.${source}.title`),
      hint: game.i18n.localize(`${I18N_PREFIX}.Config.${source}.hint`),
      macroChoices,
      rows,
      cannotAdd: hotkeys.length >= LIMITS.MAX_HOTKEYS,
      recordAttribute: RECORD_ATTRIBUTE
    };
  }

  /**
   * Note naming the Foundry keybindings (Configure Controls) a hotkey takes over, if any. Not an
   * error: overriding can be intended, and in text fields those keybindings do not run anyway.
   * Actions restricted to the GM are skipped for players, since they never run for them.
   * @param {Hotkey} hotkey
   * @returns {string}
   */
  static #conflictNote(hotkey) {
    const candidates = (game.keybindings?.activeKeys?.get(hotkey.key) ?? [])
      .filter(binding => !binding.restricted || game.user.isGM);
    const names = HotkeyMath.conflictingBindings(hotkey, candidates)
      .map(binding => game.i18n.localize(binding.name ?? binding.action));
    if (!names.length) return "";
    return game.i18n.format(`${I18N_PREFIX}.Config.overridesKeybinding`, { actions: [...new Set(names)].join(", ") });
  }

  /**
   * Macros offered for a list, sorted by name: all world macros for the GM's list, the macros the
   * user may execute for their own list. A stored macro that is not offered stays selectable.
   * @param {string} source
   * @param {Hotkey[]} hotkeys
   * @returns {{value: string, label: string}[]}
   */
  static #macroChoices(source, hotkeys) {
    const macros = game.macros.contents.filter(m => source === SOURCES.WORLD || m.canExecute);
    const choices = macros
      .map(m => ({ value: m.uuid, label: m.name }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    for (const { macroUuid } of hotkeys) {
      if (!macroUuid || choices.some(c => c.value === macroUuid)) continue;
      const known = fromUuidSync(macroUuid, { strict: false });
      choices.push({
        value: macroUuid,
        label: known?.name ?? game.i18n.format(`${I18N_PREFIX}.Config.missingMacro`, { uuid: macroUuid })
      });
    }
    return choices;
  }

  /**
   * Display string of a key combination with localized modifiers, e.g. "Strg + Umschalt + R".
   * @param {import("../hotkeys/hotkey-math.mjs").Combo} combo
   * @returns {string}
   */
  static formatCombo(combo) {
    const KeyboardManager = foundry.helpers?.interaction?.KeyboardManager;
    const key = code => {
      try {
        return KeyboardManager?.getKeycodeDisplayString?.(code) || HotkeyMath.keyLabel(code);
      } catch {
        return HotkeyMath.keyLabel(code);
      }
    };
    return HotkeyMath.format(combo, {
      ctrl: game.i18n.localize(`${I18N_PREFIX}.Keys.ctrl`),
      alt: game.i18n.localize(`${I18N_PREFIX}.Keys.alt`),
      shift: game.i18n.localize(`${I18N_PREFIX}.Keys.shift`),
      key
    });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const recorder = this.element.querySelector(`[data-${RECORD_ATTRIBUTE}]`);
    if (!recorder) return;
    recorder.addEventListener("keydown", event => this.#onRecordKey(event, recorder));
    // Leaving the field (click elsewhere, Escape) cancels without re-rendering, so the click that
    // caused the blur (e.g. on Save) still reaches its button.
    recorder.addEventListener("blur", () => this.#cancelRecording(recorder));
    recorder.focus();
  }

  /**
   * Key press while a row is recording: take the combination, or clear/cancel.
   * @param {KeyboardEvent} event
   * @param {HTMLElement} recorder
   */
  #onRecordKey(event, recorder) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.#recording) return;
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    if (plain && event.code === "Escape") return recorder.blur();
    if (plain && (event.code === "Backspace" || event.code === "Delete")) {
      this.#setCombo(this.#recording, { key: "", ctrl: false, alt: false, shift: false });
    } else {
      const combo = HotkeyMath.fromEvent(event);
      if (!combo) return; // A modifier alone: wait for the actual key.
      this.#setCombo(this.#recording, combo);
    }
    this.#recording = null;
    this.render();
  }

  /**
   * Stop recording and restore the field's previous label.
   * @param {HTMLElement} recorder
   */
  #cancelRecording(recorder) {
    if (!this.#recording) return;
    this.#recording = null;
    recorder.removeAttribute(`data-${RECORD_ATTRIBUTE}`);
    recorder.textContent = recorder.dataset.label ?? "";
  }

  /**
   * @param {{source: string, id: string}} ref
   * @param {import("../hotkeys/hotkey-math.mjs").Combo} combo
   */
  #setCombo({ source, id }, { key, ctrl, alt, shift }) {
    const hotkey = this.#draft[source].find(h => h.id === id);
    if (hotkey) Object.assign(hotkey, { key, ctrl, alt, shift });
  }

  /**
   * Find the row a button belongs to.
   * @param {HTMLElement} target  Element inside a row carrying `data-source` and `data-id`.
   * @returns {{source: string, id: string}|null}  Null for rows the user may not edit.
   */
  #rowRef(target) {
    const row = target.closest("[data-source][data-id]");
    const source = row?.dataset.source;
    if (!(source in this.#draft) || !this.#isEditable(source)) return null;
    return { source, id: row.dataset.id };
  }

  /**
   * @param {string} source
   * @returns {boolean}
   */
  #isEditable(source) {
    return source === SOURCES.USER || game.user.isGM;
  }

  /**
   * Keep the macro choices in the draft; save on submit (Save button or Enter).
   * @this {HotkeyConfig}
   * @param {SubmitEvent|Event} event
   * @param {HTMLFormElement} _form
   * @param {foundry.applications.ux.FormDataExtended} formData
   */
  static async #onForm(event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    for (const source of Object.values(SOURCES)) {
      if (!this.#isEditable(source)) continue;
      for (const [id, row] of Object.entries(data[source] ?? {})) {
        const hotkey = this.#draft[source].find(h => h.id === id);
        if (hotkey && typeof row.macroUuid === "string") hotkey.macroUuid = row.macroUuid;
      }
    }
    if (event.type === "submit") await this.#save();
    else this.render();
  }

  /**
   * @this {HotkeyConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target  Button carrying `data-source`.
   */
  static #onAdd(_event, target) {
    const source = target.dataset.source;
    if (!(source in this.#draft) || !this.#isEditable(source)) return;
    const list = this.#draft[source];
    if (list.length >= LIMITS.MAX_HOTKEYS) return;
    const hotkey = HotkeyMath.normalize({ id: foundry.utils.randomID() });
    list.push(hotkey);
    this.#recording = { source, id: hotkey.id };
    this.render();
  }

  /**
   * @this {HotkeyConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onRemove(_event, target) {
    const ref = this.#rowRef(target);
    if (!ref) return;
    this.#draft[ref.source] = this.#draft[ref.source].filter(h => h.id !== ref.id);
    if (this.#recording?.id === ref.id) this.#recording = null;
    this.render();
  }

  /**
   * @this {HotkeyConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onRecord(_event, target) {
    const ref = this.#rowRef(target);
    if (!ref) return;
    this.#recording = ref;
    this.render();
  }

  /**
   * @this {HotkeyConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onClearKey(_event, target) {
    const ref = this.#rowRef(target);
    if (!ref) return;
    this.#setCombo(ref, { key: "", ctrl: false, alt: false, shift: false });
    this.render();
  }

  /** @this {HotkeyConfig} */
  static #onCancel() {
    this.close();
  }

  /** @override */
  _onClose(options) {
    if (HotkeyConfig.#instance === this) HotkeyConfig.#instance = null;
    super._onClose(options);
  }

  /**
   * Validate the editable lists, write them and close. Rows without key and macro are dropped;
   * any other problem keeps the window open with a warning.
   */
  async #save() {
    const protectedKeys = HotkeyListener.protectedKeys;
    const lists = {};
    for (const source of Object.values(SOURCES)) {
      if (!this.#isEditable(source)) continue;
      const list = this.#draft[source].filter(h => h.key || h.macroUuid);
      const invalid = HotkeyMath.duplicates(list).size || list.some(h => HotkeyMath.validate(h, { protectedKeys }));
      if (invalid) {
        ui.notifications.warn(`${I18N_PREFIX}.Config.fixProblems`, { localize: true });
        return this.render();
      }
      lists[source] = list;
    }

    try {
      if (lists[SOURCES.USER]) await ModuleSettings.setUserHotkeys(lists[SOURCES.USER]);
      if (lists[SOURCES.WORLD]) await ModuleSettings.setWorldHotkeys(lists[SOURCES.WORLD]);
    } catch (err) {
      Logger.error("Saving hotkeys failed.", err);
      ui.notifications.error(err.message, { console: false });
      return undefined;
    }
    HotkeyListener.rebuild();
    ui.notifications.info(`${I18N_PREFIX}.Config.saved`, { localize: true });
    return this.close();
  }
}
