// #### Update-Check
// Prüft beim Start, ob die manifest.json im GitHub-Repo eine neuere Version
// hat als die installierte, und zeigt dann einen dezenten Hinweis an.
//
// Wichtig: Die Extension aktualisiert sich NICHT selbst. Eine entpackte
// Extension kann ihre Dateien nicht überschreiben, und MV3 verbietet
// nachgeladenen Code. Der Hinweis erinnert nur daran, auf dem Gerät
// `git pull` auszuführen und die Extension neu zu laden.
//
// Ablauf:
// - Remote-Version wird höchstens alle UPDATE_CHECK_INTERVAL_MS geholt.
// - Die zuletzt bekannte Remote-Version wird gespeichert, damit der Hinweis
//   auch zwischen den Checks angezeigt wird und nach dem Update (installierte
//   Version == bekannte Version) von selbst verschwindet.
// - Eigener Storage-Key statt dashboardState: Der Check schreibt asynchron
//   nach einem Netzwerk-Request und darf deshalb nicht den gesamten State
//   (Shortcuts, Sets) einer evtl. veralteten Seite überschreiben.

// <USER> und <REPO> ersetzen (öffentliches Repo, nur Code – keine Export-Dateien committen!)
const UPDATE_MANIFEST_URL =
    "https://raw.githubusercontent.com/Noxy03/web-dashboard/main/manifest.json";
const UPDATE_CHECK_STORAGE_KEY = "updateCheck";
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 Stunden
const UPDATE_FETCH_TIMEOUT_MS = 5000;
const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;

// Vergleicht zwei Versionsstrings ("1.10.0" > "1.9.2"). Rückgabe: -1, 0, 1
function compareVersions(a, b) {
    const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
}

async function fetchRemoteVersion() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPDATE_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(UPDATE_MANIFEST_URL, {
            cache: "no-store",
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const remote = await res.json();
        // Format validieren: Der Wert landet im UI und im Storage.
        if (typeof remote.version !== "string" || !VERSION_PATTERN.test(remote.version)) {
            throw new Error("Invalid version field in remote manifest");
        }
        return remote.version;
    } finally {
        clearTimeout(timer);
    }
}

async function loadUpdateInfo() {
    const result = await chrome.storage.local.get(UPDATE_CHECK_STORAGE_KEY);
    return {
        lastChecked: 0,
        latestVersion: null,
        dismissedVersion: null,
        ...(result[UPDATE_CHECK_STORAGE_KEY] || {}),
    };
}

async function saveUpdateInfo(info) {
    await chrome.storage.local.set({ [UPDATE_CHECK_STORAGE_KEY]: info });
}

function showUpdateBanner(latestVersion, installedVersion, info) {
    if (document.getElementById("updateBanner")) return;

    const banner = document.createElement("div");
    banner.id = "updateBanner";
    banner.setAttribute("role", "status");

    const text = document.createElement("span");
    text.textContent =
        `Update available: v${latestVersion} (installed: v${installedVersion}). ` +
        `Run "git pull" and reload the extension.`;

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", async () => {
        banner.remove();
        info.dismissedVersion = latestVersion;
        await saveUpdateInfo(info);
    });

    banner.append(text, dismiss);
    document.body.appendChild(banner);
}

// Wird in init() bewusst nicht awaited: Der Check darf den Start nie bremsen.
async function checkForUpdate() {
    if (UPDATE_MANIFEST_URL.includes("<USER>") || UPDATE_MANIFEST_URL.includes("<REPO>")) return; // noch nicht konfiguriert

    try {
        const installed = chrome.runtime.getManifest().version;
        const info = await loadUpdateInfo();

        if (Date.now() - info.lastChecked >= UPDATE_CHECK_INTERVAL_MS) {
            try {
                info.latestVersion = await fetchRemoteVersion();
                info.lastChecked = Date.now();
                await saveUpdateInfo(info);
            } catch (e) {
                // Offline, Rate-Limit, Repo nicht erreichbar ... → still ignorieren,
                // beim nächsten Start wird erneut versucht.
                console.warn("Update check failed:", e);
            }
        }

        const latest = info.latestVersion;
        if (
            latest &&
            compareVersions(latest, installed) > 0 &&
            info.dismissedVersion !== latest
        ) {
            showUpdateBanner(latest, installed, info);
        }
    } catch (e) {
        console.warn("Update check aborted:", e);
    }
}