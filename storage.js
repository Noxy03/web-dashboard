// #### Storage layer
// Wraps chrome.storage.local behind a single schema object.
// Replaces the previously scattered localStorage keys (dashboardData,
// useBookmarks, onOpenSetting, lastActiveTab, designMode).
//
// Why chrome.storage.local instead of window.localStorage:
// - localStorage only exists in the DOM context of this page. An MV3
//   service worker (background.js) has NO localStorage. As soon as any
//   other context (service worker, content script) needs to read settings,
//   chrome.storage is the only option that works everywhere.
// - chrome.storage already stores structured objects, no manual
//   JSON.stringify/parse needed.
// - chrome.storage.onChanged later allows syncing between multiple open
//   new-tab pages, if desired.

const STORAGE_ROOT_KEY = "dashboardState";
const SCHEMA_VERSION = 2;

// Legacy keys from the old localStorage version (for one-time migration)
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
                    { name: "Google", url: "https://www.google.de", type: "link" },
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

// One-time migration: if chrome.storage is still empty but old
// localStorage data exists, carry it over into the new schema.
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
    // Fill schema gaps (e.g. after an update that introduces new fields)
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

    // Nothing in chrome.storage — check whether old localStorage data exists
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

// For export/import: only the data part, as in the old format
function extractExportPayload(state) {
    return {
        sets: state.data.sets,
        currentSet: state.data.currentSet,
        setOrder: state.data.setOrder,
    };
}