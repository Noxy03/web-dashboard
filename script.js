// #### Global in-memory state
// state is loaded once at startup from chrome.storage (see storage.js)
// and persisted via saveState() on every change. `data` is an alias for
// state.data, so the rest of the code can keep using "data.sets" etc.
let state = null;
let data = null;

let currentEditShortcutIndex = null;
let currentMoveShortcutIndex = null;
let isAddMode = false;
let isDragging = false;
let draggedTabIndex = null;

// #### Init
async function init() {
  state = await loadState();
  data = state.data;

  applyTheme(state.settings.theme, { skipSave: true });

  await loadData();
  renderSetTabs();
  renderShortcuts();
  renderQuickAccessBar();

  wireStaticEventListeners();
  initOnOpenSettings();
  initQuickAccessSettings();
  updateBookmarksModeDisplay();

  // Don't await: the update check must never delay startup.
  checkForUpdate();
}

document.addEventListener("DOMContentLoaded", init);

// #### Persistence
async function saveData() {
  await saveState(state);
}

// #### Bookmarks integration
function loadBookmarksData() {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      try {
        const dashboardData = parseBookmarksTree(bookmarkTreeNodes);
        if (dashboardData) {
          resolve(dashboardData);
        } else {
          reject(new Error("Dashboard folder not found"));
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}

function parseBookmarksTree(bookmarkTreeNodes) {
  const dashboardFolder = findDashboardFolder(bookmarkTreeNodes);
  if (!dashboardFolder) {
    return null;
  }

  const sets = {};
  const setOrder = [];

  if (dashboardFolder.children) {
    dashboardFolder.children.forEach((child) => {
      if (child.children && child.children.length > 0) {
        const shortcuts = child.children
            .filter((bookmark) => bookmark.url)
            .map((bookmark) => ({
              name: bookmark.title || "Untitled",
              url: bookmark.url,
              type: "link",
              useCount: 0,
              lastUsedAt: null,
            }));

        if (shortcuts.length > 0) {
          sets[child.title] = shortcuts;
          setOrder.push(child.title);
        }
      }
    });
  }

  return {
    sets,
    currentSet: getInitialSet(setOrder),
    setOrder,
  };
}

function getInitialSet(setOrder) {
  const onOpenSetting = state.settings.onOpen || { mode: "last" };
  const lastActiveTab = state.settings.lastActiveTab;

  if (onOpenSetting.mode === "specific" && onOpenSetting.tab) {
    if (setOrder.includes(onOpenSetting.tab)) {
      return onOpenSetting.tab;
    }
  } else if (onOpenSetting.mode === "last" && lastActiveTab) {
    if (setOrder.includes(lastActiveTab)) {
      return lastActiveTab;
    }
  }

  return setOrder[0] || "Default";
}

function findDashboardFolder(bookmarkTreeNodes) {
  for (const node of bookmarkTreeNodes) {
    if (node.children) {
      for (const child of node.children) {
        if (child.title === "Dashboard" && child.children) {
          return child;
        }
        const found = findDashboardFolder([child]);
        if (found) return found;
      }
    }
  }
  return null;
}

async function loadData() {
  if (state.settings.useBookmarks) {
    try {
      const bookmarksData = await loadBookmarksData();
      data.sets = bookmarksData.sets;
      data.currentSet = bookmarksData.currentSet;
      data.setOrder = bookmarksData.setOrder;
      console.log("Bookmarks successfully loaded:", data);
    } catch (error) {
      console.warn("Error loading bookmarks:", error);
      // Bookmarks folder is missing (for now) — stay in bookmarks mode, but
      // keep working with the last saved data instead of crashing
    }
  } else {
    data.currentSet = getInitialSet(data.setOrder);
  }
}

function toggleBookmarksMode() {
  state.settings.useBookmarks = !state.settings.useBookmarks;

  const applyAndRender = async () => {
    await loadData();
    renderSetTabs();
    renderShortcuts();
    renderQuickAccessBar();
    updateBookmarksModeDisplay();
    await saveData();
  };

  if (state.settings.useBookmarks) {
    loadBookmarksData()
        .then((bookmarksData) => {
          data.sets = bookmarksData.sets;
          data.currentSet = bookmarksData.currentSet;
          data.setOrder = bookmarksData.setOrder;
          renderSetTabs();
          renderShortcuts();
          renderQuickAccessBar();
          updateBookmarksModeDisplay();
          saveData();
          console.log("Switched to Bookmarks Mode");
        })
        .catch((error) => {
          console.error("Error loading bookmarks:", error);
          alert(
              "Dashboard folder not found! Please create a 'Dashboard' folder in your bookmarks with subfolders for tabs.",
          );
          state.settings.useBookmarks = false;
          applyAndRender();
        });
  } else {
    applyAndRender();
  }
}

function refreshBookmarks() {
  if (!state.settings.useBookmarks) return;

  loadBookmarksData()
      .then((bookmarksData) => {
        data.sets = bookmarksData.sets;
        data.currentSet = bookmarksData.currentSet;
        data.setOrder = bookmarksData.setOrder;
        renderSetTabs();
        renderShortcuts();
        renderQuickAccessBar();
        console.log("Bookmarks updated");
      })
      .catch((error) => {
        console.error("Error updating bookmarks:", error);
        alert("Error updating bookmarks: " + error.message);
      });
}

// #### Settings Modal
function openSettingsModal() {
  document.getElementById("settingsModal").style.display = "flex";
  updateBookmarksModeDisplay();
  initOnOpenSettings();
  initQuickAccessSettings();
}

function closeSettingsModal() {
  document.getElementById("settingsModal").style.display = "none";
}

function updateBookmarksModeDisplay() {
  const toggleBtn = document.getElementById("toggleBookmarksMode");
  if (!toggleBtn) return;

  if (state.settings.useBookmarks) {
    toggleBtn.innerHTML =
        '<span><i class="fa-solid fa-bookmark"></i> Bookmarks Mode (Active)</span>';
    toggleBtn.style.background = "#28a745";
  } else {
    toggleBtn.innerHTML =
        '<span><i class="fa-solid fa-bookmark"></i> Bookmarks Mode</span>';
    toggleBtn.style.background = "";
  }
}

// #### Design Mode
function applyTheme(theme, { skipSave = false } = {}) {
  document.body.setAttribute("data-theme", theme);
  state.settings.theme = theme;
  if (!skipSave) saveData();
}

function setDesignMode(theme) {
  applyTheme(theme);
  closeSettingsModal();
}

// #### Shortcuts
function renderShortcuts() {
  const container = document.getElementById("shortcutContainer");
  container.innerHTML = "";

  const currentSet = data.sets[data.currentSet];
  if (!currentSet) return;

  currentSet.forEach((sc, index) => {
    if (sc.type === "divider") {
      const divider = document.createElement("div");
      divider.className = `divider ${sc.orientation}`;
      divider.setAttribute("data-index", index);
      bindDividerEvents(divider);
      container.appendChild(divider);
      return;
    }

    const tile = document.createElement("div");
    tile.className = "shortcut";
    tile.setAttribute("data-index", index);

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.title = "Edit Shortcut";
    editBtn.textContent = "✎";

    const img = document.createElement("img");
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(sc.url)}&sz=64`;
    img.alt = `${sc.name} Icon`;

    const link = document.createElement("a");
    link.href = sc.url;
    link.target = "_blank";
    link.textContent = sc.name;

    tile.append(editBtn, img, link);

    bindTileEvents(tile, index);
    container.appendChild(tile);

    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openShortcutSettings(index);
    });
  });

  container.appendChild(buildAddTile());
}

function buildAddTile() {
  const addTile = document.createElement("div");
  addTile.className = "shortcut add-tile add-menu-btn";
  addTile.innerHTML = `
    +
    <div class="add-menu">
      <div class="add-menu-content">
        <div class="add-option" id="openAddModalOption">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Shortcut
        </div>
        <div class="add-option" id="addDividerOption">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Divider
        </div>
      </div>
    </div>
  `;
  addTile.addEventListener("click", openAddModal);
  addTile
      .querySelector("#addDividerOption")
      .addEventListener("click", (e) => {
        e.stopPropagation();
      });
  return addTile;
}

// Track shortcut usage (for the quick access bar)
function trackShortcutUse(sc) {
  sc.useCount = (sc.useCount || 0) + 1;
  sc.lastUsedAt = Date.now();
  saveData();
  renderQuickAccessBar();
}

function handleDragStart(e) {
  if (
      e.target.closest(
          ".shortcutSettings-btn, .editShortcutBtn, .deleteShortcutBtn",
      )
  ) {
    e.preventDefault();
    return;
  }

  e.dataTransfer.setData("text/plain", this.dataset.index);
  this.classList.add("dragging");
}

function handleDragOver(e) {
  e.preventDefault();
  this.classList.add("drag-over");
}

function handleDragLeave(e) {
  this.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove("drag-over");
  const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
  const toIndex = parseInt(this.dataset.index);

  if (fromIndex === toIndex || isNaN(fromIndex) || isNaN(toIndex)) return;

  const currentSet = data.sets[data.currentSet];
  const [movedItem] = currentSet.splice(fromIndex, 1);
  currentSet.splice(toIndex, 0, movedItem);

  saveData();
  renderShortcuts();
}

function bindTileEvents(tile, index) {
  tile.addEventListener("click", function (e) {
    if (
        !e.target.closest(".shortcutSettings-btn, .edit-btn") &&
        !tile.classList.contains("add-tile")
    ) {
      const link = tile.querySelector("a");
      if (link) {
        const sc = data.sets[data.currentSet][index];
        if (sc) trackShortcutUse(sc);
        window.location.href = link.href;
      }
    }
  });

  tile.addEventListener("mousedown", function (e) {
    if (e.button === 1) {
      e.preventDefault();
    }
  });

  tile.addEventListener("auxclick", function (e) {
    if (e.button === 1) {
      e.preventDefault();
      const link = tile.querySelector("a");
      if (link) {
        const sc = data.sets[data.currentSet][index];
        if (sc) trackShortcutUse(sc);
        window.open(link.href, "_blank");
      }
    }
  });

  tile.draggable = true;
  tile.addEventListener("dragstart", handleDragStart);
  tile.addEventListener("dragover", handleDragOver);
  tile.addEventListener("dragleave", handleDragLeave);
  tile.addEventListener("drop", handleDrop);
  tile.addEventListener("dragend", () => {
    tile.classList.remove("dragging");
  });
}

// #### Quick access bar (most used / recently used / balanced)
function computeQuickAccessScore(sc, mode) {
  const now = Date.now();
  const ageHours = sc.lastUsedAt ? (now - sc.lastUsedAt) / 3_600_000 : Infinity;

  if (mode === "useCount") return sc.useCount || 0;
  if (mode === "lastUsedAt") return sc.lastUsedAt || 0;

  // balanced: frequency weighted with time decay (fades out over ~24h)
  const recencyWeight = 1 / (1 + ageHours / 24);
  return (sc.useCount || 0) * recencyWeight;
}

function getQuickAccessItems() {
  const settings = state.settings.quickAccessBar;
  if (!settings.enabled) return [];

  // Across sets: all shortcuts from all tabs, not just the active one.
  const allShortcuts = Object.values(data.sets)
      .flat()
      .filter((sc) => sc.type !== "divider" && (sc.useCount || 0) > 0);

  return allShortcuts
      .map((sc) => ({ sc, score: computeQuickAccessScore(sc, settings.mode) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, settings.count)
      .map((x) => x.sc);
}

let quickAccessResizeObserver = null;

function renderQuickAccessBar() {
  const bar = document.getElementById("quickAccessBar");
  if (!bar) return;

  bar.innerHTML = "";
  const items = getQuickAccessItems();

  items.forEach((sc) => {
    const item = document.createElement("div");
    item.className = "quick-access-item";

    const img = document.createElement("img");
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(sc.url)}&sz=32`;
    img.alt = "";

    const label = document.createElement("span");
    label.textContent = sc.name;

    item.append(img, label);
    item.addEventListener("click", () => {
      trackShortcutUse(sc);
      window.location.href = sc.url;
    });

    // Middle mouse button: open in a new tab (same as the shortcut tiles).
    // mousedown is blocked so Chrome does not start autoscroll.
    item.addEventListener("mousedown", (e) => {
      if (e.button === 1) e.preventDefault();
    });
    item.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        trackShortcutUse(sc);
        window.open(sc.url, "_blank");
      }
    });

    bar.appendChild(item);
  });

  fitQuickAccessItems();

  // When the bar is resized (window resize, sidebar, zoom), recompute
  // which items still fit. Set up only once.
  if (!quickAccessResizeObserver && "ResizeObserver" in window) {
    quickAccessResizeObserver = new ResizeObserver(() => fitQuickAccessItems());
    quickAccessResizeObserver.observe(bar);
  }
}

