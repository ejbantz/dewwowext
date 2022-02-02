// Initialize button with user's preferred color
let changeColor = document.getElementById("changeColor");

chrome.storage.sync.get("color", ({ color }) => {
  changeColor.style.backgroundColor = color;
});

// When the button is clicked, inject setPageBackgroundColor into current page
changeColor.addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: setPageBackgroundColor,
    });
  });
  
  // The body of this function will be executed as a content script inside the
  // current page
  function setPageBackgroundColor() {
    chrome.storage.sync.get("color", ({ color }) => {
      document.body.style.backgroundColor = color;
    });
    console.log('ejbtest start');
    var appContainer = document.getElementById('Dewwow');
    if(appContainer){
        appContainer.remove();
    }
    appContainer = document.createElement('li');
    appContainer.id = 'ejbtest';
    appContainer.innerText = 'ejbtest';
    appContainer.class = 'slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger--click';
    document.getElementsByClassName('slds-global-actions')[0].appendChild(appContainer);
    console.log('ejbtest end');

  }