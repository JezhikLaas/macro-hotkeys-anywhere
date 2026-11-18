# Changelog

## Unreleased

- **Macro hotkeys that work while typing**: a global key listener (capture phase) runs macros for configured
  key combinations in text fields, chat, journal editors, the macro editor and everywhere else.
- **Configuration window** (Game Settings → Macro Hotkeys Anywhere): personal hotkeys for every user and hotkeys
  for everyone set by the GM; personal hotkeys win on equal keys. Keys are recorded by pressing them.
- Safety rules: typing keys need Ctrl or Alt (only F1–F24 alone), browser-reserved keys are refused, AltGr is
  ignored so characters like `@` keep working, duplicates within a list are reported.
- Script macros receive `event` and `focusedElement`.
- Macro API: `openConfig()`, `active()`, `userHotkeys`, `worldHotkeys`, `run(macroUuid)`.
- Project scaffold: manifest (Foundry v14), CI release workflow, English and German localization, unit tests.
