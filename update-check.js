// #### Update check
// On startup, checks whether the manifest.json in the GitHub repo has a
// newer version than the installed one, and shows a subtle notice if so.
//
// Important: the extension does NOT update itself. An unpacked extension
// cannot overwrite its own files, and MV3 forbids remotely hosted code.
// The notice only points you to the new release (ZIP) or reminds you to run
// `git pull` on this device, followed by reloading the extension.
//
// How it works:
// - The remote version is fetched at most once per UPDATE_CHECK_INTERVAL_MS.
// - The last known remote version is stored, so the notice is also shown
//   between checks and disappears on its own after the update (installed
//   version == known version).
// - Separate storage key instead of dashboardState: the check writes
//   asynchronously after a network request and therefore must not overwrite
//   the entire state (shortcuts, sets) from a possibly stale page.

const UPDATE_MANIFEST_URL =
    "https://raw.githubusercontent.com/Noxy03/web-dashboard/main/manifest.json";
// Where the notice sends you (ZIP built by .github/workflows/release.yml)
const UPDATE_RELEASES_URL = "https://github.com/Noxy03/web-dashboard/releases/latest";
const UPDATE_CHECK_STORAGE_KEY = "updateCheck";
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const UPDATE_FETCH_TIMEOUT_MS = 5000;
const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;

// Compares two version strings ("1.10.0" > "1.9.2"). Returns -1, 0 or 1
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
        // Validate the format: the value ends up in the UI and in storage.
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
        `Update available: v${latestVersion} (installed: v${installedVersion}). `;

    const link = document.createElement("a");
    link.href = UPDATE_RELEASES_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Download the release";
    link.style.color = "inherit";
    link.style.textDecoration = "underline";

    const hint = document.createElement("span");
    hint.textContent = ` or run "git pull", then reload the extension. `;

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", async () => {
        banner.remove();
        info.dismissedVersion = latestVersion;
        await saveUpdateInfo(info);
    });

    banner.append(text, link, hint, dismiss);
    document.body.appendChild(banner);
}

// Intentionally not awaited in init(): the check must never slow down startup.
async function checkForUpdate() {

    try {
        const installed = chrome.runtime.getManifest().version;
        const info = await loadUpdateInfo();

        if (Date.now() - info.lastChecked >= UPDATE_CHECK_INTERVAL_MS) {
            try {
                info.latestVersion = await fetchRemoteVersion();
                info.lastChecked = Date.now();
                await saveUpdateInfo(info);
            } catch (e) {
                // Offline, rate limit, repo unreachable ... → ignore silently,
                // it will be retried on the next start.
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