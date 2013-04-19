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
// Mail Object
function opacusSTPMail(){
	this.msgService			= '';
	this.msgHeader			= '';
	this.subject			= '';
	this.header			= '';
	this.rawMessage			= '';
	this.rawBody			= '';
	this.recipients			= '';
	this.author			= '';
	this.authorName			= '';
	this.unixTime			= '';
	this.ccList			= '';
	this.folderName			= '';
	this.searchSuggestion		= '';
	this.html			= '';
	this.plain			= '';
	this.files			= '';
	this.uri			= '';
	this.doAttachments		= '';
	this.worker			= '';
	this.mime_parts			= '';
	this.type				= '';
	this.direction			= '';
	this.archivedNames		= '';
	this.searchCalls		=	0;
	this.relationshipCalls	=	0;
	this.attachmentCalls	=	0;
	this.outboundAttachments = new Array();
	this.sugarObjects		= new Array();
	this.sugarNames			= new Array();
};


opacusSTPMail.prototype.parseContacts = function(contacts){
	var recips = contacts.split(',');
	for(var i=0;i<recips.length;i++){
		if(/<[^>]+>/.test(recips[i])){
			recips[i] = recips[i].match(/<[^>]+>/);
		}
	}
	var addrs = recips.join(';');
	return addrs.replace(/>/g,'').replace(/</g,'').replace(/ /g,'');
};

	
opacusSTPMail.prototype.parseAuthor = function(){
	if(/<[^>]+>/.test(this.author)){
		this.authorName = this.author.replace(/<[^>]+>.*/,'').replace(/^\s\s*/,'').replace(/\s\s*$/,'');
		this.authorName = this.authorName.replace(/^"/,'').replace(/"$/,'');
		this.author = this.author.match(/<[^>]+>/).join();
		this.author = this.author.replace(/>/,'').replace(/</,'').replace(/ /g,'');
	} else if(/\([^\)]+\)/.test(this.author)) {
		this.authorName = this.author.match(/\(([^\)]+)\)/)[1];
		this.author = this.author.replace(/\s?\([^\)]+\)/,'');
	} else {
		this.authorName = '';
	}
};


opacusSTPMail.prototype.suggestSearch = function(displayRecipients){
	if(displayRecipients){
		this.searchSuggestion = this.recipients.match(/^[^;]+/);
	} else {
		this.searchSuggestion = this.author;
	}
};


opacusSTPMail.prototype.parseHeader = function(){
	this.msgService = messenger.messageServiceFromURI(this.uri);
	this.msgHeader = this.msgService.messageURIToMsgHdr(this.uri);
	this.subject = this.msgHeader.mime2DecodedSubject != '' ? this.msgHeader.mime2DecodedSubject : this.msgHeader.subject;
	const MsgFlagHasRe = 0x0010; // MSG_FLAG_HAS_RE
	if(this.msgHeader.flags & MsgFlagHasRe){
		this.subject = opacusSTP.strings.getString('re') + ' ' + this.subject;
	}
	this.recipients = this.msgHeader.mime2DecodedRecipients != '' ? this.msgHeader.mime2DecodedRecipients : this.msgHeader.recipients;
	this.author = this.msgHeader.mime2DecodedAuthor != '' ? this.msgHeader.mime2DecodedAuthor : this.msgHeader.author;
	this.ccList = this.msgHeader.ccList;
	this.unixTime = this.msgHeader.dateInSeconds;
	this.folderName = this.msgHeader.folder.prettiestName;
	this.recipients = this.parseContacts(this.recipients);
	this.ccList = this.parseContacts(this.ccList);
	this.parseAuthor();
};

opacusSTPMail.prototype.populateFromCompose = function(composeWindow){
	this.author = composeWindow.document.getElementById('msgIdentity').label;
	this.subject = composeWindow.document.getElementById('msgSubject').value;
	this.html = composeWindow.document.getElementById("content-frame").contentDocument.lastChild.lastChild.innerHTML;
	var totalAddresses = composeWindow.document.getElementsByClassName('addressingWidgetItem').length;
	var bucket = composeWindow.document.getElementById("attachmentBucket");
	var attachments = bucket.childNodes;
	for(var i=0;i<attachments.length;i++){
		var details = {
			url:attachments[i].attachment.url,
			name:attachments[i].attachment.name
		}
		this.outboundAttachments.push(details);
	}
	var to_addr = new Array();
	var cc_addr = new Array();
	var bcc_addr = new Array();
	for(var i=0;i < totalAddresses;i++){
		var j = i+1;
		var addrType = composeWindow.document.getElementById('addressCol1#' + j).value;
		var addrValue = composeWindow.document.getElementById('addressCol2#' + j).value.replace(',','');
		if(addrValue != ''){
			switch(addrType) {
				case 'addr_to':
					to_addr.push(addrValue);
					break;
				case 'addr_cc':
					cc_addr.push(addrValue);
					break;
				case 'addr_reply':
					break;
				case 'addr_bcc':
					bcc_addr.push(addrValue);
					break;
				default:
			}
		}
	}
	this.recipients = this.parseContacts(to_addr.join(','));
	this.ccList = this.parseContacts(cc_addr.join(','));
	this.bccList = this.parseContacts(bcc_addr.join(','));
	this.parseAuthor();
	this.searchSuggestion = this.parseContacts(to_addr[0]);
};

