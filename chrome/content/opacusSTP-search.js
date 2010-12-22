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
function opacusSTPsearch(parent,searchSuggestion,subject){
	this.parent = parent;
	this.searchSuggestion = searchSuggestion;
	this.searchString = '';
	this.subject = subject;
	this.searchWindow;
	this.searchableModules = new Array('Leads','Bugs','Contacts','Accounts','Cases','Opportunities','Project','ProjectTask');
	if(opacusSTP.server_info.flavor == 'PRO'){
		this.searchableModules.push('Quotes');
	}
	this.selectedModules;
	this.prefs;
	this.loginTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
}

opacusSTPsearch.prototype.check = function(returnFunc){
	function checkSession(){
		if(opacusSTP.session_id=='' || onceMore == true){
			searchObject.loginTimer.cancel();
			if(opacusSTP.session_id != ''){
				onceMore = false;
			}
			var event = { notify: function(timer) {
				counter++;
				if(counter < 100){
					checkSession();
				} else {
					opacusSTP.notifyUser('critical',opacusSTP.strings.getString('notifyNoLogin'));
					return;
				}
			}}
			searchObject.loginTimer.initWithCallback(event,100,Components.interfaces.nsITimer.TYPE_ONE_SHOT);
			return;
		}
		returnFunc(searchObject);
	};
	var onceMore = true;
	var searchObject = this;
	var counter = 0;
	checkSession();
};

opacusSTPsearch.prototype.search = function(){
	this.searchWindow = window.openDialog("chrome://opacusSTP/content/opacusSTP-search.xul","","chrome,height=500,width=600,resizable=yes,titlebar,centerscreen");
};


opacusSTPsearch.prototype.autoArchiveSearch = function(searchObject){
	mailObject = searchObject.mail;
	searchString = mailObject.searchSuggestion;
	var modules = new Array('Contacts','Leads');
	mailObject.worker.callback = searchObject.autoArchiveSearch_callback;
	if(opacusSTP.opacus_cases){
		var caseRegex = new RegExp(opacusSTP.strings.getString('caseRegex'),'i');
		try{
			var caseNumber = mailObject.subject.match(caseRegex)[1];
			modules.push('Cases');
		}
		catch(ex){}
	}

	mailObject.searchCalls = modules.length;
	for(var i=0;i<modules.length;i++){
		var extraSearch = '';
		var module = modules[i];
		var module_lowercase = module.toLowerCase();	
		if(module == 'Contacts' || module == 'Leads'){
			var query = module_lowercase+
				".id in (select eabr.bean_id from email_addr_bean_rel eabr"+
				" join email_addresses ea on eabr.email_address_id = ea.id where eabr.bean_module = '"+
				module+"' and ea.email_address LIKE '"+searchString+"')";
			var select_fields = new Array("first_name","last_name");
		} else {
			var query = module_lowercase +'.case_number="' + caseNumber + '"';
			var select_fields = new Array('case_number','name');
		}
		mailObject.worker.get_entry_list(module,query,select_fields[0],"0",select_fields,"1","0",mailObject);
	}
};


opacusSTPsearch.prototype.autoArchiveSearch_callback = function(response,mailObject){
	if(typeof(response.module) !== 'undefined'){
		mailObject.sugarObjects.push(response.module.toLowerCase() + ':' + response.items[0][0]);
		mailObject.sugarNames.push(response.items[0][1]);
	}
	mailObject.searchCalls--;
	if(mailObject.searchCalls == 0){
		var contactFound = false;
		var leadFound = false;
		for(var i=0;i<mailObject.sugarObjects.length;i++){
			if(/leads:/.test(mailObject.sugarObjects[i])){
				var leadLeaf = i;
				leadFound = true;
			}
			if(/contacts:/.test(mailObject.sugarObjects[i])){
				contactFound = true;
			}
		}
		if(contactFound === true && leadFound === true){
			mailObject.sugarObjects.splice(leadLeaf,1);
			mailObject.sugarNames.splice(leadLeaf,1);
		}
		if(mailObject.sugarObjects.length > 0){
			if(mailObject.direction == 'inbound'){
				mailObject.archiveMail();
			} else {
				mailObject.unixTime = Math.round(new Date().getTime() / 1000);
				mailObject.worker.callback = mailObject.archive_callback;
				mailObject.worker.archive(mailObject);
			}
			opacusSTP.notifyUser('auto',mailObject.subject + opacusSTP.strings.getString('archivedTo') + mailObject.sugarNames.join("\n"));
			opacusSTP.wrapUp(mailObject.type,mailObject.direction);
		} else {
			if(opacusSTP.opacus_notify && mailObject.type == 'auto' && mailObject.direction == 'inbound') {
				opacusSTP.notifyUser('newmail',mailObject.subject + "\n" + mailObject.author);
			}
			if(mailObject.type == 'auto' && mailObject.direction == 'outbound'){
				opacusSTP.sendAndArchiveStatus = 'unknown';
				opacusSTP.notifyUser('notify',opacusSTP.strings.getString('noAuto') + mailObject.searchSuggestion);
				mailObject.composeWindow.document.getElementById('custom-button-2').disabled = false;
				mailObject.composeWindow.GenericSendMessage.apply();
			}
		}
	}
};



