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
	if(opacusSTP.server_info.flavor == 'PRO'){
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
		var cell = document.createElement('listcell');
		var checkbox = document.createElement('checkbox');
		
		checkbox.setAttribute('label',opacusSTP.strings.getString(this.searchableModules[i]));
		checkbox.setAttribute('id',this.searchableModules[i]);
		checkbox.setAttribute('flex','1');
		row.setAttribute('allowevents','true');

		for(var j in this.selectedModules){
			if(this.selectedModules[j] == this.searchableModules[i]){
				checkbox.setAttribute('checked','true');
			}
		}

		cell.appendChild(checkbox);
		row.appendChild(cell);
		this.searchWindow.document.getElementById('moduleList').appendChild(row);
	}
};

opacusSTPsearch.prototype.getSelectedModules = function(){	
	var checkboxes = this.searchWindow.document.getElementById('moduleList').getElementsByTagName('checkbox');
	var return_array = new Array();
	for(var i in checkboxes){
		try{
			var cellLabel = checkboxes[i].getAttribute('id');
			if(checkboxes[i].checked){
				return_array.push(cellLabel);
			}
		}
		catch(ex){}
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
		resultList.appendChild(opacusSTP.searchObject.createParentListNode(opacusSTP.strings.getString(module),module_lowercase+'ParentNode'));
		for(var i in dataObject.items)
		{
			resultList.appendChild(opacusSTP.searchObject.createListNode(dataObject.items[i][1],dataObject.items[i][0],module_lowercase));
		}
	}
};

opacusSTPsearch.prototype.createParentListNode = function(label,id)
{
    var row = document.createElement('richlistitem');
    row.style.fontWeight = '700';
    row.style.margin = '2px';
    row.style.padding = '2px';
    row.style.borderBottom = '1px solid #BBB';
    var labelEl = document.createElement('label');
    labelEl.setAttribute('value', label);
    row.appendChild(labelEl);

    return row;
};

opacusSTPsearch.prototype.createListNode = function(label,id,module)
{
	var row = document.createElement('richlistitem');
	var cell = document.createElement('listcell');
	cell.className='resultCell';
	var checkbox = document.createElement('checkbox');
	checkbox.setAttribute('id',module + ':' + id);
	checkbox.className='resultTick';
	checkbox.setAttribute('label','  ' + label.replace(/&#039;/g,"'").replace(/&quot;/g,'"'));
	row.setAttribute('allowevents','true');
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
