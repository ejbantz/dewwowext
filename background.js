let color = '#3aa757';
const MAIN_MENU_ID = 'DewwowMenuId';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Default background color set to %cgreen', `color: ${color}`);
  chrome.storage.sync.set({ color });
});

// This is used to inject html into the Salesforce page when the screen loads. 
// There are are probably going to times when this isn't good enough and I'll
// need to look for url changes. 
chrome.tabs.onUpdated.addListener( function (tabId, changeInfo, tab) {
  if (changeInfo.status == 'complete' && tab.active) {

    console.log(tab.url);
    if (tab.url.includes('.force.com/')) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: addMainMenuToSalesforcePage,
        args: [ MAIN_MENU_ID ]
      });
    }
  }

});

// Might be used in the future... if not I'll delete it.
async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function addMainMenuToSalesforcePage(menuId) {
  console.log('addMainMenuToSalesforcePage start');
  var dewwowMenu = document.getElementById(menuId);
  if(!dewwowMenu){
    dewwowMenu = document.createElement('li');
    dewwowMenu.id = menuId;
    dewwowMenu.innerText = 'My Menu';
    dewwowMenu.class = 'slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger--click';
    
    // This adds an item to the global actions in the upper right corner.
    document.getElementsByClassName('slds-global-actions')[0].appendChild(dewwowMenu);
    console.log('addMainMenuToSalesforcePage end');
  }
}