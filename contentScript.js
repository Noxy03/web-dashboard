chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "insertText") {
    // Das HTML-Element des Chatfeldes
    const chatInput = document.querySelector("rich-textarea div.ql-editor");
    if (chatInput) {
      // Füge den Text ein
      chatInput.innerHTML = `<p>${request.text}</p>`;

      // Simuliere ein "input" Event, um Gemini mitzuteilen, dass sich der Text geändert hat
      const event = new Event("input", { bubbles: true });
      chatInput.dispatchEvent(event);

      // Optioal: Simuliere das Drücken der "Enter"-Taste, um die Nachricht abzuschicken
      // const keypressEvent = new KeyboardEvent('keypress', { key: 'Enter', bubbles: true });
      // chatInput.dispatchEvent(keypressEvent);
    }
  }
});