// Hides items from the end (= lowest score, since already sorted) until
// the rest fits into the width of the bar again. This keeps the most
// relevant entries visible and centered, with no scrollbar and no
// clipped icons/labels.
function fitQuickAccessItems() {
  const bar = document.getElementById("quickAccessBar");
  if (!bar) return;

  const itemEls = Array.from(bar.querySelectorAll(".quick-access-item"));
  if (itemEls.length === 0) return;

  itemEls.forEach((el) => {
    el.style.display = "";
  });

  const containerWidth = bar.clientWidth;
  const gap = parseFloat(getComputedStyle(bar).gap) || 0;

  let total = 0;
  let overflowFrom = -1;

  for (let i = 0; i < itemEls.length; i++) {
    total += itemEls[i].offsetWidth + (i > 0 ? gap : 0);
    if (total > containerWidth) {
      overflowFrom = i;
      break;
    }
  }

  if (overflowFrom !== -1) {
    for (let i = overflowFrom; i < itemEls.length; i++) {
      itemEls[i].style.display = "none";
    }
  }
}

function initQuickAccessSettings() {
  const toggleBtn = document.getElementById("toggleQuickAccessBar");
  const modeSelect = document.getElementById("quickAccessModeSelect");
  const countInput = document.getElementById("quickAccessCountInput");
  if (!toggleBtn || !modeSelect || !countInput) return;

  const settings = state.settings.quickAccessBar;
  modeSelect.value = settings.mode;
  countInput.value = settings.count;
  updateQuickAccessToggleDisplay();

  toggleBtn.onclick = () => {
    settings.enabled = !settings.enabled;
    updateQuickAccessToggleDisplay();
    renderQuickAccessBar();
    saveData();
  };

  modeSelect.onchange = () => {
    settings.mode = modeSelect.value;
    renderQuickAccessBar();
    saveData();
  };

  countInput.onchange = () => {
    let count = parseInt(countInput.value, 10);
    if (isNaN(count)) count = 7;
    count = Math.min(12, Math.max(3, count));
    countInput.value = count;
    settings.count = count;
    renderQuickAccessBar();
    saveData();
  };
}

