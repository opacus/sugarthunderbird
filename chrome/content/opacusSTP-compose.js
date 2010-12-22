/*********************************************************************************
 * The contents of this file are subject to the Opacus Licence, available at
 * http://www.opacus.co.uk/licence or available on request.
 * By installing or using this file, You have unconditionally agreed to the
 * terms and conditions of the License, and You may not use this file except in
 * compliance with the License.  Under the terms of the license, You shall not,
 * among other things: 1) sublicense, resell, rent, lease, redistribute, assign
 * or otherwise transfer Your rights to the Software. Use of the Software
 * may be subject to applicable fees and any use of the Software without first
 * paying applicable fees is strictly prohibited.  You do not have the right to
 * remove Opacus copyrights from the source code.
 *
 * The software is provided "as is", without warranty of any kind, express or
 * implied, including but not limited to the warranties of merchantability,
 * fitness for a particular purpose and noninfringement. In no event shall the
 * authors or copyright holders be liable for any claim, damages or other
 * liability, whether in an action of contract, tort or otherwise, arising from,
 * out of or in connection with the software or the use or other dealings in
 * the software.
 *
 * Portions created by Opacus are Copyright (C) 2010 Mathew Bland, Jonathan Cutting
 * Opacus Ltd.
 * All Rights Reserved.
 ********************************************************************************/
// Compose

function SendObserver() {
	var wMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	this.parentWindow = wMediator.getMostRecentWindow("mail:3pane");
	this.register();
}

SendObserver.prototype = {
  observe: function(subject, topic, data) {

     /* thunderbird sends a notification even when it's only saving the message as a draft.
      * We examine the caller chain to check for valid send notifications 
      */
     var f = this.observe;
     while (f) {
       if(/Save/.test(f.name)) {
		   alert(f.name);
           return;
       }
       f = f.caller;
     }
     
	// add your headers here, separated by \r\n
	if(this.parentWindow.opacusSTP.sendAndArchiveStatus == 'success'){
		subject.gMsgCompose.compFields.otherRandomHeaders += "X-Opacus-Archived: onsend\r\n"; 
	} else {
		subject.gMsgCompose.compFields.otherRandomHeaders += "X-Opacus-Archived: none\r\n";
	}

		
  },
  register: function() {
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                          .getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(this, "mail:composeOnSend", false);
  },
  unregister: function() {
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                            .getService(Components.interfaces.nsIObserverService);
    observerService.removeObserver(this, "mail:composeOnSend");
  }
};


/*
 * Register observer for send events. Check for event target to ensure that the 
 * compose window is loaded/unloaded (and not the content of the editor).
 * 
 * Unregister to prevent memory leaks (as per MDC documentation).
 */
var sendObserver;
window.addEventListener('load', function (e) {if (e.target == document) sendObserver = new SendObserver(); }, true);
window.addEventListener('unload', function (e) { if (e.target == document) sendObserver.unregister();}, true);




