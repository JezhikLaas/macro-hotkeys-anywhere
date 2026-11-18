/**
 * DataModels of the hotkey settings. They validate and clean stored values.
 * @module hotkeys/hotkey-data
 */
import { LIMITS } from "../constants.mjs";

const { DataModel } = foundry.abstract;
const fields = foundry.data.fields;

/**
 * One hotkey: a key combination and the macro it runs.
 */
export class HotkeyData extends DataModel {
  /** @override */
  static defineSchema() {
    return {
      id: new fields.StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
      macroUuid: new fields.StringField({ required: true, blank: true, initial: "" }),
      key: new fields.StringField({ required: true, blank: true, initial: "" }),
      ctrl: new fields.BooleanField({ required: true, initial: false }),
      alt: new fields.BooleanField({ required: true, initial: false }),
      shift: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

/**
 * Value of the world and user hotkey settings: one list of hotkeys.
 */
export class HotkeyCollection extends DataModel {
  /** @override */
  static defineSchema() {
    return {
      hotkeys: new fields.ArrayField(new fields.EmbeddedDataField(HotkeyData), { required: true, initial: [] })
    };
  }

  /**
   * Cap the list length.
   * @override
   */
  static cleanData(source = {}, options = {}) {
    const cleaned = super.cleanData(source, options);
    if (Array.isArray(cleaned.hotkeys)) cleaned.hotkeys = cleaned.hotkeys.slice(0, LIMITS.MAX_HOTKEYS);
    return cleaned;
  }
}
