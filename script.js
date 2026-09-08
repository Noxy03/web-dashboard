let currentEditShortcutIndex = null;
let currentMoveShortcutIndex = null;
let isAddMode = false;
const shortcutsStorageKey = "shortcuts";
const dataStorageKey = "dashboardData";
const useBookmarksKey = "useBookmarks"; // New configuration for Bookmarks Mode
const onOpenKey = "onOpenSetting";
const lastActiveTabKey = "lastActiveTab";

let data = {
  sets: {
    Default: [
      {
        name: "Brave",
        url: "https://search.brave.com/",
        type: "link",
      },
    ],
  },
  currentSet: "Default",
  setOrder: ["Default", "Work"],
};

// Neue Funktionen für Bookmarks-Integration
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
  // Suche nach dem Dashboard-Ordner
  const dashboardFolder = findDashboardFolder(bookmarkTreeNodes);
  if (!dashboardFolder) {
    return null;
  }

  const sets = {};
  const setOrder = [];

  // Verarbeite alle Unterordner des Dashboard-Ordners
  if (dashboardFolder.children) {
    dashboardFolder.children.forEach((child) => {
      if (child.children && child.children.length > 0) {
        // Nur Ordner mit Bookmarks verwenden
        const shortcuts = child.children
          .filter((bookmark) => bookmark.url) // Nur echte Bookmarks, keine Ordner
          .map((bookmark) => ({
            name: bookmark.title || "Untitled",
            url: bookmark.url,
            type: "link",
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
  const onOpenSetting = JSON.parse(localStorage.getItem(onOpenKey)) || {
    mode: "last",
  };
  const lastActiveTab = localStorage.getItem(lastActiveTabKey);

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
        // Rekursiv in Unterordnern suchen
        const found = findDashboardFolder([child]);
        if (found) return found;
      }
    }
  }
  return null;
}

// Modifizierte loadData-Funktion
function loadData() {
  const useBookmarks = localStorage.getItem(useBookmarksKey) === "true";

  if (useBookmarks) {
    // Versuche Bookmarks zu laden
    loadBookmarksData()
      .then((bookmarksData) => {
        data = bookmarksData;
        renderSetTabs();
        renderShortcuts();
        console.log("Bookmarks successfully loaded:", data);
      })
      .catch((error) => {
        console.warn("Error loading bookmarks:", error);
        // Fallback zu localStorage
        loadLocalData();
      });
  } else {
    // Verwende localStorage wie bisher
    loadLocalData();
  }
}

function loadLocalData() {
  const stored = localStorage.getItem(dataStorageKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);

      // Migration für ältere Daten ohne setOrder
      if (!parsed.setOrder) {
        parsed.setOrder = Object.keys(parsed.sets);
      }

      if (parsed.sets && parsed.currentSet) {
        data = parsed;
        // Apply "On Open" setting
        data.currentSet = getInitialSet(data.setOrder);
      } else {
        initializeData();
      }
    } catch (e) {
      initializeData();
    }
  } else {
    initializeData();
  }
}

// Modifizierte saveData-Funktion
function saveData() {
  const useBookmarks = localStorage.getItem(useBookmarksKey) === "true";

  if (!useBookmarks) {
    // Nur speichern wenn nicht im Bookmarks-Modus
    localStorage.setItem(dataStorageKey, JSON.stringify(data));
  }
}

// Funktion zum Umschalten zwischen Bookmarks und localStorage
function toggleBookmarksMode() {
  const currentMode = localStorage.getItem(useBookmarksKey) === "true";
  const newMode = !currentMode;

  localStorage.setItem(useBookmarksKey, newMode.toString());

  if (newMode) {
    // Wechsle zu Bookmarks-Modus
    loadBookmarksData()
      .then((bookmarksData) => {
        data = bookmarksData;
        renderSetTabs();
        renderShortcuts();
        updateBookmarksModeDisplay();
        console.log("Switched to Bookmarks Mode");
      })
      .catch((error) => {
        console.error("Fehler beim Laden der Bookmarks:", error);
        alert(
          "Dashboard folder not found! Please create a 'Dashboard' folder in your bookmarks with subfolders for tabs.",
        );
        // Zurück zu localStorage
        localStorage.setItem(useBookmarksKey, "false");
        loadLocalData();
        renderSetTabs();
        renderShortcuts();
        updateBookmarksModeDisplay();
      });
  } else {
    // Wechsle zu localStorage-Modus
    loadLocalData();
    renderSetTabs();
    renderShortcuts();
    updateBookmarksModeDisplay();
    console.log("Switched to localStorage Mode");
  }
}

// Funktion zum Aktualisieren der Bookmarks (für manuelle Synchronisation)
function refreshBookmarks() {
  const useBookmarks = localStorage.getItem(useBookmarksKey) === "true";

  if (useBookmarks) {
    loadBookmarksData()
      .then((bookmarksData) => {
        data = bookmarksData;
        renderSetTabs();
        renderShortcuts();
        console.log("Bookmarks updated");
      })
      .catch((error) => {
        console.error("Fehler beim Aktualisieren der Bookmarks:", error);
        alert("Error updating bookmarks: " + error.message);
      });
  }
}

// Standarddaten
function initializeData() {
  data = {
    sets: {
      Default: [
        { name: "Google", url: "https://www.google.de" },
        { name: "Wikipedia", url: "https://www.wikipedia.org" },
      ],
    },
    currentSet: "Default",
    setOrder: ["Default"],
  };

  // Check if we should override the current set based on settings
  data.currentSet = getInitialSet(data.setOrder);

  saveData();
}

// #### Settings Modal
function openSettingsModal() {
  document.getElementById("settingsModal").style.display = "flex";
  updateBookmarksModeDisplay();
}

function updateBookmarksModeDisplay() {
  const useBookmarks = localStorage.getItem(useBookmarksKey) === "true";
  const toggleBtn = document.getElementById("toggleBookmarksMode");

  if (useBookmarks) {
    toggleBtn.innerHTML =
      '<span><i class="fa-solid fa-bookmark"></i> Bookmarks Mode (Active)</span>';
    toggleBtn.style.background = "#28a745";
  } else {
    toggleBtn.innerHTML =
      '<span><i class="fa-solid fa-bookmark"></i> Bookmarks Mode</span>';
    toggleBtn.style.background = "";
  }
}

function closeSettingsModal() {
  document.getElementById("settingsModal").style.display = "none";
}

// #### Design Mode
function setDesignMode(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("designMode", theme);
  closeSettingsModal();

  const isDark =
    theme === "dark-mode" ||
    theme === "minimal-mode" ||
    theme === "catppuccin-mocha";

  // Update Gemini Icon based on theme
  const geminiIcon = document.getElementById("geminiIcon");
  if (geminiIcon) {
    geminiIcon.src = isDark
      ? "icons/gemini-icon-white.png"
      : "icons/gemini-icon-color.png";
  }

  // Update Claude Icon based on theme
  const claudeIcon = document.getElementById("claudeIcon");
  if (claudeIcon) {
    claudeIcon.src = isDark
      ? "icons/claude-icon-white.png"
      : "icons/claude-icon-color.png";
  }
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
    tile.innerHTML = `
      <button class="edit-btn" title="Edit Shortcut">✎</button>
      <img src="https://www.google.com/s2/favicons?domain=${sc.url}&sz=64" alt="${sc.name} Icon">
      <a href="${sc.url}" target="_blank">${sc.name}</a>
    `;

    bindTileEvents(tile);
    container.appendChild(tile);

    tile.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openShortcutSettings(index);
    });
  });

  // Add-Tile
  const addTile = document.createElement("div");
  addTile.className = "shortcut add-tile add-menu-btn";
  addTile.innerHTML = `
    +
    <div class="add-menu">
      <div class="add-menu-content">
        <div class="add-option" id="openAddModal">
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
  container.appendChild(addTile);
}

function handleDragStart(e) {
  // Verhindere Drag bei allen interaktiven Elementen
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
  const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
  const toIndex = parseInt(this.dataset.index);

  if (fromIndex === toIndex) return;

  // Elemente im Array verschieben
  const currentSet = data.sets[data.currentSet];
  const [movedItem] = currentSet.splice(fromIndex, 1);
  currentSet.splice(toIndex, 0, movedItem);

  saveData();
  renderShortcuts();
}

// Aktualisiere die bindTileEvents-Funktion
function bindTileEvents(tile) {
  tile.addEventListener("click", function (e) {
    if (
      !e.target.closest(".shortcutSettings-btn") &&
      !tile.classList.contains("add-tile")
    ) {
      // Weiterleiten zur URL
      const link = tile.querySelector("a");
      if (link) {
        window.location.href = link.href;
      }
    }
  });

  // NEU: Verhindert den Autoscroll-Modus des Browsers beim Mousedown der mittleren Maustaste
  tile.addEventListener("mousedown", function (e) {
    if (e.button === 1) {
      // Mittlere Maustaste
      e.preventDefault();
    }
  });

  // Mittelklick-Handler
  tile.addEventListener("auxclick", function (e) {
    if (e.button === 1) {
      // Mittlere Maustaste
      e.preventDefault();
      const link = tile.querySelector("a");
      if (link) {
        window.open(link.href, "_blank");
      }
    }
  });

  // Drag-and-Drop-Events
  tile.draggable = true;
  tile.addEventListener("dragstart", handleDragStart);
  tile.addEventListener("dragover", handleDragOver);
  tile.addEventListener("dragleave", handleDragLeave);
  tile.addEventListener("drop", handleDrop);
  tile.addEventListener("dragend", () => {
    tile.classList.remove("dragging");
  });

  // Deaktiviere Drag für bestimmte Elemente
  //tile.querySelectorAll('').forEach(element => {
  //  element.draggable = false;
  //});
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

    tab.addEventListener("click", function (e) {
      if (!isDragging) {
        data.currentSet = setName;
        localStorage.setItem(lastActiveTabKey, setName);
        saveData();
        renderSetTabs();
        renderShortcuts();
      }
    });

    // Drag & Drop Events
    tab.addEventListener("dragstart", handleTabDragStart);
    tab.addEventListener("dragover", handleTabDragOver);
    tab.addEventListener("dragleave", handleTabDragLeave);
    tab.addEventListener("drop", handleTabDrop);
    tab.addEventListener("dragend", handleTabDragEnd);

    setHeader.appendChild(tab);
  });
}

let isDragging = false;
let draggedTabIndex = null;

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

// Bind Events für Divider
function bindDividerEvents(divider) {
  divider.addEventListener("click", function (e) {
    if (confirm("Delete divider?")) {
      const index = parseInt(divider.dataset.index);
      data.sets[data.currentSet].splice(index, 1);
      saveData();
      renderShortcuts();
    }
  });

  // Drag & Drop
  divider.draggable = true;
  divider.addEventListener("dragstart", handleDragStart);
  divider.addEventListener("dragover", handleDragOver);
  divider.addEventListener("dragleave", handleDragLeave);
  divider.addEventListener("drop", handleDrop);
  divider.addEventListener("dragend", () => {
    divider.classList.remove("dragging");
  });
}

// #### Suchleiste
function searchbar() {
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.querySelector(".clear-btn");

  // Zeigt den "Löschen"-Button nur an, wenn Text im Eingabefeld ist
  searchInput.addEventListener("input", function () {
    if (this.value) {
      clearBtn.style.display = "block";
    } else {
      clearBtn.style.display = "none";
    }
  });

  // Leert das Eingabefeld, wenn der "Löschen"-Button geklickt wird
  clearBtn.addEventListener("click", function () {
    searchInput.value = "";
    this.style.display = "none";
    searchInput.focus(); // Setzt den Fokus zurück ins Eingabefeld
  });

  // Verarbeitet die Suche, wenn die Eingabetaste gedrückt wird
  searchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      const query = this.value.trim();
      if (query) {
        // Sendet die Nachricht und fängt Fehler ab
        chrome.runtime.sendMessage(
          { action: "sendToGemini", text: query },
          function (response) {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError.message);
              // Hier könnte eine Fallback-Logik stehen, falls nötig
            }
          },
        );
      }
    }
  });

  // Initial state: hide "Clear" button
  clearBtn.style.display = "none";

  // Gemini Button
  const geminiBtn = document.getElementById("geminiBtn");
  if (geminiBtn) {
    geminiBtn.addEventListener("click", function () {
      window.location.href = "https://gemini.google.com";
    });
  }

  // Claude Button
  const claudeBtn = document.getElementById("claudeBtn");
  if (claudeBtn) {
    claudeBtn.addEventListener("click", function () {
      window.location.href = "https://claude.ai/new";
    });
  }
}

// #### Settings Modal
function openSetSettingsModal() {
  document.getElementById("setSettingsModal").style.display = "flex";
  renderSetSettingsOptions();
}

// #### Settings Modal Logic for "On Open"
function initOnOpenSettings() {
  const onOpenLast = document.getElementById("onOpenLast");
  const onOpenSpecific = document.getElementById("onOpenSpecific");
  const onOpenTabList = document.getElementById("onOpenTabList");

  // Load saved settings
  const savedSetting = JSON.parse(localStorage.getItem(onOpenKey)) || {
    mode: "last",
  };

  if (savedSetting.mode === "specific") {
    onOpenSpecific.checked = true;
    onOpenTabList.disabled = false;
  } else {
    onOpenLast.checked = true;
    onOpenTabList.disabled = true;
  }

  // Populate dropdown
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

  // Event Listeners
  onOpenLast.addEventListener("change", () => {
    onOpenTabList.disabled = true;
    saveOnOpenSettings();
  });

  onOpenSpecific.addEventListener("change", () => {
    onOpenTabList.disabled = false;
    saveOnOpenSettings();
  });

  onOpenTabList.addEventListener("change", () => {
    saveOnOpenSettings();
  });
}

function saveOnOpenSettings() {
  const mode = document.querySelector('input[name="onOpenMode"]:checked').value;
  const tab = document.getElementById("onOpenTabList").value;

  const setting = { mode, tab };
  localStorage.setItem(onOpenKey, JSON.stringify(setting));
}

// Hook into openSettingsModal
const originalOpenSettingsModal = openSettingsModal;
openSettingsModal = function () {
  originalOpenSettingsModal();
  initOnOpenSettings();
};

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
    // Update set order
    const orderIndex = data.setOrder.indexOf(oldName);
    if (orderIndex > -1) {
      data.setOrder[orderIndex] = newName;
    }

    // Update current set if needed
    if (data.currentSet === oldName) {
      data.currentSet = newName;
    }

    // Rename the set
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
    closeSetSettingsModal();
  }
}

// #### Add Modal
function openAddModal(e) {
  e.stopPropagation();
  isAddMode = true;
  currentEditShortcutIndex = null;
  document.getElementById("addModalTitle").innerHTML =
    `<i class="fa-solid fa-plus"></i> Add Shortcut`;
  document.getElementById("editName").value = "";
  document.getElementById("editUrl").value = "";
  document.getElementById("addModal").style.display = "flex";
  document.querySelector(".add-menu-content").classList.remove("show");
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
  event.stopPropagation();
  const newName = document.getElementById("editName").value.trim();
  const newUrl = document.getElementById("editUrl").value.trim();
  const currentSet = data.sets[data.currentSet];

  if (newName === "" || newUrl === "") {
    alert("Please fill in both fields.");
    return;
  }

  if (isAddMode) {
    // Neuer Shortcut im aktuellen Set hinzufügen
    currentSet.push({ name: newName, url: newUrl });
  } else if (currentEditShortcutIndex !== null) {
    // Bestehenden Shortcut im aktuellen Set bearbeiten
    currentSet[currentEditShortcutIndex] = { name: newName, url: newUrl };
  }

  saveData();
  renderShortcuts();
  closeAddModal();
}

// #### Shortcut Settings Modal

function openShortcutSettings(index) {
  const currentSet = data.sets[data.currentSet];
  const sc = currentSet[index];

  document.getElementById("settingsShortcutIcon").src =
    `https://www.google.com/s2/favicons?domain=${sc.url}&sz=64`;
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

