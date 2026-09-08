# Web Dashboard v3 - Chrome Extension

Ein personalisierbares Dashboard als neue Tab-Seite für Chrome mit Bookmarks-Integration.

## Features

- **Bookmarks-Integration**: Verwendet Chrome-Bookmarks als Datenquelle
- **Drag & Drop**: Shortcuts und Tabs können per Drag & Drop neu angeordnet werden
- **Mehrere Themes**: Light Mode, Dark Mode, 8bit Mode, Minimal Mode
- **Responsive Design**: Funktioniert auf verschiedenen Bildschirmgrößen
- **Suchfunktion**: Integrierte Suche mit Gemini AI

## Bookmarks-Modus Setup

### 1. Dashboard-Ordner erstellen

1. Öffne Chrome und gehe zu `chrome://bookmarks/`
2. Erstelle einen neuen Ordner namens **"Dashboard"**
3. Erstelle Unterordner für deine Tabs (z.B. "Arbeit", "Privat", "Social Media")

### 2. Bookmarks hinzufügen

1. Füge Bookmarks in die Unterordner ein
2. Jeder Unterordner wird zu einem Tab
3. Jedes Bookmark wird zu einem Shortcut

### 3. Dashboard aktivieren

1. Öffne das Dashboard (neuer Tab)
2. Klicke auf das Einstellungsrad (⚙️)
3. Klicke auf "Bookmarks-Modus" um ihn zu aktivieren
4. Das Dashboard lädt automatisch deine Bookmarks

## Ordnerstruktur Beispiel

```
Bookmarks
└── Dashboard
    ├── Arbeit
    │   ├── Gmail
    │   ├── Google Drive
    │   └── Slack
    ├── Privat
    │   ├── YouTube
    │   ├── Netflix
    │   └── Wikipedia
    └── Social Media
        ├── Facebook
        ├── Twitter
        └── Instagram
```

## Funktionen

### Bookmarks-Modus
- **Automatische Synchronisation**: Änderungen in Bookmarks werden beim nächsten Laden übernommen
- **Manuelle Aktualisierung**: "Bookmarks aktualisieren" Button für sofortige Synchronisation
- **Fallback**: Falls kein Dashboard-Ordner gefunden wird, wird automatisch auf localStorage zurückgegriffen

### localStorage-Modus (Standard)
- **Manuelle Verwaltung**: Tabs und Shortcuts können direkt im Dashboard bearbeitet werden
- **Persistente Daten**: Alle Änderungen werden lokal gespeichert

## Installation

1. Lade die Extension-Dateien herunter
2. Öffne Chrome und gehe zu `chrome://extensions/`
3. Aktiviere den "Entwicklermodus"
4. Klicke auf "Entpackte Erweiterung laden"
5. Wähle den Ordner mit den Extension-Dateien aus

## Verwendung

### Shortcuts hinzufügen/bearbeiten
- Klicke auf das "+" Symbol
- Wähle "Verknüpfung" aus
- Gib Name und URL ein

### Tabs verwalten
- Klicke auf das Menü-Symbol (☰) neben den Tabs
- Erstelle, benenne oder lösche Tabs

### Design ändern
- Klicke auf das Einstellungsrad (⚙️)
- Wähle zwischen verschiedenen Themes

## Technische Details

- **Manifest Version**: 3
- **Berechtigungen**: bookmarks, tabs, scripting
- **Datenquelle**: Chrome Bookmarks API oder localStorage
- **Themes**: CSS-basierte Theme-Systeme

## Troubleshooting

### Bookmarks werden nicht geladen
1. Überprüfe, ob ein "Dashboard"-Ordner in deinen Bookmarks existiert
2. Stelle sicher, dass der Ordner Unterordner mit Bookmarks enthält
3. Klicke auf "Bookmarks aktualisieren" in den Einstellungen

### Extension funktioniert nicht
1. Überprüfe die Chrome-Konsole auf Fehlermeldungen
2. Stelle sicher, dass alle Berechtigungen erteilt wurden
3. Versuche die Extension neu zu laden

## Entwicklung

Die Extension besteht aus:
- `manifest.json`: Extension-Konfiguration
- `index.html`: Haupt-Interface
- `script.js`: Funktionalität und Logik
- `style.css`: Styling und Themes
- `background.js`: Service Worker für Hintergrundprozesse