function updateQuickAccessToggleDisplay() {
  const toggleBtn = document.getElementById("toggleQuickAccessBar");
  if (!toggleBtn) return;
  const enabled = state.settings.quickAccessBar.enabled;

  toggleBtn.innerHTML = enabled
      ? '<span><i class="fa-solid fa-bolt"></i> Quick Access Bar (Active)</span>'
      : '<span><i class="fa-solid fa-bolt"></i> Quick Access Bar</span>';
  toggleBtn.style.background = enabled ? "#28a745" : "";
}

// #### Tabs
function renderSetTabs() {
  const setHeader = document.getElementById("setHeader");
  setHeader.innerHTML = "";

  data.setOrder.forEach((setName) => {
    if (!data.sets[setName]) return;

    const tab = document.createElement("div");
    tab.className = `tab${setName === data.currentSet ? " active" : ""}`;
    tab.textContent = setName;
    tab.draggable = true;
    tab.dataset.setName = setName;

    tab.addEventListener("click", function () {
      if (!isDragging) {
        data.currentSet = setName;
        state.settings.lastActiveTab = setName;
        saveData();
        renderSetTabs();
        renderShortcuts();
        renderQuickAccessBar();
      }
    });

    tab.addEventListener("dragstart", handleTabDragStart);
    tab.addEventListener("dragover", handleTabDragOver);
    tab.addEventListener("dragleave", handleTabDragLeave);
    tab.addEventListener("drop", handleTabDrop);
    tab.addEventListener("dragend", handleTabDragEnd);

    setHeader.appendChild(tab);
  });
}