opacusSTPMail.prototype.archiveMail = function(){
	this.parseHeader();
	opacusSTP.mailsToTag.appendElement(this.msgHeader, false);

	MsgHdrToMimeMessage(this.msgHeader,this,
		function(aMsgHdr,aMimeMsg){
			this.mimeCallback(aMimeMsg,aMsgHdr,this);
		}
		,true
        ,{"examineEncryptedParts":true}
	);
};

opacusSTPMail.prototype.mimeCallback = function(aMimeMsg,aMsgHdr,mailObject){
		mailObject.html = mailObject.getBodyParts(aMimeMsg.parts,/html/);
		mailObject.plain = mailObject.getBodyParts(aMimeMsg.parts,/plain/);
		mailObject.mime_parts = aMimeMsg.parts;

		// Archive message and attachments (if present)
		this.worker.callback = this.archive_callback;
		this.worker.archive(mailObject);
};


opacusSTPMail.prototype.archive_callback = function(response,mailObject){
	if(typeof(response.id) !== 'undefined'){
		if(mailObject.doAttachments){
			if(mailObject.direction == 'outbound'){
				mailObject.getOutboundAttachments(response.id);
			} else {
				mailObject.getAttachments(response.id,mailObject.mime_parts);
			}
		}
		if(mailObject.direction == 'outbound'){
			opacusSTP.sendAndArchiveStatus = 'success';
			mailObject.composeWindow.GenericSendMessage.apply();
			opacusSTP.sendAndArchiveStatus = 'unknown';
		}
		for(var i=0; i < mailObject.sugarObjects.length; i++){
			mailObject.relationshipCalls++;
			var sugarObjectArray = mailObject.sugarObjects[i].split(':');
			mailObject.worker.callback = mailObject.createRelationship_callback;
			mailObject.worker.createRelationship(response.id,sugarObjectArray[0],sugarObjectArray[1],mailObject);
		}
	} else if(typeof(mailObject.subject) !== 'undefined') {
		opacusSTP.console.logStringMessage("OpacusSTP received no email id: "+JSON.stringify(response));
		opacusSTP.notifyUser('error',opacusSTP.strings.getString('notifyNoArchive') + ' ' + mailObject.subject);
	}
};


opacusSTPMail.prototype.createRelationship_callback = function(response,mailObject){
	mailObject.relationshipCalls--;
	if(mailObject.relationshipCalls == 0){
		if(!mailObject.doAttachments){
			opacusSTP.wrapUp(mailObject.type,mailObject.direction);
		} else {
			if(mailObject.attachmentCalls == 0){
				opacusSTP.wrapUp(mailObject.type,mailObject.direction);
			}
		}
	}
};

opacusSTPMail.prototype.getOutboundAttachments = function(email_id){
	if(this.outboundAttachments.length == 0){
		return;
	}
	this.attachmentCalls = this.outboundAttachments.length;
	for(var i=0;i<this.outboundAttachments.length;i++){
		var osa = new opacusSTPAttachment();
		osa.clear();
		osa.type = 'outbound';
		osa.removeAfterSend = false;
		osa.filename = this.outboundAttachments[i].name;
		osa.email_id = email_id;
		osa.mailObject = this;
		var protocolhandler = Components.classes["@mozilla.org/network/protocol;1?name=file"].
			createInstance(Components.interfaces.nsIFileProtocolHandler);
		osa.nsiFileHandle = protocolhandler.getFileFromURLSpec(this.outboundAttachments[i].url);
		osa.encode();
	}
};

