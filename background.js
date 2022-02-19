const MAIN_MENU_ID = 'DewwowMenuId';

// We're goign to load the dewwowext.js which is common javascript injected
// into content pages and to this page.   The issue though is... background.js
// is a headless page... it doesn't have a DOM nor a Window object.   So to 
// work around this we are creating a fake window object so when the script
// is imported it has something to attach itself to.  To use the function in 
// there you say window.$DewwowExt.somefunction()  
var window = {};
importScripts('library/dewwowext.js');
importScripts('library/jszip.min.js');

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
    dewwowMenu.className = 'dewwowext-menu';

    // Add the menu to the screen. 
    var body = document.getElementsByTagName('body')[0];
    body.appendChild(dewwowMenu);


    var content = document.createElement('div');
    content.innerHTML = (`
    <div id="myModal" class="dewwowext-modal">
      <div id="dewwowext-button-fls" class="dewwowext-button">Fetch Field Security</div>
      <div id="dewwowext-button-get-objects" class="dewwowext-button">Get Objects</div>
      <div id="dewwowext-button-copy" class="dewwowext-button">Copy Result</div>
      <div id="dewwowext-modal-content" class="dewwowext-modal-content"></div>
      <div id="dewwowext-modal-close-button" class="dewwowext-modal-close-button">[X]</div>
    </div>`);
    dewwowMenu.appendChild(content);


    // Add a handler so we can do things when the user clicks the UI we added. 
    dewwowMenu.addEventListener('click', function(e) {
      var modal = document.querySelector('.dewwowext-modal');
      modal.classList.add('dewwowext-modal-open');
      // $DewwowExt is available because it was also injected.  Just keep in mind
      // the instance of $DewwowExt is a different instance that is alive within the 
      // running background.js.  
    });
  

    // Demonstrating putting something into the cliipboard.
    var copyButton = document.querySelector('#dewwowext-button-copy');
    copyButton.addEventListener('click', function(e) {

      try {
        const content = document.querySelector('#dewwowext-modal-content').innerHTML;
        const blob = new Blob([content], {type: 'text/html'});
        const item = new ClipboardItem({'text/html' : blob});
        navigator.clipboard.write([item]);
      } catch(e) {
        console.log(e);
      }

    });


    // Demonstrating getting data via test.  Not really doing anything productive with the data yet.
    var getObjectsButton = document.querySelector('#dewwowext-button-get-objects');
    if (getObjectsButton) {
      getObjectsButton.addEventListener('click', function(e) {
        var modalcontent = document.querySelector('.dewwowext-modal-content');
        modalcontent.innerText = 'Getting objects...';
        chrome.runtime.sendMessage({action: $DewwowExt.MESSAGES.GET_SESSION}, function(session) {
          $DewwowExt.getSobjects(session.domainAPI, session.sid, function(getObjectsResponse){
            // This is a describe of all the objects in the org.
            var modalcontent = document.querySelector('.dewwowext-modal-content');
            
            modalcontent.innerText = getObjectsResponse.data.sobjects.map(objectDescribe => {
              return objectDescribe.name;
            } ).join('\n');
          });
        });
      });
    }

    // This is a big mess of a function and needs to be refactored.
    // Here's what it's doing...
    //   1. Get the objects in the org via REST. 
    //   2. Submit a metadata API retrieve call via SOAP. 
    //   3. Check the status of the retrie800ve call via SOAP.
    //   4. Decode/Unzip the zipfile received. 
    //   5. Loop the data a build single object.
    //   6. Output the single object as an html table.  
    var flsButton = document.querySelector('#dewwowext-button-fls');
    if (flsButton) {
      flsButton.addEventListener('click', function(e) {
        var modalcontent = document.querySelector('.dewwowext-modal-content');
        modalcontent.innerText = 'Getting object list...';
        chrome.runtime.sendMessage({action: $DewwowExt.MESSAGES.GET_SESSION}, function(session) {
          $DewwowExt.getSobjects(session.domainAPI, session.sid, function(getObjectsResponse){
            var metaTypes = [];

            metaTypes.push({ name: 'CustomObject', members: '*' });
            metaTypes.push({ name: 'Profile',      members: '*' });
            getObjectsResponse.data.sobjects.forEach(function(objectDescribe) {
               metaTypes.push({ name: 'CustomObject', members: objectDescribe.name });
            })

            modalcontent.innerText = 'Retrieve...';
            chrome.runtime.sendMessage (
              {action: $DewwowExt.MESSAGES.METADATA_RETRIEVE,
               session: session,
                metaTypes: metaTypes
              }, 
               function(retrieveResponse) {
                 console.log(retrieveResponse);
                 // since this copy of the function is running in browser we should have
                 // a DOMParse available.
                 var domParser = new DOMParser();
                 var xmlDocument = domParser.parseFromString(retrieveResponse.data, "text/xml");
                 var resultNode = xmlDocument.getElementsByTagName('result')[0];
                 var idNode = resultNode.getElementsByTagName('id')[0];
                 var metadataRetrieveJobId = idNode.innerHTML;
 
                 var modalcontent = document.querySelector('.dewwowext-modal-content');
                 modalcontent.innerText = `Job id from the retrieve is ${metadataRetrieveJobId}.  Fetching in 5 seconds.`;

                 var attemptCounter = 0;
                 var intervalId = setInterval( function(jobId){
                   attemptCounter++;
                   console.log(`setInterval for ${jobId}`);
 
                   chrome.runtime.sendMessage (
                     {action: $DewwowExt.MESSAGES.METADATA_CHECKRETRIEVESTATUS,
                      session: session,
                      asyncProcessId: jobId}, 
                      function(checkRetrieveStatusResponse) { 
                         var xmlDocument = domParser.parseFromString(checkRetrieveStatusResponse.data, "text/xml");
                         var resultNode = xmlDocument.getElementsByTagName('result')[0];
                         var doneValue= resultNode.getElementsByTagName('done')[0].innerHTML;
                         if (doneValue != 'true') {
                           modalcontent.innerText = `We'll keep checking every 5 seconds.  This can take a while for large orgs. Attempts: ${attemptCounter}`;
                           return;
                         }
                         
                         if (doneValue == 'true') {
                            clearInterval(intervalId);
                            var zipFileString = resultNode.getElementsByTagName('zipFile')[0].innerHTML;
                            chrome.runtime.sendMessage (
                              {action: $DewwowExt.MESSAGES.UNZIP,
                              session: session,
                              zipfile: zipFileString}, 
                              function(unzipped) { 
                                  //console.log(unzipped);
                                  var fls = {};
                                  for(longFilename in unzipped){
                                      var folder = longFilename.split('/')[0];
                                      var profileName = longFilename.split('/')[1];
                                      if (folder === 'profiles') {
                                        /*  This is what the data look like....
                                        <fieldPermissions>
                                          <editable>true</editable>
                                          <field>Account.AccountSource</field>
                                          <readable>true</readable>
                                        </fieldPermissions>
                                        */
                                        
                                        // I'm take the data and adding a property to the fls object... one property 
                                        // for every Object.Field we find.   This gathers up all of the data from the files
                                        // into one place.    The value is another object thas has all the profile names as properties. 
                                        // Like this:  
                                        //    'Account.Custom_Field__c'
                                        //         'Admin.Profile'
                                        //              'editable' = 'true'
                                        //              'readable' = 'true'
                                        //         'SomeCustom.Profile'
                                        //              'editable = 'true'
                                        //              'readable = 'true'
                                        //    'Account.Website'
                                        //         'Admin.Profile'
                                        //              'editable = 'true'
                                        //              'readable = 'true'
                                        //         'SomeCustome.Profile'
                                        //              'editable = 'true'
                                        //              'readable = 'true'
                                              
                                        var profileXml = domParser.parseFromString(unzipped[longFilename], "text/xml");
                                        var fieldPermissions = profileXml.getElementsByTagName('fieldPermissions');
                                        for (fieldPermission of fieldPermissions) {
                                          
                                          fieldPermissionFieldName = fieldPermission.getElementsByTagName('field')[0].innerHTML;
                                          if (!fls[fieldPermissionFieldName]){
                                            fls[fieldPermissionFieldName] = {};
                                          }
                                          if (!fls[fieldPermissionFieldName][profileName]) {
                                            fls[fieldPermissionFieldName][profileName] = {};
                                          }
                                          fls[fieldPermissionFieldName][profileName]['editable'] =  fieldPermission.getElementsByTagName('editable')[0].innerHTML;
                                          fls[fieldPermissionFieldName][profileName]['readable'] =  fieldPermission.getElementsByTagName('readable')[0].innerHTML;
                                                                                  
                                        }

                                      }
                                  }

                            
                                  var firstFieldNameObject= Object.entries(fls)[0][1];
                                  var profileNames = Object.keys(firstFieldNameObject);
                                  var headerTds = profileNames.map(n => {
                                      return `<td>${n}</td>`;
                                  }).join('');
                            

                                  var tableHtml = `<table border='1'>
                                                    <tr><td>Object.Field</td>${headerTds}</tr>
                                                    ${Object.entries(fls).map(([key, value]) => {
                                                      return `<tr><td>${key}</td>
                                                        ${ Object.entries(value).map(([profileKey, profileValue]) => {

                                                          if (profileValue.editable == 'true') {
                                                            return '<td>Edit</td>'
                                                          } else if (profileValue.readable == 'true') {
                                                            return '<td>View</td>'                                
                                                          } else {
                                                            return '<td>Hidden</td>' 
                                                          }
                                                        }).join('') }

                                                    </tr>`}).join('')}
                                                  </table>`;
                                  modalcontent.innerHTML = tableHtml;
                    
                                }
                          );
                         
                         }
                      });
 
                     }, 5000, metadataRetrieveJobId);
               }
            );

          });
        });
      });
    }

    var closeButton = document.querySelector('.dewwowext-modal-close-button');
    closeButton.addEventListener('click', function(e){
      e.stopPropagation(); // block the container from getting this click event too.
      var modal = document.querySelector('.dewwowext-modal');
      modal.classList.remove('dewwowext-modal-open');
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
    // Doing the soap calls in the background to avoid cors issues.
    window.$DewwowExt.startMetadataRetrieve(message.session.domainAPI, message.session.sid, message.metaTypes, function(data){
      callback(data);
    });
    return true; // async return

  } else if(message.action === window.$DewwowExt.MESSAGES.METADATA_CHECKRETRIEVESTATUS) {
    // Doing the soap calls in the background to avoid cors issues.
    window.$DewwowExt.checkRetrieveStatus(message.session.domainAPI, message.session.sid, message.asyncProcessId, 'true', function(data){
       callback(data);
    });
    return true; // async return
  } else if(message.action === window.$DewwowExt.MESSAGES.UNZIP) {
    // I'm doing this in the background instead of on the page because I need to use this
    // JSZip library.  If I were to inject it into saleesforce page then I wouldn't need
    // to send a message, but I don't feel good about loading all sorts of things into the
    // page that aren't really needed.   The big downside is that we're passing both the 
    // zip base64 string and the unzipped content back and forth which eats up a lot of memory. 
    window.JSZip.loadAsync(message.zipfile, {"base64": true})
    .then(function(zip) {
      // Each file will end up being a property on this object and the value the context of the file.
      var unzipped = {};

      var promises = [];
 
      // Looping through each of the files and putting out the data.
      // Very bad idea if there is a lot of data.
      for(filename in zip.files){
        const thisFilename = filename;
        console.log(filename);
        var thisPromise = zip.file(thisFilename).async("string").then(function(data){
          unzipped[thisFilename] = data;
        });
        promises.push(thisPromise);          
      }

      // After all the asyncs are finished send the unzipped object to the callback.
      Promise.allSettled(promises).then(function(results){
        callback(unzipped);
      });
      
    });
    
    return true;

  } else {
    return false; // non-async return

  } 

  
    
});