function handleTabDragStart(e) {
  isDragging = true;
  draggedTabIndex = data.setOrder.indexOf(e.target.dataset.setName);
  e.target.classList.add("dragging");
  e.dataTransfer.setData("text/plain", draggedTabIndex);
}

function handleTabDragOver(e) {
  e.preventDefault();
  const targetTab = e.target.closest(".tab");
  if (!targetTab) return;

  targetTab.classList.add("drag-over");

  const bounding = targetTab.getBoundingClientRect();
  const offset = e.clientY - bounding.top;
  if (offset < bounding.height / 2) {
    targetTab.style.borderTop = "2px solid #666";
    targetTab.style.borderBottom = "";
  } else {
    targetTab.style.borderBottom = "2px solid #666";
    targetTab.style.borderTop = "";
  }
}

function handleTabDragLeave(e) {
  const targetTab = e.target.closest(".tab");
  if (!targetTab) return;

  targetTab.classList.remove("drag-over");
  targetTab.style.borderTop = "";
  targetTab.style.borderBottom = "";
}

function handleTabDrop(e) {
  e.preventDefault();
  const targetTab = e.target.closest(".tab");
  if (!targetTab) return;

  const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
  const toSetName = targetTab.dataset.setName;
  const toIndex = data.setOrder.indexOf(toSetName);

  if (fromIndex === toIndex) return;

  const [movedSet] = data.setOrder.splice(fromIndex, 1);
  data.setOrder.splice(toIndex, 0, movedSet);

  saveData();
  renderSetTabs();

  targetTab.classList.remove("drag-over");
  targetTab.style.borderTop = "";
  targetTab.style.borderBottom = "";
}

