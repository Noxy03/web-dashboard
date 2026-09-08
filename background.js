chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendToGemini") {
    // Finde den aktuellen, aktiven Tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (currentTab) {
        // Aktualisiere den aktuellen Tab
        chrome.tabs.update(
          currentTab.id,
          { url: "https://gemini.google.com/" },
          (updatedTab) => {
            // Warte, bis der Tab vollständig geladen ist
            const listener = (tabId, changeInfo) => {
              if (tabId === updatedTab.id && changeInfo.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);

                chrome.scripting.executeScript(
                  {
                    target: { tabId: updatedTab.id },
                    files: ["contentScript.js"],
                  },
                  () => {
                    // Sende den Text an das Content Script
                    chrome.tabs.sendMessage(updatedTab.id, {
                      action: "insertText",
                      text: request.text,
                    });
                  }
                );
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          }
        );
      }
    });

    sendResponse({});
    return true;
  }
});
