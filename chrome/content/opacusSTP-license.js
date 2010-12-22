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
// Licence Object

function opacusSTPlicence(){
}

opacusSTPlicence.prototype.check = function(user_licence_key){
	var expDate = this.decode36(opacusSTP.licence_key.substring(32));
	var d = new Date();

	function pad(n){return n<10 ? '0'+n : n}
	currentDateStamp = d.getUTCFullYear().toString()+pad(d.getUTCMonth()+1).toString() +pad(d.getUTCDate()).toString();


	
	if(this.md5(user_licence_key.toLowerCase() + expDate).toLowerCase() == opacusSTP.licence_key.substring(0,32).toLowerCase()){
		if(parseInt(currentDateStamp) > parseInt(expDate)){
			opacusSTP.notifyUser('critical',opacusSTP.strings.getString('notifyLicenceExpired'));
			return false;
		}
		return true;
	}
	return false;
};

opacusSTPlicence.prototype.decode36 = function(codedString){
	codedString = codedString.toLowerCase();
	charMap = '0123456789abcdefghijklmnopqrstuvwxyz';
	var multiplier = 1;
	var total = 0;
	for(var i=codedString.length-1;i >= 0;i--){
		thisChar = codedString.charAt(i);
		charNo = charMap.indexOf(thisChar);
		total += multiplier * charNo;
		multiplier *= 36;
	}
	return total;
}

opacusSTPlicence.prototype.md5 = function(str){
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

opacusSTPlicence.prototype.toHexString = function(charCode){
  return ("0" + charCode.toString(16)).slice(-2);
};
