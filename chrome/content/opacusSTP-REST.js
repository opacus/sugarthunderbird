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
function opacusSTPrest(){	
	this.webservice_url = '';
	this.user_name = '';
	this.password = '';
};

opacusSTPrest.prototype.setCredentials = function(ws_url,ws_username,ws_password){
	this.webservice_url = ws_url + '/service/v2/rest.php';
	this.user_name = ws_username;
	this.password = ws_password;
};

opacusSTPrest.prototype.get_server_info = function(){
	var rest_data = {};
	this.callback=this.get_server_info_callback;
	this.makeRequest('get_server_info',rest_data,'');
};

opacusSTPrest.prototype.get_server_info_callback = function(response,extraData){
	opacusSTP.server_info = response;
};

opacusSTPrest.prototype.login = function(){
	if(opacusSTP.session_id == ""){
		this.full_login();
	} else {
		var rest_data = opacusSTP.session_id;
		this.callback = this.login_callback;
		this.makeRequest('seamless_login',rest_data,'');
	}
};

opacusSTPrest.prototype.login_callback = function(response,extraData){
	if(!response.result == 1){
		this.full_login();
	}
};

opacusSTPrest.prototype.full_login = function(){
	var rest_data = {
		user_auth : {
			user_name : this.user_name,
			password : this.md5(this.password)
		},
		application_name : 'Opacus STP',
		name_value_list : []
	};
	this.callback = this.full_login_callback;
	this.makeRequest('login',rest_data,'');
};

opacusSTPrest.prototype.full_login_callback = function(response,extraData){
	if(response.status == 'success'){
		opacusSTP.session_id = response.session_id;
		opacusSTP.user_id = response.user_id;
	} else {
		opacusSTP.notifyUser('critical',opacusSTP.strings.getString('notifyNoLogin'));
	}
};

opacusSTPrest.prototype.makeRequest = function(method,rest_data,extraData){
	var client = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                        .createInstance(Components.interfaces.nsIXMLHttpRequest);
    rest_data = JSON.stringify(rest_data);
	rest_data = escape(rest_data);
	rest_data = rest_data.replace(new RegExp('\\+','g'),'%2B');
	rest_data = rest_data.replace(new RegExp('%20','g'),'+');

	var params = 'method=' + method + '&input_type=JSON&response_type=JSON&rest_data=' + rest_data;

	client.open("POST", this.webservice_url, true);
	client.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	client.setRequestHeader("Content-length", params.length);
	client.setRequestHeader("Connection", "close");

	client.webserviceReference = this;
	client.method = method;
	client.extraData = extraData;

	client.onreadystatechange = function(){
		if(client.readyState == 4) {
			if(client.status == 200){
				client.webserviceReference.callback(client.webserviceReference.parseResponse(JSON.parse(client.responseText),client.method),client.extraData);
			} else {
				opacusSTP.notifyUser('critical',opacusSTP.strings.getString('notifyNoConnect'));
			}
		}
	}
	client.send(params);
};

opacusSTPrest.prototype.parseResponse = function(data,method){
	var return_object = new Object();
	switch(method){
		case "get_server_info":
		case "set_note_attachment" :
			return_object = data;
			break;
		case "set_entry" :
			return_object = data;
			break;
		case "set_relationship" :
			return_object = data;
			break;
		case "get_entry_list" :
			if(typeof(data.entry_list[0]) !== 'undefined'){
				return_object.module = data.entry_list[0].module_name;
				return_object.items = new Array();
				if(return_object.module == 'Contacts' || return_object.module == 'Leads'){
					for(var i in data.entry_list){
						var first_name = (data.entry_list[i].name_value_list.first_name.value) ? data.entry_list[i].name_value_list.first_name.value + ' ' : '(...) ';
						return_object.items[i] = new Array(data.entry_list[i].id,
							first_name + data.entry_list[i].name_value_list.last_name.value);
					}
				} else if(return_object.module == 'Cases'){
					for(var i in data.entry_list){
						return_object.items[i] = new Array(data.entry_list[i].id,
							data.entry_list[i].name_value_list.case_number.value + ' ' + data.entry_list[i].name_value_list.name.value);
					}
				} else {
					for(var i in data.entry_list){
						return_object.items[i] = new Array(data.entry_list[i].id,data.entry_list[i].name_value_list.name.value);
					}
				}
			}
			break;
		case "login" :
			if(data.name != 'Invalid Login'){
				return_object.session_id = data.id;
				return_object.user_id = data.name_value_list.user_id.value;
				return_object.status = 'success';
			}
			break;
		case "seamless_login" :
			return_object.result = data;
			break;
		default	:
	}
	return return_object;
};