function handleTabDragEnd() {
  isDragging = false;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("dragging", "drag-over");
    tab.style.borderTop = "";
    tab.style.borderBottom = "";
  });
}

// #### Divider
function addDivider(orientation) {
  const currentSet = data.sets[data.currentSet];
  currentSet.push({
    type: "divider",
    orientation: orientation,
    id: Date.now(),
  });
  saveData();
  renderShortcuts();
  closeAddModal();
}

function bindDividerEvents(divider) {
  divider.addEventListener("click", function (e) {
    if (confirm("Delete divider?")) {
      const index = parseInt(divider.dataset.index);
      data.sets[data.currentSet].splice(index, 1);
      saveData();
      renderShortcuts();
    }
  });

  divider.draggable = true;
  divider.addEventListener("dragstart", handleDragStart);
  divider.addEventListener("dragover", handleDragOver);
  divider.addEventListener("dragleave", handleDragLeave);
  divider.addEventListener("drop", handleDrop);
  divider.addEventListener("dragend", () => {
    divider.classList.remove("dragging");
  });
}

// #### Settings Modal Logic for "On Open"
function initOnOpenSettings() {
  const onOpenLast = document.getElementById("onOpenLast");
  const onOpenSpecific = document.getElementById("onOpenSpecific");
  const onOpenTabList = document.getElementById("onOpenTabList");
  if (!onOpenLast || !onOpenSpecific || !onOpenTabList) return;

  const savedSetting = state.settings.onOpen || { mode: "last" };

  if (savedSetting.mode === "specific") {
    onOpenSpecific.checked = true;
    onOpenTabList.disabled = false;
  } else {
    onOpenLast.checked = true;
    onOpenTabList.disabled = true;
  }

  onOpenTabList.innerHTML = "";
  data.setOrder.forEach((setName) => {
    const option = document.createElement("option");
    option.value = setName;
    option.textContent = setName;
    if (setName === savedSetting.tab) {
      option.selected = true;
    }
    onOpenTabList.appendChild(option);
  });

  onOpenLast.onchange = () => {
    onOpenTabList.disabled = true;
    saveOnOpenSettings();
  };

  onOpenSpecific.onchange = () => {
    onOpenTabList.disabled = false;
    saveOnOpenSettings();
  };

  onOpenTabList.onchange = () => {
    saveOnOpenSettings();
  };
}

