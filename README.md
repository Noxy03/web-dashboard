# My Dashboard New Tab – Chrome Extension

Ein personalisierbares Dashboard als neue Tab-Seite für Chrome, optional mit Bookmarks-Integration.

## Features

- **Zwei Datenquellen**: Chrome-Bookmarks (Ordner "Dashboard") oder manuell verwaltete Shortcuts
- **Tabs (Sets)**: Shortcuts sind in Sets gruppiert, die als Tabs angezeigt werden
- **Drag & Drop**: Shortcuts, Trennlinien und Tabs lassen sich per Drag & Drop neu anordnen
- **Trennlinien**: Horizontale und vertikale Linien zur Strukturierung
- **Quick-Access-Leiste**: Zeigt die meistgenutzten, zuletzt genutzten oder (kombiniert) beste Shortcuts, Anzahl einstellbar (3–12)
- **Themes**: Light, Dark, Minimal, Catppuccin Mocha und 8bit
- **Startverhalten**: Zuletzt geöffneten Tab merken oder immer einen bestimmten Tab öffnen
- **Export / Import**: Sets und Shortcuts als JSON sichern und wiederherstellen

## Installation

1. Lade die Extension-Dateien herunter
2. Öffne Chrome und gehe zu `chrome://extensions/`
3. Aktiviere den "Entwicklermodus"
4. Klicke auf "Entpackte Erweiterung laden"
5. Wähle den Ordner mit den Extension-Dateien aus

## Verwendung

### Shortcuts hinzufügen und bearbeiten
- Über das "+" Symbol Name und URL eingeben (oder eine Trennlinie hinzufügen)
- Über die Shortcut-Einstellungen können Shortcuts bearbeitet, in ein anderes Set verschoben oder gelöscht werden

### Tabs verwalten
- Klicke auf das Menü-Symbol (☰) neben den Tabs
- Sets erstellen, umbenennen oder löschen
- Reihenfolge der Tabs per Drag & Drop ändern

### Einstellungen (⚙️)
- Theme wählen
- Startverhalten festlegen
- Bookmarks-Modus ein-/ausschalten und Bookmarks aktualisieren
- Quick-Access-Leiste konfigurieren
- Daten exportieren / importieren

## Bookmarks-Modus

### 1. Dashboard-Ordner erstellen

1. Öffne `chrome://bookmarks/`
2. Erstelle einen Ordner namens **"Dashboard"**
3. Erstelle darin Unterordner für deine Tabs (z.B. "Arbeit", "Privat")

### 2. Bookmarks hinzufügen

Jeder Unterordner wird zu einem Tab, jedes Bookmark darin zu einem Shortcut.

```
Bookmarks
└── Dashboard
    ├── Arbeit
    │   ├── Gmail
    │   ├── Google Drive
    │   └── Slack
    └── Privat
        ├── YouTube
        └── Wikipedia
```

### 3. Aktivieren

1. Öffne die Einstellungen (⚙️)
2. Klicke auf "Bookmarks Mode"
3. Mit "Refresh Bookmarks" werden Änderungen sofort übernommen

Wird kein "Dashboard"-Ordner gefunden, erscheint eine Meldung und das Dashboard wechselt zurück in den manuellen Modus.

## Manueller Modus (Standard)

Sets und Shortcuts werden direkt im Dashboard verwaltet und lokal in `chrome.storage.local` gespeichert. Daten aus älteren Versionen (`localStorage`) werden beim ersten Start automatisch übernommen.

## Technische Details

- **Manifest Version**: 3
- **Berechtigungen**: `bookmarks`, `storage`, Host-Zugriff auf `raw.githubusercontent.com` (nur für den Update-Check)
- **Datenspeicher**: `chrome.storage.local` (Schema-Version 2, siehe `storage.js`)
- **Shortcut-Icons**: Favicons über den Google-Favicon-Dienst
- **UI-Icons**: Font Awesome 6 (per CDN)
- **Themes**: CSS über `data-theme`-Attribut am `body`

## Updates auf mehreren Geräten

Die Extension aktualisiert sich nicht selbst (entpackte Extensions können ihre Dateien nicht überschreiben, MV3 verbietet nachgeladenen Code). Stattdessen:

1. Repo auf jedem Gerät klonen und den Klon in `chrome://extensions/` als entpackte Extension laden
2. Beim Start prüft `update-check.js` (höchstens alle 6 Stunden), ob die `manifest.json` auf GitHub eine neuere `version` hat, und zeigt dann einen Hinweis
3. Auf dem Gerät `git pull` ausführen. Änderungen an HTML/JS/CSS greifen meist beim nächsten neuen Tab, bei Änderungen am Manifest die Extension neu laden

Einrichtung: `<USER>` und `<REPO>` in `update-check.js` (`UPDATE_MANIFEST_URL`) und in `host_permissions` der `manifest.json` ersetzen. Das Repo muss öffentlich sein. Beim Veröffentlichen einer Änderung die `version` in `manifest.json` erhöhen. Export-Dateien mit persönlichen Daten gehören nicht ins Repo.

Die Daten (Sets, Shortcuts, Einstellungen) liegen pro Gerät in `chrome.storage.local` und werden nicht über GitHub synchronisiert.

## Troubleshooting

### Bookmarks werden nicht geladen
1. Prüfe, ob ein Ordner "Dashboard" mit Unterordnern existiert
2. Klicke in den Einstellungen auf "Refresh Bookmarks"

### Extension funktioniert nicht
1. Prüfe die Chrome-Konsole auf Fehlermeldungen
2. Lade die Extension in `chrome://extensions/` neu

## Projektstruktur

- `manifest.json`: Extension-Konfiguration
- `index.html`: Haupt-Interface
- `script.js`: Funktionalität und Logik
- `storage.js`: Storage-Layer (`chrome.storage.local`, Migration, Schema)
- `update-check.js`: Update-Hinweis anhand der Version im GitHub-Repo
- `style.css`: Styling und Themes
- `Ndot-55.otf`: Schriftart für den 8bit-Theme
- `icons/`: Extension-Icons (32, 64, 128, 256, 512 px)