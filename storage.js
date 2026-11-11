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

// Every open new-tab page keeps its own in-memory copy of the state and
// writes the whole object back on each change. Without a guard, a page that
// has been open for a while would overwrite changes made in another page.
// PAGE_ID marks who wrote the state, so a page can ignore its own writes in
// chrome.storage.onChanged and adopt everything else (see watchStorageChanges).
const PAGE_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

async function saveState(state) {
    state._writer = PAGE_ID;
    await chrome.storage.local.set({ [STORAGE_ROOT_KEY]: state });
}

// Calls onState(newState) when ANOTHER page changed the dashboard state and
// onUsage(newStats) when the usage statistics changed (from any page).
function watchStorageChanges({ onState, onUsage }) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;

        const stateChange = changes[STORAGE_ROOT_KEY];
        if (stateChange && stateChange.newValue && stateChange.newValue._writer !== PAGE_ID) {
            onState(migrate(stateChange.newValue));
        }

        const usageChange = changes[USAGE_STORAGE_KEY];
        if (usageChange) onUsage(usageChange.newValue || {});
    });
}

// #### Usage statistics (quick access bar)
// Stored under its own key and indexed by URL, NOT inside the shortcut
// objects. Reasons:
// - Bookmarks mode rebuilds all shortcuts from the bookmarks on every start,
//   which used to reset the counters to 0.
// - The same URL in several sets is counted once.
// - Recording a click is a small read-modify-write of this key only, so it
//   cannot overwrite sets/settings with a stale copy.
// Shape: { "<url>": { count: number, lastUsedAt: number|null } }
const USAGE_STORAGE_KEY = "usageStats";

// Builds stats from the old per-shortcut useCount/lastUsedAt fields
// (one-time migration, also used for old export files).
function collectLegacyUsage(sets) {
    const stats = {};
    Object.values(sets || {}).forEach((list) => {
        (list || []).forEach((sc) => {
            if (!sc || sc.type === "divider" || !sc.url || !(sc.useCount > 0)) return;
            const entry = stats[sc.url] || { count: 0, lastUsedAt: null };
            entry.count += sc.useCount;
            entry.lastUsedAt = Math.max(entry.lastUsedAt || 0, sc.lastUsedAt || 0) || null;
            stats[sc.url] = entry;
        });
    });
    return stats;
}

// Removes the old fields from the shortcuts. Returns true if anything changed.
function stripLegacyUsage(sets) {
    let changed = false;
    Object.values(sets || {}).forEach((list) => {
        (list || []).forEach((sc) => {
            if (sc && ("useCount" in sc || "lastUsedAt" in sc)) {
                delete sc.useCount;
                delete sc.lastUsedAt;
                changed = true;
            }
        });
    });
    return changed;
}

async function readUsageStats() {
    const result = await chrome.storage.local.get(USAGE_STORAGE_KEY);
    return result[USAGE_STORAGE_KEY] || null;
}

async function writeUsageStats(stats) {
    await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: stats });
    return stats;
}

// legacySets: the stored sets, only used if no statistics exist yet.
async function loadUsageStats(legacySets) {
    const stored = await readUsageStats();
    if (stored) return stored;
    return writeUsageStats(collectLegacyUsage(legacySets));
}

async function recordUsage(url) {
    const stats = (await readUsageStats()) || {};
    const entry = stats[url] || { count: 0, lastUsedAt: null };
    entry.count += 1;
    entry.lastUsedAt = Date.now();
    stats[url] = entry;
    return writeUsageStats(stats);
}

// A shortcut got a new URL: it keeps its history (unless the new URL
// already has one).
async function copyUsage(oldUrl, newUrl) {
    const stats = (await readUsageStats()) || {};
    if (stats[oldUrl] && !stats[newUrl]) {
        stats[newUrl] = { ...stats[oldUrl] };
        return writeUsageStats(stats);
    }
    return stats;
}

async function replaceUsageStats(stats) {
    return writeUsageStats(stats || {});
}

// For export/import: only the data part, as in the old format
function extractExportPayload(state, usage) {
    return {
        sets: state.data.sets,
        currentSet: state.data.currentSet,
        setOrder: state.data.setOrder,
        usage: usage || {},
    };
}