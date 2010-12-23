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
// Attachment Object

function opacusSTPAttachment(){
	this.nsiFileHandle =	'';
	this.contentType = '';
	this.contents = '';
	this.worker = '';
	this.email_id = '';
	this.path = '';
	this.type = '';
	this.mailObject = '';
	this.removeAfterSend = false;
}

opacusSTPAttachment.prototype.clear = function(){
	this.nsiFileHandle = '';
	this.contentType = '';
	this.contents = '';
	this.worker = '';
	this.email_id = '';
	this.path = '';
	this.type = '';
	this.mailObject = '';
	this.removeAfterSend = false;
};

opacusSTPAttachment.prototype.encode = function(){
	var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
		      .createInstance(Components.interfaces.nsIFileInputStream);
	inputStream.init(this.nsiFileHandle, 0x01, 0600, 0);

	var stream = Components.classes["@mozilla.org/binaryinputstream;1"]
		 .createInstance(Components.interfaces.nsIBinaryInputStream);
	stream.setInputStream(inputStream);

	var encoded = btoa(stream.readBytes(stream.available()));


	this.contents = encoded;
	if(this.removeAfterSend === true){
		this.nsiFileHandle.remove(false);
	}
	
	this.worker = new opacusSTPrest();
	this.worker.setCredentials(opacusSTP.sugarurl,opacusSTP.sugarcrm_username,opacusSTP.sugarcrm_password);
	this.worker.callback = this.createNote_callback;
	this.worker.createNote(this);
};

opacusSTPAttachment.prototype.createNote_callback = function(response,osa){
	if(response.id){
		osa.worker.callback = osa.setAttachment_callback;
		osa.worker.setAttachment(response.id,osa);
	}
};

opacusSTPAttachment.prototype.setAttachment_callback = function(response,osa){
	osa.mailObject.attachmentCalls--;
	if(osa.mailObject.relationshipCalls == 0 && osa.mailObject.attachmentCalls == 0){
		opacusSTP.wrapUp(osa.mailObject.type,osa.mailObject.direction);
	}
};


opacusSTPAttachment.prototype.checkExists = function(thisObject){
	if(!thisObject.nsiFileHandle.exists() || thisObject.nsiFileHandle.fileSize <= 0)
	{
		var event = { notify: function(timer) {
			thisObject.checkExists(thisObject);
		}}
		var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		timer.initWithCallback(event,500,Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		return;
	}
	thisObject.encode();
};