opacusSTPsearch.prototype.updateSearchField = function(){
	this.searchWindow.document.getElementById('searchField').value = this.searchSuggestion;
	this.searchWindow.document.getElementById('searchField').focus();
	this.updateFields();
};

opacusSTPsearch.prototype.setPreference = function(name,value){
	this.prefs.setCharPref(name, JSON.stringify(value));
};

opacusSTPsearch.prototype.searchWindowClose = function(){
	this.setPreference("sugarcrm_selectedmodules",this.getSelectedModules());
	this.searchWindow.close();
	return true;
};

opacusSTPsearch.prototype.updateFields = function(){
	// Register preference observer function
	this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
         .getService(Components.interfaces.nsIPrefService)
         .getBranch("extensions.opacusSTP.");
    this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch);

	try
	{
		this.selectedModules = JSON.parse(this.prefs.getCharPref("sugarcrm_selectedmodules"));
	}
	catch(ex){
	}
	
	for(var i in this.searchableModules)
	{
		var row = document.createElement('listitem');
		var cell = document.createElement('listcell');
		cell.setAttribute('label',opacusSTP.strings.getString(this.searchableModules[i]));
		cell.setAttribute('id',this.searchableModules[i]);
		cell.setAttribute("onclick",
			"if(this.nextSibling.checked==false){this.nextSibling.checked=true}else{this.nextSibling.checked=false}");
		var checkbox = document.createElement('checkbox');
		row.setAttribute('allowevents','true');
		
		for(var j in this.selectedModules){
			if(this.selectedModules[j] == this.searchableModules[i]){
				checkbox.setAttribute('checked','true');
			}
		}
		row.appendChild(cell);
		row.appendChild(checkbox);
		this.searchWindow.document.getElementById('moduleList').appendChild(row);
	}
};

opacusSTPsearch.prototype.getSelectedModules = function(){	
	cells = this.searchWindow.document.getElementById('moduleList').getElementsByTagName('listcell');
	return_array = new Array();
	for( var i in cells){
		try{
			var cellLabel = cells[i].getAttribute('id');
			if(cells[i].nextSibling.checked){
				return_array.push(cellLabel);
			}
		}
		catch(ex){}
	}
	return return_array;
};


opacusSTPsearch.prototype.performSearch = function(){
	this.check(this.runSearch);
};

