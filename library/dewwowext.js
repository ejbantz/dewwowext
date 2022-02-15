
 // This is shared place to put reusable functions
 window.$DewwowExt = window.$DewwowExt || (function(){
    "use strict";
    return {
        log: function(message) {
            console.log(message);
        },
        // List of all of the messages you can send that are processed by the background.js
        MESSAGES: {
            GET_SESSION: 'GET_SESSION',
            METADATA_RETRIEVE: 'METADATA_RETRIEVE',
            METADATA_CHECKRETRIEVESTATUS: 'METADATA_CHECKRETRIEVESTATUS',
            UNZIP: 'UNZIP'
        },

        // main Salesforce API level
        API_LEVEL: '52.0',
        
        // client ID from Salesforce connected app
        CLIENT_ID: 'YOUR-CLIENT-ID-HERE',

        isLightningExperience: function(url){
            if (url) {
                return url.indexOf('/one/one.app') > 0;
            } else {
                return window.location.href.indexOf('/one/one.app' > 0);
            } 
        },

        getAllSessionCookies: function (callback){
            //In LEX mode we can find 2 different sids:
            //- one with domain *.lightning.force.com >> unable to access APIs
            //- one with domain *.salesforce.com >> able to access APIs
            //
            //get all sid cookies and take only the ones with the corresponding domains
            chrome.cookies.getAll({"name":"sid"},function (sidCookies){
                var cookiesList = [];
                var domains = [];
                for(var j=0;j<sidCookies.length;j++){

                    if(sidCookies[j].domain.indexOf('.') === 0){
                        sidCookies[j].domain = sidCookies[j].domain.substring(1,sidCookies[j].domain.length);
                    }
                    var cookieDomain = sidCookies[j].domain;

                    //master session comes from salesforce.com
                    var _isMaster = (cookieDomain.indexOf("salesforce.com")>=0) 
                        || (cookieDomain.indexOf("lightning.force.com")>=0);

                    domains.push('https://'+sidCookies[j].domain+'/*');

                    cookiesList.push({
                        sid: sidCookies[j].value, 
                        domain: cookieDomain,
                        isMaster: _isMaster,
                        oid: sidCookies[j].value.split('!')[0],
                    });
                }

                //checks which cookie has an open tab
                chrome.tabs.query({url: domains}, function(tabs){

                    var tmpCookiesMap = {};

                    if(tabs && tabs.length){
                        for(var i = 0; i < tabs.length; i++){
                            var tab = tabs[i];
                            
                            for(var j=0;j<cookiesList.length;j++){
                                var cookie = cookiesList[j];
                                if(tab.url && tab.url.indexOf(cookie.domain) >= 0){
                                    cookie.isActive = true;
                                    cookie.isLex = window.$DewwowExt.isLightningExperience(tab.url);
                                    cookie.server = cookie.domain.split('.')[0],
                                    cookie.domainAPI = cookie.domain;
                                    //"lightning.force.com" is master only if coupled with LEX
                                    if(!cookie.isLex 
                                        && cookie.domain.indexOf("lightning.force.com") >=0){
                                        cookie.isMaster = false;
                                    } 
                                }
                            }

                            //creates a map of active sessions
                            for(var j=0;j<cookiesList.length;j++){
                                var cookie = cookiesList[j];
                                var tmpCookie = {
                                    domain: cookie.domain,
                                    server: cookie.domain.split('.')[0],
                                    domainAPI: cookie.domain,
                                    isLex: cookie.isLex,
                                    oid: cookie.oid,
                                    sid: cookie.sid,
                                    isActive: !!cookie.isActive,
                                    isMaster: !!cookie.isMaster,
                                };

                                if(!tmpCookiesMap[tmpCookie.oid] 
                                    || (tmpCookie.isActive
                                        && tmpCookie.isMaster)
                                    || (!window.$DewwowExt.isLightningExperience(tmpCookie.domain)
                                        && tmpCookie.isMaster
                                        && !tmpCookiesMap[tmpCookie.oid].isActive)
                                    ){
                                    tmpCookiesMap[tmpCookie.oid] = tmpCookie;
                                }
                            }

                            //in case of LEX mode, the serverAPI endpoint is the *.salesforce.com
                            //and its "sid"
                            for(var key in tmpCookiesMap){
                                if(!tmpCookiesMap[key].isLex 
                                    && !window.$DewwowExt.isLightningExperience(tmpCookiesMap[key].domain)) continue;

                                for(var j = 0; j < cookiesList.length; j++){
                                    if(cookiesList[j].oid !== key) continue;
                                    if(cookiesList[j].isLex
                                        || window.$DewwowExt.isLightningExperience(cookiesList[j].domain)) continue;
                                    if(!cookiesList[j].isMaster) continue;
                                    tmpCookiesMap[key].domainAPI = cookiesList[j].domain;
                                    tmpCookiesMap[key].sid = cookiesList[j].sid;
                                    break;
                                }
                            }
                            
                            for(var key in tmpCookiesMap){
                                if(!tmpCookiesMap[key].domainAPI) tmpCookiesMap[key].domainAPI = tmpCookiesMap[key].domain;
                            } 
                        }
                    }

                    callback(tmpCookiesMap);
     
                });
            });

        },

        getSobjects: function(hostname, sessionId, callback){

            var _url = 'https://' + hostname + '/services/data/v' + window.$DewwowExt.API_LEVEL + '/sobjects/';
            var _headers = {
                'Authorization':'Bearer ' + sessionId
            };

            console.log(`Fetching %c${_url}`, "color: blue");
            fetch(_url, {
                method: 'get',
                headers: _headers
            }).then(function (response){
                response.json().then(function (jsonData){
                    callback( { status: response.status, data: jsonData  });
                });
                
            });

        },

        startMetadataRetrieve: function( hostname, sessionId, metaTypes, callback) {
            // Build the url to make metadata calls... which is a little different than plain data calls.
            const _url = 'https://' + hostname + '/services/Soap/m/' + window.$DewwowExt.API_LEVEL;

            // Metadata is via SOAP... you can't do much via REST.
            // There probably soap clients that could be used... but I'm just going to do
            // raw fetch requests for this.    For now this is just hard coding what metadata to request.
            // nothing handles the response yet.
            const _body = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
                                <soapenv:Header>
                                <met:CallOptions>
                                    <met:client>${window.$DewwowExt.CLIENT_ID}</met:client>
                                </met:CallOptions>
                                <met:SessionHeader>
                                    <met:sessionId>${sessionId}</met:sessionId>
                                </met:SessionHeader>
                                </soapenv:Header>
                                <soapenv:Body>
                                <met:retrieve>
                                    <met:retrieveRequest>
                                        <met:apiVersion>${window.$DewwowExt.API_LEVEL}</met:apiVersion>
                                        <met:singlePackage>true</met:singlePackage>
                                        <met:unpackaged>
                                            <met:fullName>DewwowExt</met:fullName>
                                            <met:description>Used to download metadata.</met:description>
                                            ${ metaTypes.map(function(item){
                                                return `<met:types>
                                                            <met:members>${item.members}</met:members>
                                                            <met:name>${item.name}</met:name>
                                                        </met:types>`;
                                            }).join('')}
                                            <met:version>${window.$DewwowExt.API_LEVEL}</met:version>
                                        </met:unpackaged>
                                    </met:retrieveRequest>
                                </met:retrieve>
                                </soapenv:Body>
                            </soapenv:Envelope>`;  
            console.log(_body);
            fetch(_url, {
                method: 'POST',
                headers: {
                    'SOAPAction':'retrieve',
                    'Content-Type': 'text/xml'
                },
                body: _body
            }).then(function (response){
                response.text().then(function (data){
                    // Chrome extensions with manifest 3 no longer have an XML parser.  I could try to 
                    // find some 3rd party library to parse it, but instead I'll just pass it back.
                    // We'll just pass the raw xml back to the caller and let them parse it in the browser.
                    callback( { status: response.status, data: data  });
                });
                
            });

        },

        checkRetrieveStatus: function( hostname, sessionId, asyncProcessId, includeZip, callback) {
            // Build the url to make metadata calls... which is a little different than plain data calls.
            const _url = 'https://' + hostname + '/services/Soap/m/' + window.$DewwowExt.API_LEVEL;

            // Metadata is via SOAP... you can't do much via REST.
            // There probably soap clients that could be used... but I'm just going to do
            // raw fetch requests for this.    For now this is just hard coding what metadata to request.
            // nothing handles the response yet.
            const _body = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
                            <soapenv:Header>
                            <met:CallOptions>
                                <met:client>${window.$DewwowExt.CLIENT_ID}</met:client>
                            </met:CallOptions>
                            <met:SessionHeader>
                                <met:sessionId>${sessionId}</met:sessionId>
                            </met:SessionHeader>
                            </soapenv:Header>
                            <soapenv:Body>
                            <met:checkRetrieveStatus>
                                <met:asyncProcessId>${asyncProcessId}</met:asyncProcessId>
                                <met:includeZip>${includeZip}</met:includeZip>
                            </met:checkRetrieveStatus>
                            </soapenv:Body>
                        </soapenv:Envelope>`;
         
            fetch(_url, {
                method: 'POST',
                headers: {
                    'SOAPAction':'checkRetrieveStatus',
                    'Content-Type': 'text/xml'
                },
                body: _body
            }).then(function (response){
                response.text().then(function (data){
                    // Chrome extensions with manifest 3 no longer have an XML parser.  I could try to 
                    // find some 3rd party library to parse it, but instead I'll just pass it back.
                    // We'll just pass the raw xml back to the caller and let them parse it in the browser.
                    callback( { status: response.status, data: data  });
                });
                
            });

        }

        

    };
})();