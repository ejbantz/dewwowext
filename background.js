const MAIN_MENU_ID = 'DewwowMenuId';

// We're goign to load the dewwowext.js which is common javascript injected
// into content pages and to this page.   The issue though is... background.js
// is a headless page... it doesn't have a DOM nor a Window object.   So to 
// work around this we are creating a fake window object so when the script
// is imported it has something to attach itself to.  To use the function in 
// there you say window.$DewwowExt.somefunction()  
var window = {};
importScripts('library/dewwowext.js');

// This is used to inject html into the Salesforce page when the screen loads. 
// There are are probably going to times when this isn't good enough and I'll
// need to look for url changes. 
chrome.tabs.onUpdated.addListener( function (tabId, changeInfo, tab) {
  if (changeInfo.status == 'complete' && tab.active) {

    // These could have been setup in the manifest but I prefer to inject
    // them via code to have a bit more control.  This is demonstrating
    // injecting both a file and function.
    if (tab.url.includes('.force.com/')) {
      // dewwowext.js is the big one that has all sorts of reusable things.  
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['library/dewwowext.js']
      });

      // this is showing how to inject just a function. 
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
    dewwowMenu = document.createElement('div');
    dewwowMenu.id = menuId;
    dewwowMenu.className = 'dewwowext-menu slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger--click';
    

    var content = document.createElement('div');
    content.innerHTML = (`
    <div id="myModal" class="dewwowext-modal">
    <div id="dewwowext-button-test" class="dewwowext-button">Test Button</div>
    <div id="dewwowext-button-get-objects" class="dewwowext-button">Get Objects</div>
    <div class="dewwowext-modal-content"></div>
      <div class="dewwowext-modal-close-button">[X]</div>
    </div>`);
    dewwowMenu.appendChild(content);

    // This adds an item to the global actions in the upper right corner.
    var parent = document.getElementsByClassName('slds-global-actions')[0];
    if (parent) {
      parent.appendChild(dewwowMenu);
      parent.appendChild(content);

      // Add a handler so we can do things when the user clicks the UI we added. 
      dewwowMenu.addEventListener('click', function(e) {
        var modal = document.querySelector('.dewwowext-modal');
        modal.classList.toggle('dewwowext-modal-open');
        // $DewwowExt is available because it was also injected.  Just keep in mind
        // the instance of $DewwowExt is a different instance that is alive within the 
        // running background.js.  
      });
    }


    // Demonstrating getting data via test.  Not really doing anything productive with the data yet.
    var getObjectsButton = document.querySelector('#dewwowext-button-get-objects');
    if (getObjectsButton) {
      getObjectsButton.addEventListener('click', function(e) {
        var modalcontent = document.querySelector('.dewwowext-modal-content');
        modalcontent.innerText = 'Getting objects...';
        chrome.runtime.sendMessage({action: $DewwowExt.MESSAGES.GET_SESSION}, function(session) {
          $DewwowExt.getSobjects(session.domainAPI, session.sid, function(data){
            // This is a describe of all the objects in the org.
            var modalcontent = document.querySelector('.dewwowext-modal-content');
            modalcontent.innerText = JSON.stringify(data);
          });
        });
      });
    }

    // putting stuff in here that is in flight.
    var testButton = document.querySelector('#dewwowext-button-test');
    if (testButton) {
      testButton.addEventListener('click', function(e) {
        var modalcontent = document.querySelector('.dewwowext-modal-content');
        modalcontent.innerText = 'Starting Retrieve...';
        chrome.runtime.sendMessage({action: $DewwowExt.MESSAGES.GET_SESSION}, function(session) {
           chrome.runtime.sendMessage (
             {action: $DewwowExt.MESSAGES.METADATA_RETRIEVE,
              session: session}, 
              function(data) {
                console.log('METADATA_RETRIEVE finished.');
                var modalcontent = document.querySelector('.dewwowext-modal-content');
                modalcontent.innerText = JSON.stringify(data);
              }
           );
        });
      });
    }

    var closeButton = document.querySelector('.dewwowext-modal-close-button');
    closeButton.addEventListener('click', function(e){
      var modal = document.querySelector('.dewwowext-modal');
      modal.classList.toggle('dewwowext-modal-open');
    })

  }
}


// this onMessage handler is an example of how to pass info from the Salsforce page
// into the background process.   Some and use sendMessage and it is received here.
// in most cases you probably don't need to use this but it's handy to know how to do it.
chrome.runtime.onMessage.addListener(function (message, sender, callback) {
  if(message.action === window.$DewwowExt.MESSAGES.GET_SESSION){
      // The org id is in a cookie called sid.  
      // We get that cookie for the tab url we are on.

      // This is what the sesssion object looks like that is passed back. 
      /*
      domain: "ejb-youtube.my.salesforce.com"
      domainAPI: "ejb-youtube.my.salesforce.com"
      isActive: false
      isMaster: true
      oid: "-- ORG ID ---"
      server: "ejb-youtube"
      sid: "----SESSION ID------"
      */

    chrome.cookies.getAll(
      {
        name: "sid",
        url: sender.tab.url
      }, 
      function (cookies){
        if(!cookies || !cookies.length || !cookies[0].value) return false;

        var organizationId  = cookies[0].value.split('!')[0];

        //gets all available session cookies and returns the
        //one associated with the current org id
        window.$DewwowExt.getAllSessionCookies(function(sessions){
          callback(sessions[organizationId] || {});
        });
      }
    );
    return true; // async return

  } else if(message.action === window.$DewwowExt.MESSAGES.METADATA_RETRIEVE) {
     window.$DewwowExt.startMetadataRetrieve(message.session.domainAPI, message.session.oid, message.session.sid, function(data){
        console.log(data);
        callback(data);
     });
    return true; // async return

  } else {
    return false; // non-async return

  } 

  
    
});