opacusSTPsearch.prototype.runSearch = function(searchObject){
	opacusSTP.searchChildren=0;
	var selectedModules = searchObject.getSelectedModules();
	searchObject.searchString = searchObject.searchWindow.document.getElementById('searchField').value;
	searchObject.searchWindow.document.getElementById('feedback').setAttribute('mode','undetermined');
	searchObject.searchWindow.document.getElementById('searchButton').setAttribute('label',opacusSTP.strings.getString('searching'));
	searchObject.searchString = searchObject.searchString.toLowerCase();
	resultList = searchObject.searchWindow.document.getElementById('resultList');
	while(resultList.childNodes.length >= 3){
        	resultList.removeChild( resultList.lastChild );
	}

	for(var i in selectedModules)
	{
		var extraSearch = '';
		var module = selectedModules[i];
		var module_lowercase = selectedModules[i].toLowerCase();
		if(module_lowercase =='projecttask'){
			module_lowercase = 'project_task';
		}

		if(/@/.test(searchObject.searchString)){
			var extraSearch = " OR ("+module_lowercase+
				".id in (select eabr.bean_id from email_addr_bean_rel eabr"+
				" join email_addresses ea on eabr.email_address_id = ea.id where eabr.bean_module = '"+
				module+"' and ea.email_address LIKE '"+searchObject.searchString+"'))";
		}
		
		if(module == 'Contacts' || module == 'Leads')
		{
			searchArray = searchObject.searchString.split(' ');
			if(!searchArray[1]){
				query = module_lowercase + ".first_name LIKE '" + searchObject.searchString.replace(/^\s+|\s+$/g,"") + "%' OR " +
					module_lowercase + ".last_name LIKE '" + searchObject.searchString.replace(/^\s+|\s+$/g,"") + "%'" + extraSearch;
			} else {
				query = module_lowercase+".last_name LIKE '"+searchArray[1].replace(/^\s+|\s+$/g,"") +"%' AND "+module_lowercase+
					".first_name LIKE '"+searchArray[0].replace(/^\s+|\s+$/g,"")+"%'" + extraSearch;
			}
			select_fields = new Array("first_name","last_name");
		} else {
			select_fields = new Array("name");
			var searchByNumber = '';
			if(module == 'Cases'){
				if(opacusSTP.opacus_cases){
					var caseRegex = new RegExp(opacusSTP.strings.getString('caseRegex'),'i');
					try{
						var caseNumber = searchObject.subject.match(caseRegex)[1];
						searchByNumber = ' OR (' + module_lowercase +'.case_number = "' + caseNumber + '")';
					}
					catch(ex){
						searchByNumber = ' OR (' + module_lowercase +'.case_number LIKE "' + searchObject.searchString + '%")';
					}
				} else {
					searchByNumber = ' OR (' + module_lowercase +'.case_number LIKE "' + searchObject.searchString + '%")';
				}
				select_fields.push('case_number');
			}
			query = module_lowercase+".name LIKE '%"+searchObject.searchString.replace(/^\s+|\s+$/g,"") +"%'"+extraSearch + searchByNumber;

		}
		opacusSTP.searchChildren++;
		opacusSTP.webservice.callback = searchObject.displayResults;
		opacusSTP.webservice.get_entry_list(module,query,select_fields[0],"0",select_fields,"10","0",'');
	}
};

opacusSTPsearch.prototype.displayResults = function(dataObject)
{
	opacusSTP.searchChildren--;
	if(opacusSTP.searchChildren == 0){
			opacusSTP.searchObject.searchWindow.document.getElementById('feedback').setAttribute('mode','determined');
			opacusSTP.searchObject.searchWindow.document.getElementById('searchButton').disabled=false;
			opacusSTP.searchObject.searchWindow.document.getElementById('searchButton').setAttribute('label',opacusSTP.strings.getString('search'));
	}
	if(typeof(dataObject.module) !== 'undefined'){
		var module = dataObject.module;
		var module_lowercase = module.toLowerCase();	
		var resultList = opacusSTP.searchObject.searchWindow.document.getElementById('resultList');
		resultList.appendChild(opacusSTP.searchObject.createParentListNode(opacusSTP.strings.getString(module),module_lowercase+'ParentNode'));
		for(var i in dataObject.items)
		{
			resultList.appendChild(opacusSTP.searchObject.createListNode(dataObject.items[i][1],dataObject.items[i][0],module_lowercase));
		}
	}
};

opacusSTPsearch.prototype.createParentListNode = function(label,id)
{
	var row = document.createElement('listitem');
	var cell = document.createElement('listcell');
	cell.className='parentCell';
	cell.setAttribute('label',label);
	row.appendChild(cell);

	return row;
};

opacusSTPsearch.prototype.createListNode = function(label,id,module)
{
	var row = document.createElement('listitem');
	var cell = document.createElement('listcell');
	cell.className='resultCell';
	var checkbox = document.createElement('checkbox');
	checkbox.setAttribute('id',module + ':' + id);
	checkbox.className='resultTick';
	checkbox.setAttribute('label','  ' + label);
	row.setAttribute('allowevents','true');
	row.setAttribute('flex','1');
	cell.setAttribute('flex','1');
	cell.style.overflow = 'hidden';
	checkbox.setAttribute('flex','1');

	cell.appendChild(checkbox);
	row.appendChild(cell);

	return row;
};

opacusSTPsearch.prototype.getCellChecked = function(el,className){
	var checkBoxes = el.getElementsByClassName(className);
	var arr = new Array();    
	for (var i = 0; i < checkBoxes.length; i++){  
		if (checkBoxes[i].hasAttribute('checked')){
			arr.push(checkBoxes[i].getAttribute('id'));  
		}
	}
	if(arr.length > 0){
		return arr;
	}
	opacusSTP.searchObject.searchWindow.document.getElementById('archive_button').disabled=false;
	opacusSTP.notifyUser('error',opacusSTP.strings.getString('notifyNoSugarObjects'));
	return false;  
};

