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
function opacusSTPsearch(parent,searchSuggestion,subject){
	this.parent = parent;
	this.searchSuggestion = searchSuggestion;
	this.searchString = '';
	this.subject = subject;
	this.searchWindow;
	this.searchableModules = new Array('Leads','Bugs','Contacts','Accounts','Cases','Opportunities','Project','ProjectTask');
	if (opacusSTP.server_info.flavor == 'PRO' || opacusSTP.server_info.flavor == 'ENT') {
		this.searchableModules.push('Quotes');
	}
	this.selectedModules;
	this.prefs;
	this.loginTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
}

opacusSTPsearch.prototype.check = function(returnFunc){
	function checkSession(onceMore){
		if(opacusSTP.session_id=='' || onceMore == true || opacusSTP.webservice.waitingForLogin == true){
			searchObject.loginTimer.cancel();
			if(opacusSTP.session_id != ''){
				onceMore = false;
			}
			var event = { notify: function(timer) {
				counter++;
				if(counter < 100){
					checkSession(onceMore);
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
		var row = document.createElement('richlistitem');
        row.value = this.searchableModules[i];

        var label = document.createElement('label');
        label.value = opacusSTP.strings.getString(this.searchableModules[i]);

		var moduleList = this.searchWindow.document.getElementById('moduleList');
        moduleList.appendChild(row);
        row.appendChild(label);
		for(var j in this.selectedModules){
			if(this.selectedModules[j] == this.searchableModules[i]){
                moduleList.addItemToSelection(row);
			}
		}
	}
};

opacusSTPsearch.prototype.getSelectedModules = function(){	
	var items = this.searchWindow.document.getElementById('moduleList').selectedItems;
	var return_array = [];
    if (items !== null) {
        for(var i in items){
            if (items[i].value) {
                return_array.push(items[i].value);
            }
        }
    }
	return return_array;
};


opacusSTPsearch.prototype.performSearch = function(){
	opacusSTP.webservice.login();
	this.check(this.runSearch);
};

opacusSTPsearch.prototype.runSearch = function(searchObject){
	var query;
	var select_fields;
	opacusSTP.searchChildren=0;
	var selectedModules = searchObject.getSelectedModules();
	searchObject.searchString = searchObject.searchWindow.document.getElementById('searchField').value;
	searchObject.searchWindow.document.getElementById('feedback').setAttribute('mode','undetermined');
	searchObject.searchWindow.document.getElementById('searchButton').setAttribute('label',opacusSTP.strings.getString('searching'));
	searchObject.searchString = searchObject.searchString.toLowerCase().replace(/'/g, "\\'");
	var resultList = searchObject.searchWindow.document.getElementById('resultList');
	while(resultList.childNodes.length > 0){
        	resultList.removeChild( resultList.lastChild );
	}

	for(var i in selectedModules)
	{
		var searchArray;
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
						searchByNumber = ' OR (' + module_lowercase +".case_number = '" + caseNumber + "')";
					}
					catch(ex){
						searchByNumber = ' OR (' + module_lowercase +".case_number LIKE '" + searchObject.searchString + "%')";
					}
				} else {
					searchByNumber = ' OR (' + module_lowercase +".case_number LIKE '" + searchObject.searchString + "%')";
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
		opacusSTP.searchObject.createParentListNode(resultList,module);
		for(var i in dataObject.items)
		{
			resultList.appendChild(opacusSTP.searchObject.createListNode(dataObject.items[i][1],dataObject.items[i][0],module_lowercase));
		}
	}
};

opacusSTPsearch.prototype.createParentListNode = function(resultBox,module)
{
	var module_lowercase = module.toLowerCase();
	var id = module_lowercase+"ParentNode";
	if(opacusSTP.searchObject.searchWindow.document.getElementById(id) == null ){
		var labelText = module;
		var row = document.createElement('richlistitem');
        row.style.padding = '4px';
        row.style.borderBottom = '1px solid #BBB';
		var label = document.createElement('label');
        label.setAttribute('value', labelText);
		row.setAttribute('id',id);
        var span = document.createElement('html:span');
        span.className = 'moduleIcon moduleIcon' + module;
        span.appendChild(document.createTextNode(module.slice(0,2)));
        row.appendChild(span);
		row.appendChild(label);
		resultBox.appendChild(row);
        row.disabled = true;
	}
	return false
};

opacusSTPsearch.prototype.createListNode = function(label,id,module)
{
	var row = document.createElement('richlistitem');
    var recordName = document.createElement('label');
	row.id = module + ':' + id;
	recordName.value = '  ' + label.replace(/&#039;/g,"'").replace(/&quot;/g,'"');
	row.setAttribute('allowevents','true');
	row.appendChild(recordName);

	return row;
};

opacusSTPsearch.prototype.getCellChecked = function() { 
	var items = opacusSTP.searchObject.searchWindow.document.getElementById('resultList').selectedItems;
	var return_array = [];
    if (items !== null) {
        for(var i in items){
            if (items[i].id) {
                return_array.push(items[i].id);
            }
        }
    }
    if (return_array.length > 0) {
	    return return_array;
    }

	opacusSTP.searchObject.searchWindow.document.getElementById('archive_button').disabled=false;
	opacusSTP.notifyUser('error',opacusSTP.strings.getString('notifyNoSugarObjects'));
	return false;  
};
