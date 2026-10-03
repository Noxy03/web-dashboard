// #### Storage-Layer
// Kapselt chrome.storage.local hinter einem einzigen Schema-Objekt.
// Ersetzt die vorher verstreuten localStorage-Keys (dashboardData,
// useBookmarks, onOpenSetting, lastActiveTab, designMode).
//
// Warum chrome.storage.local statt window.localStorage:
// - localStorage existiert nur im DOM-Kontext dieser Seite. Ein MV3
//   Service-Worker (background.js) hat KEIN localStorage. Sobald irgendein
//   anderer Kontext (Service Worker, Content-Script) mal Settings lesen
//   muss, ist chrome.storage die einzige Option, die überall funktioniert.
// - chrome.storage speichert bereits strukturierte Objekte, kein manuelles
//   JSON.stringify/parse nötig.
// - chrome.storage.onChanged erlaubt später Sync zwischen mehreren offenen
//   New-Tab-Seiten, falls gewünscht.

const STORAGE_ROOT_KEY = "dashboardState";
const SCHEMA_VERSION = 2;

// Legacy-Keys aus der alten localStorage-Version (für einmalige Migration)
const LEGACY_KEYS = {
    data: "dashboardData",
    useBookmarks: "useBookmarks",
    onOpen: "onOpenSetting",
    lastActiveTab: "lastActiveTab",
    theme: "designMode",
};

function defaultState() {
    return {
        version: SCHEMA_VERSION,
        data: {
            sets: {
                Default: [
                    { name: "Startpage", url: "https://www.startpage.com/", type: "link" },
                    { name: "Wikipedia", url: "https://www.wikipedia.org", type: "link" },
                ],
            },
            currentSet: "Default",
            setOrder: ["Default"],
        },
        settings: {
            theme: "light-mode",
            useBookmarks: false,
            onOpen: { mode: "last", tab: null },
            lastActiveTab: null,
            quickAccessBar: { enabled: true, mode: "balanced", count: 7 },
        },
    };
}

// Einmalige Migration: Falls chrome.storage noch leer ist, aber alte
// localStorage-Daten existieren, übernimm sie ins neue Schema.
function migrateFromLocalStorage() {
    const state = defaultState();
    let foundLegacyData = false;

    try {
        const rawData = localStorage.getItem(LEGACY_KEYS.data);
        if (rawData) {
            const parsed = JSON.parse(rawData);
            if (parsed && parsed.sets && parsed.currentSet) {
                state.data.sets = parsed.sets;
                state.data.currentSet = parsed.currentSet;
                state.data.setOrder = parsed.setOrder || Object.keys(parsed.sets);
                foundLegacyData = true;
            }
        }

        const rawUseBookmarks = localStorage.getItem(LEGACY_KEYS.useBookmarks);
        if (rawUseBookmarks !== null) {
            state.settings.useBookmarks = rawUseBookmarks === "true";
            foundLegacyData = true;
        }

        const rawOnOpen = localStorage.getItem(LEGACY_KEYS.onOpen);
        if (rawOnOpen) {
            const parsed = JSON.parse(rawOnOpen);
            if (parsed && parsed.mode) {
                state.settings.onOpen = { mode: parsed.mode, tab: parsed.tab || null };
                foundLegacyData = true;
            }
        }

        const rawLastActiveTab = localStorage.getItem(LEGACY_KEYS.lastActiveTab);
        if (rawLastActiveTab) {
            state.settings.lastActiveTab = rawLastActiveTab;
            foundLegacyData = true;
        }

        const rawTheme = localStorage.getItem(LEGACY_KEYS.theme);
        if (rawTheme) {
            state.settings.theme = rawTheme;
            foundLegacyData = true;
        }
    } catch (e) {
        console.warn("Migration from localStorage failed:", e);
    }

    return foundLegacyData ? state : null;
}

function migrate(state) {
    // Schema-Lücken auffüllen (z.B. nach einem Update, das neue Felder einführt)
    const defaults = defaultState();
    state.data = state.data || defaults.data;
    state.data.setOrder = state.data.setOrder || Object.keys(state.data.sets || {});
    state.settings = state.settings || defaults.settings;
    state.settings.onOpen = state.settings.onOpen || defaults.settings.onOpen;
    state.settings.quickAccessBar =
        state.settings.quickAccessBar || defaults.settings.quickAccessBar;
    state.version = SCHEMA_VERSION;
    return state;
}

async function loadState() {
    const result = await chrome.storage.local.get(STORAGE_ROOT_KEY);
    const stored = result[STORAGE_ROOT_KEY];

    if (stored) {
        return migrate(stored);
    }

    // Nichts in chrome.storage — prüfen, ob alte localStorage-Daten existieren
    const migrated = migrateFromLocalStorage();
    if (migrated) {
        console.log("Old localStorage data found and migrated.");
        await saveState(migrated);
        return migrated;
    }

    return defaultState();
}

async function saveState(state) {
    await chrome.storage.local.set({ [STORAGE_ROOT_KEY]: state });
}

// Für Export/Import: nur der data-Teil, wie beim alten Format
function extractExportPayload(state) {
    return {
        sets: state.data.sets,
        currentSet: state.data.currentSet,
        setOrder: state.data.setOrder,
    };
}