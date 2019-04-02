/**********************************************************************
 * Portions written by Opacus (C) Mathew Bland, Jonathan Cutting,
 * Opacus Ltd.
 * 
 * This file is part of the Opacus SugarCRM Thunderbird Plugin.
 *
 * The Opacus SugarCRM Thunderbird Plugin
 * is free software:you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * The Opacus SugarCRM Thunderbird Plugin
 * is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with the Opacus SugarCRM Thunderbird Plugin.
 * If not, see <http://www.gnu.org/licenses/>.
 *********************************************************************/
var opacusSTP = {
  opacus_ldap	: '',
  opacus_ldap_key : '',
  webservice	:	'',
  sugarurl	:	'',
  sugarcrm_username :	'',
  sugarcrm_password :	'',
  sugarcrm_password_plain :	'',
  session_id	:	'',
  sugarObjects	:	'',
  autoSugarObjects	:	'',
  fixNotifications	:	true,
  allowNotify	:	true,
  totalMails	:	'',
  totalCalls	:	'',
  searchObject	:	'',
  user_id		:	'',
  auto_archive	:	'',
  opacus_notify	:	'',
  opacus_cases	:	'',
  auto_archive_attachments	:	'',
  server_info	:	'',
  mailsToTag	:	'',
  outboundMail	:	'',
  firstMessageHeader:	'',
  searchChildren	: 0,
  sendAndArchiveStatus: 'unknown',
  timer : Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),
  passwordManager: Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager),
  prefs: Components.classes["@mozilla.org/preferences-service;1"]
         .getService(Components.interfaces.nsIPrefService)
         .getBranch("extensions.opacusSTP.")
         .QueryInterface(Components.interfaces.nsIPrefBranch),
  mailNewsPrefs: Components.classes["@mozilla.org/preferences-service;1"]
         .getService(Components.interfaces.nsIPrefService)
         .getBranch("mailnews.")
         .QueryInterface(Components.interfaces.nsIPrefBranch),
  console : Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService),

  onLoad: function() {
	// initialization code
	opacusSTP.initialized = true;
	opacusSTP.strings = document.getElementById("opacus_strings");


	// Add our custom header to the custom headers pref
	try{
		var prefCheck = opacusSTP.mailNewsPrefs.getCharPref('customDBHeaders');
		if(prefCheck.toLowerCase().indexOf('x-opacus-archived') == -1){
			if(prefCheck.toString() == ''){
				opacusSTP.mailNewsPrefs.setCharPref('customDBHeaders','x-opacus-archived');
			} else {
				opacusSTP.mailNewsPrefs.setCharPref('customDBHeaders',prefCheck.toString() + ' x-opacus-archived');
			}
		}
	}
	catch(ex){
		opacusSTP.mailNewsPrefs.setCharPref('customDBHeaders','x-opacus-archived');
	}



	var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                        .getService(Components.interfaces.nsIXULAppInfo);
	var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                               .getService(Components.interfaces.nsIVersionComparator);
	if(versionChecker.compare(appInfo.version, "17") >= 0) {
		opacusSTP.fixNotifications = false;
	}


	try {
		// Firefox 4 and later; Mozilla 2 and later
		Components.utils.import("resource://gre/modules/AddonManager.jsm");
		AddonManager.getAddonByID("development@opacus.co.uk").then(function(addon) {
			var current = addon.version;
			opacusSTP.runAtStart(current);
		});
		try {
			AddonManager.getAddonByID("prodevelopment@opacus.co.uk", function(addon) {
				try{
					if(addon != null && addon.isActive){
						opacusSTP.showInfoTab('about:addons');
						opacusSTP.notifyUser('critical','Please disable the Standard Opacus Extension when using the Professional edition');
					}
				}
				catch(ex){}
			});
		}
			catch(ex){
		}
	}
	catch(ex){
		var gExtensionManager = Components.classes["@mozilla.org/extensions/manager;1"]  
								.getService(Components.interfaces.nsIExtensionManager);  
		var current = gExtensionManager.getItemForID("development@opacus.co.uk").version;
		opacusSTP.runAtStart(current);
	}

	// Tags
	var tagService = Components. classes["@mozilla.org/messenger/tagservice;1"].
                 getService (Components.interfaces.nsIMsgTagService);
    if(tagService.getKeyForTag('OpacusArchived') == ''){
		tagService.addTag ("OpacusArchived", "#666600", '');
	}
	opacusSTP.mailsToTag = Components.classes["@mozilla.org/array;1"].
				createInstance(Components.interfaces.nsIMutableArray);
	
	// Listener for new mail - auto archive
	var newMailListener = {  
        msgAdded: function(aMsgHdr) {
				if((aMsgHdr.folder.flags & 0x1000) == 0x1000){
					// It's an inbox
					if(aMsgHdr.flags & 0x10000){
						// It's a new message
						if(aMsgHdr.folder.server.type != 'rss'){
							// It's not a newsgroup folder
							var author = aMsgHdr.mime2DecodedAuthor != '' ? aMsgHdr.mime2DecodedAuthor : aMsgHdr.author;
							if(opacusSTP.opacus_notify){
								subject = aMsgHdr.mime2DecodedSubject != '' ? aMsgHdr.mime2DecodedSubject : aMsgHdr.subject;
								opacusSTP.notifyUser('newmail',subject + "\n" + author);
							}
						}
					}
				} else if((aMsgHdr.folder.flags & 0x0200) == 0x0200) {
					// Check for custom header and flag as archived if present and correct.
					// See opacusSTP-compose.js for more details.
					var headerName = 'x-opacus-archived';
					var headerProperty = aMsgHdr.getStringProperty(headerName);
					if(headerProperty == 'onsend'){
						var tagHeaders = Components.classes["@mozilla.org/array;1"].
							createInstance(Components.interfaces.nsIMutableArray);
						tagHeaders.appendElement(aMsgHdr,false);
						aMsgHdr.folder.addKeywordsToMessages(tagHeaders,'OpacusArchived');
					}
				}
			}
    }
    opacusSTP.notificationService =  
        Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]  
        .getService(Components.interfaces.nsIMsgFolderNotificationService);
	opacusSTP.notificationService.addListener(newMailListener, opacusSTP.notificationService.msgAdded);
  },


  runAtStart: function(thisVersion){
	var ver = -1, firstrun = true;
    try{
	  var ver = opacusSTP.prefs.getCharPref("version");  
	  var firstrun = opacusSTP.prefs.getBoolPref("firstrun"); 
    }catch(e){  
      //nothing  
    } finally {
	  if(firstrun){
		opacusSTP.addButtons();
	  }
      if (firstrun  || ver != thisVersion){ 
        opacusSTP.prefs.setBoolPref("firstrun",false);  
        opacusSTP.prefs.setCharPref("version",thisVersion);
        opacusSTP.showInfoTab("chrome://opacusSTP/content/version.html");    
      }

      if(!firstrun){
		// Update the server details from the preferences
		opacusSTP.updateServerInfo(false);
	  }	    
    }
  },


  showPreferences: function(){
  	window.openDialog("chrome://opacusSTP/content/opacusSTP-options.xul","","chrome,resizable=yes,titlebar,modal,centerscreen");
  },

  showInfoTab: function(url){ 
		var tabmail = document.getElementById("tabmail");  
		if (!tabmail) {  
		  // Try opening new tabs in an existing 3pane window  
		  var mail3PaneWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
										  .getService(Components.interfaces.nsIWindowMediator)  
										  .getMostRecentWindow("mail:3pane");  
		  if (mail3PaneWindow) {  
			tabmail = mail3PaneWindow.document.getElementById("tabmail");  
			mail3PaneWindow.focus();  
		  }  
		}  
		  
		if (tabmail)  
		  tabmail.openTab("contentTab", {contentPage: url});  
		else  
		  window.openDialog("chrome://messenger/content/", "_blank",  
							"chrome,dialog=no,all", null,  
							{ tabType: "contentTab",  
							  tabParams: {contentPage: url} }); 


  },

  optionsLoad: function(optionsWindow){
	if(opacusSTP.mac){
		optionsWindow.document.getElementById('saveButton').hidden=false;
	}
	optionsWindow.document.getElementById('passwordsugarcrm_password').value = opacusSTP.sugarcrm_password_plain;
	if(optionsWindow.document.getElementById('checkopacus_ldap').checked === false){
		optionsWindow.document.getElementById('ldap_key_box').hidden = true;
	}
  },

  link: function(identifier){
    var extProtocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                                   .getService(Components.interfaces.nsIExternalProtocolService);
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService);
    var uri = ioService.newURI(identifier, null, null);
    extProtocolSvc.loadUrl(uri);
  },
  
  addButtons: function(){
	try {
	  var myId    = "opacusSTP-archive"; // ID of button to add
	  var afterId = "button-tag";    // ID of element to insert after
	  var navBar  = document.getElementById("mail-bar3");
	  var curSet  = navBar.currentSet.split(",");

	  if (curSet.indexOf(myId) == -1) {
		var pos = curSet.indexOf(afterId) + 1 || curSet.length;
		var set = curSet.slice(0, pos).concat(myId).concat(curSet.slice(pos));

		navBar.setAttribute("currentset", set.join(","));
		navBar.currentSet = set.join(",");
		document.persist(navBar.id, "currentset");
		try {
		  BrowserToolboxCustomizeDone(true);
		}
		catch (e) {}
	  }
	}
	catch(e) {}
	opacusSTP.prefs.setBoolPref('addButtons',true)
  },

  updateServerInfo: function(optionsWindow){
	opacusSTP.webservice = '';
    try{
		opacusSTP.sugarurl = opacusSTP.prefs.getCharPref("sugarcrm_url").replace(/\/$/,'');
		opacusSTP.sugarcrm_username = opacusSTP.prefs.getCharPref("sugarcrm_username");
		opacusSTP.opacus_notify = opacusSTP.prefs.getBoolPref("opacus_notify");
		opacusSTP.opacus_cases = opacusSTP.prefs.getBoolPref("opacus_cases");
		opacusSTP.opacus_ldap = opacusSTP.prefs.getBoolPref("opacus_ldap");
		opacusSTP.opacus_ldap_key = opacusSTP.prefs.getCharPref("opacus_ldap_key");
		opacusSTP.session_id = '';
		if(optionsWindow){ 
			var password = optionsWindow.document.getElementById('passwordsugarcrm_password').value;
			if(password != ''){
				var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",  
										 Components.interfaces.nsILoginInfo,  
										 "init"); 
				var sugarLogin = new nsLoginInfo('chrome://opacusSTP',  
						   null, 'SugarCRM Login',
						   opacusSTP.sugarcrm_username, password, '', ''); 
				// Remove old login
				try {  
   				   // Find users for this extension   
				   var logins = opacusSTP.passwordManager.findLogins({}, 'chrome://opacusSTP', '', 'SugarCRM Login');     
				   for (var i = 0; i < logins.length; i++) {  
					  if (logins[i].username == opacusSTP.sugarcrm_username) {  
						 opacusSTP.passwordManager.removeLogin(logins[i]);  
						 break;  
					  }  
				   }  
				}  
				catch(ex) {} 
				// Add new login
				opacusSTP.passwordManager.addLogin(sugarLogin);
			}
		}
		try {     
		   // Find users for the given parameters  
		   var logins = opacusSTP.passwordManager.findLogins({}, 'chrome://opacusSTP', '', 'SugarCRM Login');  
				
		   // Find user from returned array of nsILoginInfo objects  
		   for (var i = 0; i < logins.length; i++) {  
			  if (logins[i].username == opacusSTP.sugarcrm_username) {  
				 opacusSTP.sugarcrm_password_plain = logins[i].password;  
				 break;  
			  }  
		   }  
		}  
		catch(ex) {}

		var crypt = new opacusSTPcrypt();
		if(opacusSTP.opacus_ldap){
			opacusSTP.sugarcrm_password = crypt.ldapEncrypt(opacusSTP.sugarcrm_password_plain);
		} else {
			opacusSTP.sugarcrm_password = crypt.encrypt(opacusSTP.sugarcrm_password_plain);
		}

		opacusSTP.webservice = new opacusSTPrest();	
		opacusSTP.webservice.setCredentials(opacusSTP.sugarurl,opacusSTP.sugarcrm_username,opacusSTP.sugarcrm_password);
	}
	catch(ex){}
	var serverEvent = {
		notify: function(timer) {
			opacusSTP.timer.cancel();
			opacusSTP.windows = (navigator.platform.indexOf('Win') != -1)? true : false;
			opacusSTP.mac = (navigator.platform.indexOf('Mac') != -1)? true : false;
			opacusSTP.server_info = opacusSTP.webservice.get_server_info();
		}
	}
	opacusSTP.timer.initWithCallback(serverEvent,100,Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	return false;
  },

  sendAndArchive: function(composeWindow){
	opacusSTP.webservice.login();
	opacusSTP.sendAndArchiveStatus = 'unknown';
	this.mails = new Array();
	this.mails[0] = new opacusSTPMail();
	this.mails[0].populateFromCompose(composeWindow);
	this.mails[0].direction = 'outbound';
	this.mails[0].type = 'standard';
	this.mails[0].composeWindow = composeWindow;

	this.searchObject = new opacusSTPsearch(this,this.mails[0].searchSuggestion,this.mails[0].subject);
	this.searchObject.search();
  },

  archive: function() {
	// Function called from the main window that pops up the search window
	this.MessageURIArray = '';
	try
	{
		this.MessageURIArray = gFolderDisplay.selectedMessageUris;
	}
	catch (ex){}

	if(this.MessageURIArray != null){
		this.mails = Array();
		for(var i=0;i<this.MessageURIArray.length;i++){
			this.mails[i]		= new opacusSTPMail();
			this.mails[i].creator	= this;
			this.mails[i].uri	= this.MessageURIArray[i];
			this.mails[i].type = 'standard';
			this.mails[i].direction = 'inbound';
		}
		this.mails[0].parseHeader();
		opacusSTP.firstMessageHeader = this.mails[0].msgHeader;
		this.mails[0].suggestSearch(opacusSTP.firstMessageHeader.folder.displayRecipients);
		this.searchObject = new opacusSTPsearch(this,this.mails[0].searchSuggestion,this.mails[0].subject);
		this.searchObject.search();
	} else {
		opacusSTP.notifyUser('error',opacusSTP.strings.getString('notifyNoMessages'));
	}
  },

  archiveMails: function() {
	var doAttachments = this.searchObject.searchWindow.document.getElementById('doAttachments').checked;
	var sugarObjects = this.searchObject.getCellChecked(this.searchObject.searchWindow.document.getElementById('resultList'),'resultTick');
	if(!sugarObjects){
		return false;
	}
	opacusSTP.totalMails = this.mails.length;
	opacusSTP.searchObject.searchWindow.document.getElementById('feedback').setAttribute('mode','undetermined');
	opacusSTP.searchObject.searchWindow.document.getElementById('archive_button').setAttribute('label',opacusSTP.strings.getString('archiving'));
	for(var i=0;i<this.mails.length;i++){
		var worker = new opacusSTPrest();
		worker.setCredentials(opacusSTP.sugarurl,opacusSTP.sugarcrm_username,opacusSTP.sugarcrm_password);
		this.mails[i].sugarObjects = sugarObjects;
		this.mails[i].worker = worker;
		this.mails[i].doAttachments = doAttachments;
		if(this.mails[i].direction == 'outbound'){
			this.mails[i].unixTime = Math.round(new Date().getTime() / 1000);
			this.mails[i].worker.callback = this.mails[i].archive_callback;
			this.mails[i].worker.archive(this.mails[i]);
		} else {
			this.mails[i].archiveMail();
		}
	}
  },

  wrapUp: function(type,direction) {

	opacusSTP.totalMails--;
	if(opacusSTP.totalMails > 0){
		return;
	}

	var totalMails = this.mails.length;
	var plural=opacusSTP.strings.getString('plural');
	if(totalMails == 1){
		var plural = '';
	}

	opacusSTP.notifyUser('notify',totalMails + ' '+
		opacusSTP.strings.getString('email') +
		plural + ' ' +
		opacusSTP.strings.getString('verifyArchived'));
	this.searchObject.searchWindowClose();

	if(direction == 'inbound'){
		try {
			opacusSTP.firstMessageHeader.folder.addKeywordsToMessages(opacusSTP.mailsToTag,'OpacusArchived');
		}
		catch(e){}
		opacusSTP.mailsToTag = Components.classes["@mozilla.org/array;1"].
					createInstance(Components.interfaces.nsIMutableArray);
	}
  },

  notifyUser: function(type,message){
	// Set up function and timer to handle lack of new line support in XUL notify window
	var fixNotifyTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
	function fixAlertNotification() {
		//seek for alert window
		var fixed= false;
		var winEnum = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator)
			.getXULWindowEnumerator(null);
		var win = null;
		while (winEnum.hasMoreElements())
		try { win = winEnum.getNext()
				.QueryInterface(Components.interfaces.nsIXULWindow).docShell
				.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIDOMWindow);
			if(win.location == 'chrome://global/content/alerts/alert.xul'){
				var orgLabel = win.document.getElementById('alertTextLabel');
				var txt = orgLabel.value.split("\n"); //get original value, as lines
				orgLabel.value = txt[0];//set original label to first line
				//add subsequent lines
				for(var i = 1 ; i < txt.length ; i++){
					var label = orgLabel.cloneNode(true);
					label.value = txt[i];
					orgLabel.parentNode.appendChild(label);
				}
				//update alert size and position
				win.onAlertLoad();
				fixed = true;
				break;
			}
		}
		catch(e){ } //important: hide exceptions

		if (!fixed){
			var notifyEvent = { notify: function(timer) {
				fixNotifyTimer.cancel();
				if(opacusSTP.fixNotifications){
					fixAlertNotification();
				}
			}}
			fixNotifyTimer.initWithCallback(notifyEvent,100,Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		}
	} 
	if(opacusSTP.allowNotify || type == 'critical'){
		// TODO We can specify different images depending on notification type
		var title=opacusSTP.strings.getString('notification');
		var image = (opacusSTP.windows)? 'chrome://global/skin/icons/information-32.png' : 'chrome://global/skin/icons/information-48.png';
		switch(type){
			case 'error' :
				image = (opacusSTP.windows)? 'chrome://global/skin/icons/Warning.png' : 'chrome://global/skin/icons/warning-large.png';
				title = opacusSTP.strings.getString('error');
				break;
			case 'critical' :
				image = (opacusSTP.windows)? 'chrome://global/skin/icons/Warning.png' : 'chrome://global/skin/icons/warning-large.png';
				title = opacusSTP.strings.getString('critical');
				break;
			case 'newmail' :
				image = 'chrome://messenger/skin/icons/new-mail-alert.png';
				title = opacusSTP.strings.getString('newmail');
			default:
		}
		try{
			var alertsService = Components.classes["@mozilla.org/alerts-service;1"].  
				getService(Components.interfaces.nsIAlertsService);
			alertsService.showAlertNotification(image,title,message);
		}
		catch(ex){
		}
		// Set up timer to find notification window and fix newlines
		var fixEvent = { notify: function(timer){
			fixNotifyTimer.cancel();
			if(opacusSTP.fixNotifications){
				fixAlertNotification();
			}
		}}
		fixNotifyTimer.initWithCallback(fixEvent,20,Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		opacusSTP.allowNotify = false;
	}
	var timerEvent = { notify: function(timer) {
		opacusSTP.timer.cancel();
		opacusSTP.allowNotify =true;
	}}
	opacusSTP.timer.initWithCallback(timerEvent,1000,Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  }
};

window.addEventListener("load", function() {opacusSTP.onLoad();}, false);
