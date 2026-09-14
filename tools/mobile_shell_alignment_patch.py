from pathlib import Path

path = Path('public/css/military-glass-terminal.css')
css = path.read_text()

old_media = '@media (max-width: 767px) {\n  :root {'
new_media = '@media (max-width: 767px), (pointer: coarse) and (max-width: 1024px) and (max-height: 560px) {\n  :root {'
if old_media not in css:
    raise SystemExit('Canonical phone media query not found')
css = css.replace(old_media, new_media, 1)

old_trigger = '''  #mobile-menu-trigger {
    grid-area: menu;
    display: inline-flex;
    width: clamp(92px, 27vw, 116px);
    min-width: clamp(92px, 27vw, 116px);
    height: 44px;
  }'''
new_trigger = '''  #mobile-menu-trigger {
    grid-area: menu;
    display: inline-flex;
    width: clamp(92px, 27vw, 116px);
    min-width: clamp(92px, 27vw, 116px);
    height: 44px;
    visibility: visible;
    pointer-events: auto;
  }'''
if old_trigger not in css:
    raise SystemExit('Mobile menu trigger block not found')
css = css.replace(old_trigger, new_trigger, 1)

old_scrim = '''  body.gate-mobile-drawer-open #gate-mobile-menu-scrim {
    display: block;
  }'''
new_scrim = '''  body.gate-mobile-drawer-open #gate-mobile-menu-scrim {
    display: block;
    visibility: visible;
    pointer-events: auto;
  }'''
if old_scrim not in css:
    raise SystemExit('Mobile scrim open block not found')
css = css.replace(old_scrim, new_scrim, 1)

path.write_text(css)