opacusSTPMail.prototype.getAttachments = function(email_id,mime_parts){
	var mailObject = this;
	var Olistener = {
		OnStartRunningUrl: function(url){
			// Empty function to avoid exception
		},
		OnStopRunningUrl: function(url){
			try{
				// Some attachments are email parts and don't match regex (they get archived
				// as part of the plain body) so bail at this point into catch.
				var filename = url.spec.match(/.+filename=(.+)$/)[1];
				var savedFile = Components.classes["@mozilla.org/file/directory_service;1"]
					.getService(Components.interfaces.nsIProperties)
					.get("TmpD", Components.interfaces.nsIFile);
				savedFile.append(email_id + filename);
				var osa = new opacusSTPAttachment();
				osa.filename = decodeURIComponent(filename);
				osa.email_id = email_id;
				osa.removeAfterSend = true;
				osa.mailObject = mailObject;
				osa.nsiFileHandle = savedFile;
				if(osa.nsiFileHandle.fileSize > 0){
					osa.checkExists(osa);
				} else {
					try{
						osa.nsiFileHandle.remove(false);
					}
					catch(ex){
						dump("Failed to remove file\n");
					}
					mailObject.attachmentCalls--;
					if(mailObject.relationshipCalls == 0 && mailObject.attachmentCalls == 0){
						opacusSTP.wrapUp(mailObject);
					}
				}
			}
			catch(ex){
				mailObject.attachmentCalls--;
				if(mailObject.relationshipCalls == 0 && mailObject.attachmentCalls == 0){
					opacusSTP.wrapUp(mailObject);
				}
			}
		},
	};
	if(typeof(mime_parts) !== 'undefined'){
		for(var i=0;i<mime_parts.length;i++){
			if(typeof(mime_parts[i].url) !== 'undefined'){
				var file = Components.classes["@mozilla.org/file/directory_service;1"]
					.getService(Components.interfaces.nsIProperties)
					.get("TmpD", Components.interfaces.nsIFile);
				var attFilename = encodeURIComponent(mime_parts[i].name);
				attFilename = attFilename.replace(new RegExp(/\(/g),'%28');
				attFilename = attFilename.replace(new RegExp(/\)/g),'%29');
				attFilename = attFilename.replace(new RegExp("'",'g'),"%27");
				attFilename = attFilename.replace(new RegExp("!",'g'),"%21");
				file.append(email_id + attFilename);
				file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);
				this.attachmentCalls++;
				messenger.saveAttachmentToFile(
					file,
					mime_parts[i].url,
					this.uri,
					mime_parts[i].contentType,
					Olistener
				);
			}
			if(typeof(mime_parts[i].parts) !== 'undefined'){
				this.getAttachments(email_id,mime_parts[i].parts);
			}
		}
	}
};



opacusSTPMail.prototype.getBodyParts = function(mimeMsgParts,ContentTypeRegex){
	var mimeBody = '';
	if(typeof(mimeMsgParts) != 'undefined'){
		for(var i=0;i<mimeMsgParts.length;i++){
			if (ContentTypeRegex.test(mimeMsgParts[i].contentType)){
				if(typeof(mimeMsgParts[i].body) != 'undefined'){
					mimeBody += mimeMsgParts[i].body;
				}
			}
			if(typeof(mimeMsgParts[i].parts) != 'undefined'){
				mimeBody += this.getBodyParts(mimeMsgParts[i].parts,ContentTypeRegex);
			}
			
		 }
	 }
	 return mimeBody;
};


opacusSTPMail.prototype.formatDate =function(timestamp){
	var d = new Date();
	timestamp = parseInt(timestamp) * 1000;
	d.setTime(timestamp);
	function pad(n){return n<10 ? '0'+n : n}
	return d.getUTCFullYear()+'-'
      + pad(d.getUTCMonth()+1)+'-'
      + pad(d.getUTCDate())+' '
      + pad(d.getUTCHours())+':'
      + pad(d.getUTCMinutes())+':'
      + pad(d.getUTCSeconds());
};


opacusSTPMail.prototype.clear = function(){
	this.msgService			= '';
	this.msgHeader			= '';
	this.subject			= '';
	this.header			= '';
	this.rawMessage			= '';
	this.rawBody			= '';
	this.recipients			= '';
	this.author			= '';
	this.authorName			= '';
	this.unixTime			= '';
	this.ccList			= '';
	this.folderName			= '';
	this.searchSuggestion		= '';
	this.html			= '';
	this.plain			= '';
	this.files			= '';
	this.uri			= '';
	this.doAttachments		= '';
	this.worker			= '';
	this.mime_parts			= '';
	this.type				= '';
	this.direction			= '';
	this.archivedNames		= '';
	this.searchCalls		=	0;
	this.relationshipCalls	=	0;
	this.attachmentCalls	=	0;
	this.outboundAttachments = new Array();
	this.sugarObjects		= new Array();
	this.sugarNames			= new Array();
};

