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
	stream.close();
	inputStream.close();


	this.contents = encoded;
	if(this.removeAfterSend === true){
		try{
			this.nsiFileHandle.remove(false);
		}
		catch(ex){
			dump("Failed to remove file\n");
		}
	}
	
	this.worker = new opacusSTPrest();
	this.worker.setCredentials(opacusSTP.sugarurl,opacusSTP.sugarcrm_username,opacusSTP.sugarcrm_password);
	this.worker.callback = this.createNote_callback;

	this.worker.createNote(this);
};

opacusSTPAttachment.prototype.createNote_callback = function(response,osa){
	if(typeof(response.id) !== 'undefined'){
		osa.worker.callback = osa.setAttachment_callback;
		osa.worker.setAttachment(response.id,osa);
	} else {
		// Something went wrong. Remove attachment from counter.
		osa.mailObject.attachmentCalls--;
		if(osa.mailObject.relationshipCalls == 0 && osa.mailObject.attachmentCalls == 0){
			opacusSTP.wrapUp(osa.mailObject);
		}
	}
};

opacusSTPAttachment.prototype.setAttachment_callback = function(response,osa){
	osa.mailObject.attachmentCalls--;
	if(osa.mailObject.relationshipCalls == 0 && osa.mailObject.attachmentCalls == 0){
		opacusSTP.wrapUp(osa.mailObject.type,osa.mailObject.direction);
	}
};


opacusSTPAttachment.prototype.checkExists = function(thisObject){
	if(!thisObject.nsiFileHandle.exists())
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
