$(function(){
	"use strict";
	
	var setMessage = function(message){
		var messageBox = $('#messageBox');
		messageBox.html(message);
	};

	//login button
	$('#authorizeButton').click(function(){
		var loginEnvironment = $('#loginEnvironment').val();
		var server;
		// Only Production and Sandbox are implemented.  Need to add Custom Domain at some point.
		if (loginEnvironment == 'Production') {
			server = 'https://login.salesforce.com';
		} else {
			server = 'https://test.salesforce.com';
		} 

		// This help doc explains what parameters to pass.
		// https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm&type=5
		var auth_parameters = {
			response_type: 'code',
			client_id: $DewwowExt.CLIENT_ID,
			state: 'This is echoed back in the redirect',
			immediate: false,
			prompt: 'login',
			redirect_uri: chrome.identity.getRedirectURL('callback.html'), // This needs to match the callback url in the connected app settings
			scope: 'web api refresh_token',
			display:'popup'
		};
		var auth_url = server + '/services/oauth2/authorize?' + new URLSearchParams(Object.entries(auth_parameters));
		chrome.identity.launchWebAuthFlow(
			{
				url: auth_url,
				interactive: true
			},
			function(response) {
				let searchParams = new URLSearchParams(response.split('?')[1]);
				// These are the two things we expect to receive.   We use the code to 
				// to then fetch the actual authorization token. 
				let state = searchParams.get('state');
				let code = searchParams.get('code');

				var token_url = server + '/services/oauth2/token';
				var body = ('grant_type=authorization_code&client_id='+encodeURIComponent($DewwowExt.CLIENT_ID)
						+'&redirect_uri='+encodeURIComponent(chrome.identity.getRedirectURL('callback.html'))
						+'&code='+encodeURIComponent(code));
				
				return $.ajax({
					url: token_url,
					method: 'POST',
					data: body,
					headers:{
						'Accept': 'application/json',
					},
					success: function(result,status,xhr){
						result.userId = result.id.split('/')[5];
						result.orgId = result.id.split('/')[4];

						return $Utils.getUserInfo(result.id, result.access_token, function(err, usrRslt){
							if(err){
								//no user info retrieved: it is not used
								usrRslt = {};
							}

							result.username = usrRslt.username;
							result.first_name = usrRslt.first_name;
							result.last_name = usrRslt.last_name;

							return chrome.storage.local.get(['refresh_tokens'], function(params){
								//add currently got token
								params = params || {};
								params.refresh_tokens = params.refresh_tokens || {};
								params.refresh_tokens[result.userId+'_'+result.orgId] = result;

								return chrome.storage.local.set(params, function(){
									renderRefreshTokens();
								});
							});
						});

						
						
					},
					error: function(data){
						return callback && callback(true, data);
					}
				});	
		});

	});

	// Logic to display the existing tokens
	var renderRefreshTokens = function() {
		//get all stored refresh tokens and create a table
		chrome.storage.local.get(['refresh_tokens'], function(params){
			params = params || {};
			params.refresh_tokens = params.refresh_tokens || {};
			var table = $('<table style="width: 80%"><thead><tr>'
				+'<th scope="col">User</th>'
				+'<th scope="col">Instance</th>'
				+'<th scope="col">ORG Id</th>'
				+'<th scope="col">User Id</th>'
				+'<th scope="col">Issued At</th>'
				+'<th scope="col"/>'
				+'</tr></thead><tbody></tbody></table>');

			table.addClass('slds-table slds-table_cell-buffer slds-table_striped');
			table.find('tr').addClass('slds-text-title_caps');

			//sorts stored tokens by username
			var sorted = [];
			for(var key in params.refresh_tokens){
				sorted.push(params.refresh_tokens[key]);
			}
			sorted.sort(function(a,b){
				if(!a) return 1;
				if(!b) return -1;
				var a = (a.username || '').toLowerCase();
				var b = (b.username || '').toLowerCase();
				if(a < b) return -1;
				else if(a > b) return 1;
				return 0;
			});

			//creates a new row for each token stored
			for(var i = 0; i < sorted.length; i++){
				var instance = (sorted[i].instance_url) || '';
				instance = instance.replace('https://','').split('.')[0];
				var tr = $('<tr >'
						+'<td>'+sorted[i].username+'</td>'
						+'<td>'+instance+'</td>'
						+'<td>'+sorted[i].orgId+'</td>'
						+'<td>'+sorted[i].userId+'</td>'
						+'<td>'+(new Date(parseInt(sorted[i].issued_at))).toISOString()+'</td>'
						+'<td><button class="btn-uinfo slds-button slds-button_neutral">test</button>'
						+'<button class="btn-delete slds-button  slds-button_destructive">delete</button>'
						+'<button class="btn-refresh slds-button  slds-button_destructive">refresh</button></td>'
					+'</tr>');

				table.find('tbody').append(tr);

				//refresh token handler
				tr.find('button.btn-refresh')
					.attr('data-user-id', sorted[i].userId)
					.attr('data-org-id', sorted[i].orgId)
					.click(function(){

						var userId = $(this).attr('data-user-id');
						var orgId = $(this).attr('data-org-id');

						setMessage('Loading...');

						//searches for the tokens of the given user
						return chrome.storage.local.get(['refresh_tokens'], function(params){

							params = params || {};
							params.refresh_tokens = params.refresh_tokens || {};

							var token = params.refresh_tokens[userId+'_'+orgId];
							if(!token){
								return alert('Tokens not found');
							}

							return $Utils.doRefreshToken(token.instance_url, 
									token.refresh_token, 
									function(err, results){
								if(err){
									return setMessage('ERROR OCCURRED:\n'+JSON.stringify(err,null,2));
								}
								renderRefreshTokens();
							});
						});
					});

				//refresh token handler
				tr.find('button.btn-delete')
					.attr('data-user-id', sorted[i].userId)
					.attr('data-org-id', sorted[i].orgId)
					.click(function(){

						var userId = $(this).attr('data-user-id');
						var orgId = $(this).attr('data-org-id');

						setMessage('Deleting...');

						//searches for the tokens of the given user
						return chrome.storage.local.get(['refresh_tokens'], function(params){

							params = params || {};
							params.refresh_tokens = params.refresh_tokens || {};

							delete params.refresh_tokens[userId+'_'+orgId];
							return chrome.storage.local.set(params, function(){
								renderRefreshTokens();
								setMessage(null);
							});

						});
					});

				//test connection button
				tr.find('button.btn-uinfo')
					.attr('data-user-id', sorted[i].userId)
					.attr('data-org-id', sorted[i].orgId)
					.click(function(){

						var userId = $(this).attr('data-user-id');
						var orgId = $(this).attr('data-org-id');

						setMessage('Loading...');

						//searches for the tokens of the given user
						return chrome.storage.local.get(['refresh_tokens'], function(params){

							params = params || {};
							params.refresh_tokens = params.refresh_tokens || {};

							var token = params.refresh_tokens[userId+'_'+orgId];
							if(!token){
								return alert('Tokens not found');
							}

							//does a "getUserInfo" call
							return $Utils.getUserInfo(token.id, token.access_token, function(err, result){
								if(err){
									return setMessage('ERROR OCCURRED:'+JSON.stringify(err,null,2));
								}
								return setMessage(JSON.stringify(result,null,2));
							});
						});	
					});
			}

			var content = $('#content');
			content.empty();
			content.append(table);
		});
	};


	renderRefreshTokens();
		


});