function saveOnOpenSettings() {
  const mode = document.querySelector('input[name="onOpenMode"]:checked').value;
  const tab = document.getElementById("onOpenTabList").value;

  state.settings.onOpen = { mode, tab };
  saveData();
}

// #### Set-Settings Modal
function openSetSettingsModal() {
  document.getElementById("setSettingsModal").style.display = "flex";
  renderSetSettingsOptions();
}

function closeSetSettingsModal() {
  document.getElementById("setSettingsModal").style.display = "none";
}

function renderSetSettingsOptions() {
  const renameList = document.getElementById("renameSetList");
  const deleteList = document.getElementById("deleteSetList");
  renameList.innerHTML = deleteList.innerHTML = "";
  for (const setName in data.sets) {
    const option = new Option(setName, setName);
    renameList.add(option);
    deleteList.add(option.cloneNode(true));
  }
}

function addSet() {
  const newSet = document.getElementById("newSetName").value.trim();
  if (newSet.length > 0 && !data.sets[newSet]) {
    data.sets[newSet] = [];
    data.setOrder.push(newSet);
    saveData();
    renderSetTabs();
    document.getElementById("newSetName").value = "";
    closeSetSettingsModal();
  } else {
    alert("The set name must not be empty and must be unique.");
  }
}

function renameSet() {
  const oldName = document.getElementById("renameSetList").value;
  const newName = document.getElementById("renameSetName").value.trim();

  if (newName.length > 0 && !data.sets[newName]) {
    const orderIndex = data.setOrder.indexOf(oldName);
    if (orderIndex > -1) {
      data.setOrder[orderIndex] = newName;
    }

    if (data.currentSet === oldName) {
      data.currentSet = newName;
    }

    data.sets[newName] = data.sets[oldName];
    delete data.sets[oldName];

    saveData();
    renderSetTabs();
    renderShortcuts();
    closeSetSettingsModal();
  } else {
    alert("Invalid name or set already exists.");
  }
}

function deleteSet() {
  const selectedSet = document.getElementById("deleteSetList").value;

  if (confirm(`Really delete ${selectedSet}?`)) {
    delete data.sets[selectedSet];
    data.setOrder = data.setOrder.filter((set) => set !== selectedSet);
    if (data.currentSet === selectedSet) {
      data.currentSet = data.setOrder[0] || "";
    }
    saveData();
    renderSetTabs();
    renderShortcuts();
    renderQuickAccessBar();
    closeSetSettingsModal();
  }
}

// #### Add Modal
function openAddModal(e) {
  if (e) e.stopPropagation();
  isAddMode = true;
  currentEditShortcutIndex = null;
  document.getElementById("addModalTitle").innerHTML =
      `<i class="fa-solid fa-plus"></i> Add Shortcut`;
  document.getElementById("editName").value = "";
  document.getElementById("editUrl").value = "";
  document.getElementById("addModal").style.display = "flex";
  const menu = document.querySelector(".add-menu-content");
  if (menu) menu.classList.remove("show");
}

