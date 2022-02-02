let color = '#3aa757';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Default background color set to %cgreen', `color: ${color}`);
  chrome.storage.sync.set({ color });

  setInterval(interval, 3000);
});

function interval() {
  console.log('dewwow interval start');
  getCurrentTab().then((t) => {
    if (t) {
      if (t.status === 'complete' && t.active === true) {
        console.log(t.url);
        if (t.url.includes('.force.com/')) {
          chrome.scripting.executeScript({
            target: { tabId: t.id },
            function: initDewwow,
          });
        }
      }
    }
    
  });
 
}

async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function initDewwow() {
  console.log('initDewwow start');
  var dewwowMenu = document.getElementById('DewwowMenu');
  if(dewwowMenu){
    dewwowMenu.remove();
  }
  dewwowMenu = document.createElement('li');
  dewwowMenu.id = 'DewwowMenu';
  dewwowMenu.innerText = 'Dewwow Menu';
  dewwowMenu.class = 'slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger--click';
  document.getElementsByClassName('slds-global-actions')[0].appendChild(dewwowMenu);
  console.log('initDewwow end');
}