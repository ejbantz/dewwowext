let chanaddOrgButton = document.getElementById("addOrgButton");

chrome.storage.sync.get("color", ({ color }) => {
 //  changeColor.style.backgroundColor = color;
});

chanaddOrgButton.addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: setPageBackgroundColor,
  });
});