function openAddModalByIndex(index) {
  const currentSet = data.sets[data.currentSet];
  const shortcut = currentSet[index];

  isAddMode = false;
  currentEditShortcutIndex = index;

  document.getElementById("addModalTitle").innerHTML =
      `<i class="fa-solid fa-pen"></i> Edit Shortcut`;
  document.getElementById("editName").value = shortcut.name;
  document.getElementById("editUrl").value = shortcut.url;

  document.getElementById("addModal").style.display = "flex";
}

function closeAddModal() {
  document.getElementById("addModal").style.display = "none";
  currentEditShortcutIndex = null;
  isAddMode = false;
}

function saveEdit(event) {
  if (event) event.stopPropagation();
  const newName = document.getElementById("editName").value.trim();
  const newUrl = document.getElementById("editUrl").value.trim();
  const currentSet = data.sets[data.currentSet];

  if (newName === "" || newUrl === "") {
    alert("Please fill in both fields.");
    return;
  }

  if (isAddMode) {
    currentSet.push({ name: newName, url: newUrl, type: "link", useCount: 0, lastUsedAt: null });
  } else if (currentEditShortcutIndex !== null) {
    const existing = currentSet[currentEditShortcutIndex];
    currentSet[currentEditShortcutIndex] = {
      ...existing,
      name: newName,
      url: newUrl,
    };
  }

  saveData();
  renderShortcuts();
  renderQuickAccessBar();
  closeAddModal();
}

