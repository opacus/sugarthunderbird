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
  webservice	:	'',
  sugarurl	:	'',
  sugarcrm_username :	'',
  sugarcrm_password :	'',
  session_id	:	'',
  sugarObjects	:	'',
  autoSugarObjects	:	'',
  allowNotify	:	true,
  totalMails	:	'',
  totalAttachments : '',
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

  onLoad: function() {
	// initialization code
	this.initialized = true;
	opacusSTP.strings = document.getElementById("opacus_strings");
	opacusSTP.windows = (navigator.platform.indexOf('Win') != -1)? true : false;


	// Pop a tab on update or install to let the user know about Opacus and the update
	var Prefs = Components.classes["@mozilla.org/preferences-service;1"]  
                   .getService(Components.interfaces.nsIPrefService);  
	Prefs = Prefs.getBranch("development@opacus.co.uk"); 
	var ver = -1, firstrun = true;  
    var gExtensionManager = Components.classes["@mozilla.org/extensions/manager;1"]  
                            .getService(Components.interfaces.nsIExtensionManager);  
    var current = gExtensionManager.getItemForID("development@opacus.co.uk").version;  
      
    try{  
	  ver = Prefs.getCharPref("version");  
	  firstrun = Prefs.getBoolPref("firstrun");  
    }catch(e){  
      //nothing  
    }finally{  
      if (firstrun  || ver != current){ 
        Prefs.setBoolPref("firstrun",false);  
        Prefs.setCharPref("version",current);
        opacusSTP.showInfoTab("chrome://opacusSTP/content/version.html");    
      }             
      if (ver!=current && !firstrun){ // !firstrun ensures that this section does not get loaded if its a first run.  
        Prefs.setCharPref("version",current);  
      } else {
			// Update the server details from the preferences
			opacusSTP.updateServerInfo(false);
	  }	    
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
    this.notificationService =  
        Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]  
        .getService(Components.interfaces.nsIMsgFolderNotificationService);
        notificationService.addListener(newMailListener, notificationService.msgAdded);
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

  updateServerInfo: function(optionsWindow){
	opacusSTP.webservice = '';
	this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
         .getService(Components.interfaces.nsIPrefService)
         .getBranch("extensions.opacusSTP.");
    this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch);
    try{
		opacusSTP.sugarurl = this.prefs.getComplexValue("sugarcrm_url",Components.interfaces.nsIPrefLocalizedString).data.replace(/\/$/,'');
		opacusSTP.sugarcrm_username = this.prefs.getComplexValue("sugarcrm_username",Components.interfaces.nsIPrefLocalizedString).data;
		opacusSTP.opacus_notify = this.prefs.getBoolPref("opacus_notify");
		opacusSTP.opacus_cases = this.prefs.getBoolPref("opacus_cases");
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
				 opacusSTP.sugarcrm_password = logins[i].password;  
				 break;  
			  }  
		   }  
		}  
		catch(ex) {}  
		opacusSTP.webservice = new opacusSTPrest();	
		opacusSTP.webservice.setCredentials(opacusSTP.sugarurl,opacusSTP.sugarcrm_username,opacusSTP.sugarcrm_password);
		var serverEvent = {
			notify: function(timer) {
				opacusSTP.timer.cancel();
				opacusSTP.server_info = opacusSTP.webservice.get_server_info();
			}
		}
		opacusSTP.timer.initWithCallback(serverEvent,100,Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	}
	catch(ex){}
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
		opacusSTP.webservice.login();
		this.mails = Array();
		for(var i=0;i<this.MessageURIArray.length;i++){
			this.mails[i]		= new opacusSTPMail();
			this.mails[i].creator	= this;
			this.mails[i].uri	= this.MessageURIArray[i];
			this.mails[i].type = 'standard';
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
	opacusSTP.totalAttachments=0;
	var doAttachments = this.searchObject.searchWindow.document.getElementById('doAttachments').checked;
	var sugarObjects = this.searchObject.getCellChecked(this.searchObject.searchWindow.document.getElementById('resultList'),'resultTick');
	if(!sugarObjects){
		return false;
	}
	opacusSTP.totalMails = this.mails.length;
	opacusSTP.searchObject.searchWindow.document.getElementById('feedback').setAttribute('mode','undetermined');
	opacusSTP.searchObject.searchWindow.document.getElementById('archive_button').setAttribute('label',opacusSTP.strings.getString('archiving'));
	for(var i=0;i<this.mails.length;i++){
		worker = new opacusSTPrest();
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
				fixAlertNotification();
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
		var alertsService = Components.classes["@mozilla.org/alerts-service;1"].  
			getService(Components.interfaces.nsIAlertsService);
		alertsService.showAlertNotification(image,title,message);
		// Set up timer to find notification window and fix newlines
		var fixEvent = { notify: function(timer){
			fixNotifyTimer.cancel();
			fixAlertNotification();
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

window.addEventListener("load", opacusSTP.onLoad, false);
