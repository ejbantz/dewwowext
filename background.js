const MAIN_MENU_ID = 'DewwowMenuId';

// This is used to inject html into the Salesforce page when the screen loads. 
// There are are probably going to times when this isn't good enough and I'll
// need to look for url changes. 
chrome.tabs.onUpdated.addListener( function (tabId, changeInfo, tab) {
  if (changeInfo.status == 'complete' && tab.active) {

    // These could have been setup in the manifest but I prefer to inject
    // them via code to have a bit more control.  This is demonstrating
    // injecting both a file and function.
    if (tab.url.includes('.force.com/')) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['library/dewwowext.js']
      });
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

// Keep in mind that when a function is injected via chrome.scripting.executeScript
// It is putting a copy of the script into the dom.  Because of this... the script 
// needs to be self contained. 
function addMainMenuToSalesforcePage(menuId) {
  var dewwowMenu = document.getElementById(menuId);
  if(!dewwowMenu){
    // Only add the menu if it doesn't already exist.   Sort of a pointless
    // check... but I suppose if someone creates a second extension that happens
    // to add ths same div tag id then bad things would happen.   Maybe the 
    // the div id should be more of random thing... or make use the exensions unique id.
    dewwowMenu = document.createElement('li');
    dewwowMenu.id = menuId;
    dewwowMenu.innerText = 'Dewwow Menu';
    dewwowMenu.className = 'dewwowext-menu slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger--click';
    
    // This adds an item to the global actions in the upper right corner.
    var parent = document.getElementsByClassName('slds-global-actions')[0];
    if (parent) {
      parent.appendChild(dewwowMenu);
    
      // Add a handler so we can do things when the user clicks the UI we added. 
      dewwowMenu.addEventListener('click', function(e) {
        // $DewwowExt is available because it as also injected. 
        $DewwowExt.log('Menu button clicked.');
      });
    }
  }
}