// #### Shortcut Settings Modal
function openShortcutSettings(index) {
  const currentSet = data.sets[data.currentSet];
  const sc = currentSet[index];

  document.getElementById("settingsShortcutIcon").src =
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(sc.url)}&sz=64`;
  document.getElementById("settingsShortcutName").textContent = sc.name;
  document.getElementById("settingsShortcutUrl").href = sc.url;
  document.getElementById("settingsShortcutUrl").textContent = sc.url;

  document.getElementById("editShortcutBtn").onclick = () => {
    document.getElementById("shortcutSettingsModal").style.display = "none";
    openAddModalByIndex(index);
  };

  document.getElementById("moveShortcutBtn").onclick = () => {
    document.getElementById("shortcutSettingsModal").style.display = "none";
    openMoveModal(index);
  };

  document.getElementById("deleteShortcutBtn").onclick = () => {
    if (confirm(`Really delete ${sc.name}?`)) {
      currentSet.splice(index, 1);
      saveData();
      renderShortcuts();
      renderQuickAccessBar();
      document.getElementById("shortcutSettingsModal").style.display = "none";
    }
  };

  document.getElementById("closeShortcutSettingsModal").onclick = () =>
      closeShortcutSettingsModal();

  document.getElementById("shortcutSettingsModal").style.display = "flex";
}

function closeShortcutSettingsModal() {
  document.getElementById("shortcutSettingsModal").style.display = "none";
}

// #### Move Modal
function openMoveModal(index) {
  currentMoveShortcutIndex = index;
  renderTargetSetList();
  document.getElementById("moveModal").style.display = "flex";
}

function renderTargetSetList() {
  const targetSetList = document.getElementById("targetSetList");
  targetSetList.innerHTML = "";

  data.setOrder.forEach((setName) => {
    if (setName !== data.currentSet && data.sets[setName]) {
      const option = document.createElement("option");
      option.value = setName;
      option.textContent = setName;
      targetSetList.appendChild(option);
    }
  });
}

function confirmMove() {
  const targetSet = document.getElementById("targetSetList").value;
  if (!targetSet) return;

  const currentSet = data.sets[data.currentSet];
  const shortcutToMove = currentSet[currentMoveShortcutIndex];

  currentSet.splice(currentMoveShortcutIndex, 1);
  data.sets[targetSet].push(shortcutToMove);

  saveData();
  renderShortcuts();
  renderSetTabs();
  closeMoveModal();
}

function closeMoveModal() {
  document.getElementById("moveModal").style.display = "none";
  currentMoveShortcutIndex = null;
}

// #### Data export / import
function exportData() {
  const payload = extractExportPayload(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dashboard_backup.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log("Data exported.");
  alert("Data successfully exported as dashboard_backup.json.");
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      if (importedData.sets && importedData.currentSet) {
        data.sets = importedData.sets;
        data.currentSet = importedData.currentSet;
        data.setOrder = importedData.setOrder || Object.keys(importedData.sets);
        await saveData();
        renderSetTabs();
        renderShortcuts();
        renderQuickAccessBar();
        alert("Data successfully imported.");
        console.log("Data successfully imported and loaded.");
      } else {
        alert("Error: The imported file has an invalid format.");
        console.error("Invalid data structure in imported file.");
      }
    } catch (e) {
      alert("Error processing file. Make sure it is a valid JSON file.");
      console.error("Error parsing imported JSON file:", e);
    }
  };
  reader.readAsText(file);
}

// #### Event listeners (bound once at startup)
function wireStaticEventListeners() {
  document
      .getElementById("darkModeBtn")
      .addEventListener("click", () => setDesignMode("dark-mode"));
  document
      .getElementById("lightModeBtn")
      .addEventListener("click", () => setDesignMode("light-mode"));
  document
      .getElementById("eightbitModeBtn")
      .addEventListener("click", () => setDesignMode("eightbit-mode"));
  document
      .getElementById("minmalModeBtn")
      .addEventListener("click", () => setDesignMode("minimal-mode"));
  document
      .getElementById("mochaModeBtn")
      .addEventListener("click", () => setDesignMode("catppuccin-mocha"));

  document
      .getElementById("openSetSettingsModal")
      .addEventListener("click", openSetSettingsModal);
  document
      .getElementById("closeSetSettingsModal")
      .addEventListener("click", closeSetSettingsModal);
  document.getElementById("addSet").addEventListener("click", addSet);
  document.getElementById("renameSet").addEventListener("click", renameSet);
  document.getElementById("deleteSet").addEventListener("click", deleteSet);

  document
      .getElementById("closeAddModal")
      .addEventListener("click", closeAddModal);
  document.getElementById("saveEdit").addEventListener("click", saveEdit);

  document
      .getElementById("addHorizontalDivider")
      .addEventListener("click", () => addDivider("horizontal"));
  document
      .getElementById("addVerticalDivider")
      .addEventListener("click", () => addDivider("vertical"));

  document.getElementById("confirmMove").addEventListener("click", confirmMove);
  document
      .getElementById("cancelMove")
      .addEventListener("click", closeMoveModal);

  document
      .getElementById("openSettingsModal")
      .addEventListener("click", openSettingsModal);
  document
      .getElementById("closeSettingsModal")
      .addEventListener("click", closeSettingsModal);

  document
      .getElementById("toggleBookmarksMode")
      .addEventListener("click", toggleBookmarksMode);
  document
      .getElementById("refreshBookmarksBtn")
      .addEventListener("click", refreshBookmarks);

  document.getElementById("exportDataBtn").addEventListener("click", exportData);
  document.getElementById("importDataBtn").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });
  document
      .getElementById("importFileInput")
      .addEventListener("change", importData);

  // Clicking the overlay closes the respective modal
  const overlayCloseMap = {
    addModal: closeAddModal,
    setSettingsModal: closeSetSettingsModal,
    shortcutSettingsModal: closeShortcutSettingsModal,
    moveModal: closeMoveModal,
    settingsModal: closeSettingsModal,
  };

  Object.entries(overlayCloseMap).forEach(([id, closeFn]) => {
    document.getElementById(id).addEventListener("click", function (e) {
      if (e.target === this) closeFn();
    });
  });
}