opacusSTPrest.prototype.get_entry_list = function(module,query,order_by,offset,select_fields,max_results,deleted,extraData){

	var rest_data = {
		"session"	: opacusSTP.session_id,
		"module"	: module,
		"query"		: query,
		"order_by"	: order_by,
		"offset"	: offset,
		"select_fields"	: select_fields,
		"link_name_to_fields_array" : new Array(),
		"max_results"	: max_results,
		"deleted"	: deleted,
	};
	this.makeRequest('get_entry_list',rest_data,extraData);
};

opacusSTPrest.prototype.archive = function(mailObject){

	var rest_data = {
		"session"	: opacusSTP.session_id,
		"module"	: 'Emails',
		"name_value_list" : {
			"assigned_user_id" : opacusSTP.user_id,
			"status" : "archived",
			"name"		: mailObject.subject,
			"description"		: mailObject.plain,
			"description_html"	: mailObject.html,
			"to_addrs"	: mailObject.recipients,
			"cc_addrs"	: mailObject.ccList,
			"bcc_addrs"	: mailObject.bccList,
			"from_addr" : mailObject.author,
			"from_addr_name" : mailObject.authorName,
			"date_sent" : mailObject.formatDate(mailObject.unixTime)
		}
	};
	this.makeRequest('set_entry',rest_data,mailObject);
};


opacusSTPrest.prototype.createRelationship = function(emailId,moduleLower,objectId,mailObject){	
	var rest_data = {
		"session"	: opacusSTP.session_id,
		"module_name"	: 'Emails',
		"module_id" : emailId,
		"link_field_name"		: moduleLower,
		"related_ids"		: [ objectId ]
	};
	this.makeRequest('set_relationship',rest_data,mailObject);
};


opacusSTPrest.prototype.createNote = function(osa){

	var rest_data = {
		"session"	: opacusSTP.session_id,
		"module"	: 'Notes',
		"name_value_list" : {
			"name"		: osa.filename,
			"parent_type"		: 'Emails',
			"parent_id"	: osa.email_id,
		}
	};
	this.makeRequest('set_entry',rest_data,osa);
};


opacusSTPrest.prototype.setAttachment = function(note_id,osa){

	var rest_data = {
		"session"	: opacusSTP.session_id,
		"note":	{
			"filename"	: osa.filename,
			"file"	: osa.contents,
			"id"	: note_id
		}
	};
	this.makeRequest('set_note_attachment',rest_data,osa);
};


opacusSTPrest.prototype.md5 = function(str){
	var converter =
	Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
	createInstance(Components.interfaces.nsIScriptableUnicodeConverter);

	converter.charset = "UTF-8";
	var result = {};
	var data = converter.convertToByteArray(str, result);
	var ch = Components.classes["@mozilla.org/security/hash;1"]
					   .createInstance(Components.interfaces.nsICryptoHash);
	ch.init(ch.MD5);
	ch.update(data, data.length);
	var hash = ch.finish(false);

	return [this.toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
};

opacusSTPrest.prototype.toHexString = function(charCode){
  return ("0" + charCode.toString(16)).slice(-2);
};