// #### Daten export
function exportData() {
  const dataToExport = localStorage.getItem(dataStorageKey);
  if (dataToExport) {
    const blob = new Blob([dataToExport], { type: "application/json" });
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
  } else {
    alert("No data found to export!");
  }
}

// #### Daten import
function importData(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      // Optional: Validierung der Datenstruktur
      if (importedData.sets && importedData.currentSet) {
        localStorage.setItem(dataStorageKey, JSON.stringify(importedData));
        loadData(); // Daten neu laden und UI aktualisieren
        renderSetTabs();
        renderShortcuts();
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

// Event-Listener für Export und Import hinzufügen
document.addEventListener("DOMContentLoaded", () => {
  const exportBtn = document.getElementById("exportDataBtn");
  const importBtn = document.getElementById("importDataBtn");
  const importInput = document.getElementById("importFileInput");

  if (exportBtn) {
    exportBtn.addEventListener("click", exportData);
  }

  if (importBtn) {
    importBtn.addEventListener("click", () => {
      importInput.click();
    });
  }

  if (importInput) {
    importInput.addEventListener("change", importData);
  }
});

// #### Initial laden und rendern
renderSetTabs();
renderShortcuts();

// #### Event-Listener DOMContentLoaded
document.addEventListener("DOMContentLoaded", function () {
  // Eventlistener für Design Mode
  const savedDesignMode = localStorage.getItem("designMode") || "light-mode";
  document.body.setAttribute("data-theme", savedDesignMode);

  // Set initial Gemini Icon
  const geminiIcon = document.getElementById("geminiIcon");
  if (geminiIcon) {
    if (savedDesignMode === "dark-mode" || savedDesignMode === "minimal-mode") {
      geminiIcon.src = "icons/gemini-icon-white.png";
    } else {
      geminiIcon.src = "icons/gemini-icon-color.png";
    }
  }

  // Set initial Claude Icon
  const claudeIcon = document.getElementById("claudeIcon");
  if (claudeIcon) {
    if (savedDesignMode === "dark-mode" || savedDesignMode === "minimal-mode") {
      claudeIcon.src = "icons/claude-icon-white.png";
    } else {
      claudeIcon.src = "icons/claude-icon-color.png";
    }
  }

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

  // Event-Listener für Modals
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
    .getElementById("openAddModal")
    .addEventListener("click", openAddModal);
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

  // Bookmarks-Modus Event-Listener
  document
    .getElementById("toggleBookmarksMode")
    .addEventListener("click", toggleBookmarksMode);
  document
    .getElementById("refreshBookmarksBtn")
    .addEventListener("click", refreshBookmarks);

  // Restliche Initialisierungen
  loadData();
  renderSetTabs();
  renderShortcuts();
  searchbar();

  // Klick-Handler
  document.getElementById("addModal").addEventListener("click", function (e) {
    if (e.target === this) {
      closeAddModal();
    }
  });

  document
    .getElementById("setSettingsModal")
    .addEventListener("click", function (e) {
      if (e.target === this) {
        closeSetSettingsModal();
      }
    });

  document
    .getElementById("shortcutSettingsModal")
    .addEventListener("click", function (e) {
      if (e.target === this) {
        closeShortcutSettingsModal();
      }
    });

  document.getElementById("moveModal").addEventListener("click", function (e) {
    if (e.target === this) {
      closeMoveModal();
    }
  });

  document
    .getElementById("settingsModal")
    .addEventListener("click", function (e) {
      if (e.target === this) {
        closeSettingsModal();
      }
    });
});
