var is_server = Main.isServer();
var is_idaccess = Main.isIdAccess();
var is_idflex = Main.isIdFlex();
var qrcode_alpha = Main.isQRCodeModeAlpha();

var _wiegandCardBits = 16;
var _wiegandFacilityBits = 8;
var _wiegandTotalBits = 26;
var _wiegandFormat = null;

(function loadWiegandConfig() {
	try {
		var all_wiegand_modes = MessengerUtil.send('load_objects', { object: 'wiegand_modes' });
		var data = MessengerUtil.send('get_configuration', { wiegand: ['wiegand_format_size'] });
		if (data && data.wiegand && all_wiegand_modes && all_wiegand_modes.wiegand_modes) {
			var wiegand_mode = data.wiegand.wiegand_format_size;
			var wiegand_info = all_wiegand_modes.wiegand_modes.find(function(mode) {
				return mode.name === wiegand_mode;
			});
			if (wiegand_info && wiegand_info.format) {
				_wiegandTotalBits = wiegand_info.size || 26;

				var cardMatch = wiegand_info.format.match(/C\[(\d+):(\d+)\]/);
				if (cardMatch) {
					var cardStart = parseInt(cardMatch[1], 10);
					var cardEnd = parseInt(cardMatch[2], 10);
					_wiegandCardBits = cardEnd - cardStart + 1;
				}

				var facilityMatch = wiegand_info.format.match(/F\[(\d+):(\d+)\]/);
				if (facilityMatch) {
					var facilityStart = parseInt(facilityMatch[1], 10);
					var facilityEnd = parseInt(facilityMatch[2], 10);
					_wiegandFacilityBits = facilityEnd - facilityStart + 1;
				} else {
					_wiegandFacilityBits = 0;
				}

				_wiegandFormat = {
					totalBits: _wiegandTotalBits,
					cardBits: _wiegandCardBits,
					cardStart: cardMatch ? parseInt(cardMatch[1], 10) : 0,
					cardEnd: cardMatch ? parseInt(cardMatch[2], 10) : 0,
					facilityBits: _wiegandFacilityBits,
					facilityStart: facilityMatch ? parseInt(facilityMatch[1], 10) : 0,
					facilityEnd: facilityMatch ? parseInt(facilityMatch[2], 10) : 0
				};
			}
		}
	} catch (e) {
		// Keep default on error
	}
})();
var _wiegandCardMask = Math.pow(2, _wiegandCardBits);

function card_types(){
	const types = [
		{'PK': 1,  'description': 'Code and Area', 'getValue': function(key) { return key }},
		{'PK': 2, 'description': 'Decimal Value', 'getValue': function(key) { return key }},
		{'PK': 3, 'description': 'Hexadecimal Value', 'getValue': function(key) { return key }}
	];
	const types_mifare = types.slice(1, 3);
	this.values = Main.isMifare() ? types_mifare : types;
	this.load = function (params) {
		var $value = '';
		$.each(this.values, function (key, val) {
			if (params.value == val.PK) {
				$value = val;
				return false;
			}
		});
		this.object = $value;
	};
	this.setValue = function () {	};
	this.getValue = function(key) {
		return this.object[key] ? this.object[key] : '';
	};
	this.count = function(options, fun) {
		fun(this.values.length);
	};
	this.list = function(options, fun) {
		fun(this.values, true);
	}
	this.PK = 'PK';
}

function codeAreaToDecimal(area, code){
	if(!area)
		area = 0;
	if(!code)
		code = 0;
	return BigInt((area * _wiegandCardMask) + code);
}

function codeAreaToHex(area, code){
	if(!area)
		area = 0;
	if(!code)
		code = 0;
	return "0x" + BigInt((area * _wiegandCardMask) + code).toString(16);
}

function hexToArea(hex){
	if(!hex)
		hex = 0;
	return Math.floor(hex/_wiegandCardMask);
}

function hexToCode(hex){
	if(!hex)
		hex = 0;
	return Math.floor(hex%_wiegandCardMask);
}

function decimalToArea(decimal){
	if(!decimal)
		decimal = 0;
	return Math.floor(decimal/_wiegandCardMask);
}

function decimalToCode(decimal){
	if(!decimal)
		decimal = 0;
	return Math.floor(decimal%_wiegandCardMask);
}

function extractFacilityCode(wiegandValue) {
	value = typeof wiegandValue === 'bigint' ? wiegandValue : BigInt(wiegandValue || 0);

	if (_wiegandFacilityBits === 0) {
		return 0n;
	}

	var shiftAmount = BigInt(_wiegandCardBits);
	var mask = (1n << BigInt(_wiegandFacilityBits)) - 1n;

	return (value >> shiftAmount) & mask;
}

function extractCardCode(wiegandValue) {
	value = typeof wiegandValue === 'bigint' ? wiegandValue : BigInt(wiegandValue || 0);
	
	if (_wiegandCardBits === 0) {
		return 0n;
	}

	var mask = (1n << BigInt(_wiegandCardBits)) - 1n;

	return value & mask;
}


function composeWiegandValue(facilityCode, cardCode) {
	var facility = typeof facilityCode === 'bigint' ? facilityCode : BigInt(facilityCode || 0);
	var card = typeof cardCode === 'bigint' ? cardCode : BigInt(cardCode || 0);

	var facilityMask = (1n << BigInt(_wiegandFacilityBits)) - 1n;
	var cardMask = (1n << BigInt(_wiegandCardBits)) - 1n;

	var result = ((facility & facilityMask) << BigInt(_wiegandCardBits)) | (card & cardMask);

	return result;
}

function wiegandToFacilityCard(wiegandValue) {
	return {
		facility: extractFacilityCode(wiegandValue),
		card: extractCardCode(wiegandValue)
	};
}

function getWiegandFormatInfo() {
	return _wiegandFormat ? {
		totalBits: _wiegandFormat.totalBits,
		facilityBits: _wiegandFormat.facilityBits,
		cardBits: _wiegandFormat.cardBits,
		hasFacilityCode: _wiegandFormat.facilityBits > 0
	} : null;
}

function usesFacilityCode() {
	if (Main.isMifare()) {
		return false;
	}
	return _wiegandFacilityBits > 0;
}

function toUint64(signedInt){
  const signedBigInt = BigInt(signedInt);
  if(signedBigInt < 0) {
    const maxUint64Value = BigInt("18446744073709551615"); // 2^64 - 1
    return maxUint64Value + signedBigInt + BigInt(1);
  }
  return signedBigInt;
}

var metadata = MessengerUtil.send('object_metadata', {}, null, true);

CID.createClass ({
	'object': 'visits',
	'name'  : 'Visits',
	'order' : ['id'],
	'validateBeforeSave': function (obj) {
		var begin_time = parseInt(obj.values._begin_time) + parseInt(obj.values._begin_date);
		var end_time;
		if (obj.values._end_date === '')
			end_time = 0;
		else {
			if (obj.values._end_time === '')
				obj.values._end_time = 0;
			end_time = parseInt(obj.values._end_time) + parseInt(obj.values._end_date);
		}

		if (begin_time >= end_time && end_time != 0)
			return ['The end of the visit should be after its start'];
		return [];
	},
	'save': function (obj) {
		obj.values.visitor_id = BigInt(obj.values.users_visitor);
		obj.values.host_id = BigInt(obj.values.users_host);
		obj.values.begin_time = parseInt(obj.values._begin_time) + parseInt(obj.values._begin_date);
		obj.values.end_time = parseInt(obj.values._end_time) + parseInt(obj.values._end_date);
		obj.cards.forEach(function(_curr){
			_curr.object.values.user_id = obj.values.visitor_id;
		});
		if (Array.isArray(obj.qrcodes)) {
			obj.qrcodes.forEach(function(_curr){
				_curr.object.values.user_id = obj.values.visitor_id;
			});
		}

		if(obj.finished){
			MessengerUtil.send('destroy_objects', {
				object: "cards",
				where: {
					cards: {
						user_id: {
							"==": obj.values.visitor_id
						}
					}
				}
			});

			MessengerUtil.send('destroy_objects', {
				object: "qrcodes",
				where: {
					qrcodes: {
						user_id: {
							"==": obj.values.visitor_id
						}
					}
				}
			});

			obj.values.end_time =  Main.getSystemDate().getTime() / 1000;
		}
		obj.save({'newSave': false});
	},
	'filters':	[
		{
			'label': 'Visitor\'s name',
			'where': function (val) {
				return [{
					'object' : 'users',
					'field' : 'name',
					'value' : '%' + val + '%',
					'connector' : 'AND'
				}];
			}
		},
		{
			'label': 'Visitor\'s id',
			'where': function (val) {
				if (!isNaN(BigInt(val)))
					return [{
						'object' : 'users',
						'field' : 'id',
						'value' : BigInt(val),
						'connector' : 'AND'
					}];
			}
		},
		{
			'label': 'Visitor\'s card',
			'where': function (val) {
				var code = null;
				if (val.split(',').length == 1) {
					if (!isNaN(parseInt(val))) {
						var inputValue = parseInt(val);
						var area = extractFacilityCode(inputValue);
						var cardCode = extractCardCode(inputValue);
						code = composeWiegandValue(area, cardCode);
					}
				}
				else if (val.split(',').length == 2) {
					if (!isNaN(parseInt(val.split(',')[0])) && !isNaN(parseInt(val.split(',')[1]))) {
						var area = parseInt(val.split(',')[0]);
						var cardCode = parseInt(val.split(',')[1]);
						code = composeWiegandValue(area, cardCode);
					}
				}
				if (code != null)
					return [{
						'object' : 'cards',
						'field' : 'value',
						'value' : code,
						'operator' : '==',
						'connector' : 'AND'
					}];
				return [];
			}
		}
	],
	'fields': {
		'id' : { 'label' : 'Id', 'type' : 'BigInt', 'not_null' : false, 'PK' : true, 'show' : false, 'value': 0 },
		'visitor_id' : { 'type' : 'BigInt', 'show' : false, 'value': 0},
		'host_id' : { 'type' : 'BigInt', 'show' : false, 'value': 0},
		'users_visitor' : {
				'label' : 'Visitor',
				'type' : 'object',
				'object' : 'visit_users',
				'isField' : false,
				'not_null' : true,
				'get' : function(obj){
					return obj.visitor_id;
				},
				'selection_change' : function (obj, field, parent_obj){
					var _cards = [];
					var _keys = Object.keys(obj.cards);
					_keys.forEach(function(curr_key){
						_cards.push(obj.cards[curr_key]);
					});
					parent_obj.html_obj.reload({'clear': true, 'objects': _cards});

					var _qrcodes = [];
					var _qrkeys = Object.keys(obj.qrcodes);
					_qrkeys.forEach(function(curr_key){
						_qrcodes.push(obj.qrcodes[curr_key]);
					});
					parent_obj.html_obj.reload({'clear': true, 'objects': _qrcodes});
				}
		},
		'users_host' : {
				'label' : 'Host',
				'type' : 'object',
				'object' : 'host_users',
				'isField' : false,
				'not_null' : true,
				'fieldId': 'host_id',
				'get' : function(obj){
					return obj.host_id;
				}
		},
		'begin_time' : {
			'type': 'date',
			'show': false
		},
		'end_time' : {
			'type': 'date',
			'show': false
		},
		'_begin_date': {
			'label': 'Start Date',
			'isField': false,
			'type': 'date',
			'not_null': true,
			'endDate': '_end_date',
			'get' : function(obj){
				if (obj.isLoaded) {
					var date = new Date(obj['begin_time'] * 1000);
					var time = date.getUTCHours() * 60 * 60 + date.getUTCMinutes() * 60;
					return obj['begin_time'] - time;
				} else {
				    var now = Main.getSystemDate().getTime();
					var time = now % 86400000;
					return (now - time) / 1000;
				}
			}
		},
		'_begin_time' : {
			'label': 'Start Time',
			'isField': false,
			'type': 'time',
			'not_null': true,
			'get': function(obj) {
				if (obj.isLoaded) {
					var date = obj.isLoaded ? new Date(obj['begin_time'] * 1000) : Main.getSystemDate().getTime();
					return date.getUTCHours() * 60 * 60 + date.getUTCMinutes() * 60;
				} else {
					var now = Main.getSystemDate();
					return now.getUTCHours() * 60 * 60 + now.getUTCMinutes() * 60
				}
			}
		},
		'_end_date' : {
			'label': 'End Date',
			'isField': false,
			'type': 'date',
			'not_null': false,
			'beginDate': '_begin_date',
			'get' : function(obj){
				var date = new Date(obj['end_time'] * 1000);
				var time = date.getUTCHours() * 60 * 60 + date.getUTCMinutes() * 60;
				return obj['end_time'] - time;
			}
		},
		'_end_time' : {
			'label': 'End Time',
			'isField': false,
			'type': 'time',
			'value': '',
			'not_null': false,
			'get': function(obj) {
				if (obj['end_time'] == 0)
					return '';
				var date = new Date(obj['end_time'] * 1000);
				return date.getUTCHours() * 60 * 60 + date.getUTCMinutes() * 60;
			}
		},
		'c_visits' : {
			'label' : 'Custom Fields',
			'type' : 'fields',
			'fieldType' : 'single',
			'isField': false,
			'showTable': true,
			'afterGet' : function(obj, value){
				value.visit_id = obj.id;
				return value;
			},
			'beforeSave' : function(obj, value){
				value.visit_id = obj.id;
				return value;
			}
		},
		'cards' : {
			'label' : 'Cards',
			'type' : 'listEdit',
			'isField' : false,
			'defaultWhere' : function(where, obj, _parent) {
				where = [];
				var _visitor_id = 0;
				if(obj.visitor_id != undefined){
					_visitor_id = obj.visitor_id;
				} else if(_parent &&  _parent.visitor_id) {
					_visitor_id = _parent.visitor_id;
				}

				where.push({
					'object' : 'users',
					'field' : 'id',
					'value' : _visitor_id,
					'operator' : '==',
					'connector' : 'AND'
				});

				return where;
			}
		},

		'qrcodes' : {
			'label' : 'QR Codes',
			'type' : 'listEdit',
			'show' : qrcode_alpha,
			'isField' : false,
			'defaultWhere' : function(where, obj, _parent) {
				where = [];
				var _visitor_id = 0;
				if(obj.visitor_id != undefined){
					_visitor_id = obj.visitor_id;
				} else if(_parent &&  _parent.visitor_id) {
					_visitor_id = _parent.visitor_id;
				}

				where.push({
					'object' : 'users',
					'field' : 'id',
					'value' : _visitor_id,
					'operator' : '==',
					'connector' : 'AND'
				});

				return where;
			}
		},

		'finished': {
			'type': 'boolean',
			'label': 'Concluded',
			'afterGet' : function(obj){
				obj.fields.finished.show = (obj.isLoaded && obj.begin_time < (Main.getSystemDate().getTime() / 1000));
				return obj.values.finished;
			}
		}
	},
	'defaultWhere' : function(where, obj) {
		where.push({
			'object' : 'visits',
			'field' : 'finished',
			'value' : 1,
			'operator' : '!=',
			'connector' : 'AND'
		});
		return where;
	}
});

CID.createClass ({
	'object' : 'custom_tables',
	'name' : 'Custom tables',
	'fields' : {
		'name' : { 'label' : 'User type', 'description' : true, 'value' : '', 'type' : 'text', 'show': true , 'not_null' : true},
		'id' : { 'label' : 'Id', 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
		'table_name': {'type': 'text', 'show': false, 'showTable': false}
	},
	'defaultWhere' : function(where, obj) {
		if (window.location.pathname.search('customfields') == -1){
			where.push({
				'object' : 'custom_tables',
				'field' : 'table_name',
				'value' : 'c_visits',
				'operator' : '!=',
				'connector' : 'AND'
			});
		}

		return where;
	}
});

//'Classse' dos tipos de campos
function field_types() {


	this.values = [
		{'PK': 1,  'description': 'Text', 'js_value': 'text', 'value': 'TEXT', 'getValue': function(campo) { return campo}},
		{'PK': 2, 'description': 'Number', 'js_value': 'int', 'value': 'INTEGER', 'getValue': function(campo) { return campo }}
		//{'PK': 3, 'description': 'Número Longo', 'value': 'BIGINT', 'getValue': function(campo) { return campo }}
	];
	this.load = function (params) {
		var $value = '';
		$.each(this.values, function (key, val) {
			if (params.value == val.PK) {
				$value = val;
				return false;
			}
		});
		this.object = $value;
	};
	this.PK = 'PK';
	this.description = 'description';
	this.get_id_from_value = function (value) {
		var $value = '';
		$.each(this.values, function (key, val) {
			if (value == val.value) {
				$value = val.PK
				return false;
			}
		});
		return $value;
	}

	this.get_value_from_id = function (id) {
		var $value = '';
		$.each(this.values, function (key, val) {
			if (id == val.PK) {
				$value = val.value
				return false;
			}
		});
		return $value;
	}

	this.setValue = function () {	};
	this.getValue = function(campo) {
		return this.object[campo] ? this.object[campo] : '';
	};
	this.count = function(options, fun) {
		fun(this.values.length);
	};
	this.list = function(options, fun) {
		fun(this.values, true);
	}
}


CID.createClass ({
	'object' : 'custom_columns',
	'name': 'Custom Fields',
	'order': ['custom_table_id', 'id'],
	'defaultWhere': function(defaultWhere) {
		defaultWhere.push({
				'object' : 'custom_columns',
				'field' : 'column_name',
				'value' : 'id',
				'operator' : '!=',
				'connector' : 'AND'
			});
		defaultWhere.push({
				'object' : 'custom_columns',
				'field' : 'column_name',
				'value' : 'user_id',
				'operator' : '!=',
				'connector' : ') AND ('
			});
		defaultWhere.push({
				'object' : 'custom_columns',
				'field' : 'column_name',
				'value' : 'visit_id',
				'operator' : '!=',
				'connector' : ') AND ('
			});
		return defaultWhere;
	},
	'save': function (obj) {
		// Save personalizado
		var column_name = '_' + removeSpecialCharacters(replaceAccents(obj.values.name)) + String(Math.floor(Math.random()*90000) + 10000);
		// 1.Cria coluna se não existir
		if (obj.values.id == 0) {
			//Envia requisição
			var result = MessengerUtil.send('object_add_field', {
				'object': obj.table_name,
				'column_name': column_name,
				'name': obj.values.name,
				'type': new field_types().get_value_from_id(obj.values.type),
				'constraint': obj.values.not_null ? 'NOT_NULL' : 'NONE',
				'default_value': (new field_types().get_value_from_id(obj.values.type) == 'INTEGER' ? 0 : '' )
			}, null, true);
			if (result.error) {
				//Deu erro na criação
				CID.AlertError(result);
				return;
			}
		}
		else {
			if (obj.valuesDefault.custom_table_id != parseInt(obj.values.custom_tables, 10)) {
				//Não pode alterar tabela
				CID.AlertError({'error': 'Custom Field\'s table could no be altered'});
			}
			//Verifica se não precisa recriar o campo
			if (obj.valuesDefault.type.object.PK == parseInt(obj.values.type, 10)
				&& obj.valuesDefault.not_null == obj.values.not_null
				) {
				//Apenas modifica
				obj.save({'newSave': false});
			}
			else {
				//Recria o campo
				console.log("Value: '" + obj.values.default_value + "'");
				var result = MessengerUtil.send('object_update_field', {
					'id': obj.values.id,
					'object': obj.table_name,
					'column_name': column_name,
					'name': obj.values.name,
					'type': new field_types().get_value_from_id(obj.values.type),
					'constraint': obj.values.not_null ? 'NOT_NULL' : 'NONE',
					'default_value': (new field_types().get_value_from_id(obj.values.type) == 'INTEGER' ? 0 : '' )
				}, null, true);
				if (result.error) {
					//Deu erro na atulização
					CID.AlertError(result);
					return;
				}
			}
		}
		reload_database_metadata();
	},
	'functions' : {
			'table_name' : function (obj) {
				var data = MessengerUtil.send(
						'load_objects',
						{
							'object' : 'custom_tables',
							'fields': ['table_name'],
							'where':{
								'custom_tables' : {'id' : parseInt(obj.values.custom_tables, 10)}
							}
						}
					);
				return data.custom_tables[0].table_name;
			}
	},
	'fields' : {
		'id' : { 'label' : 'Id', 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
		'custom_table_id' : { 'type' : 'int', 'show' : false, 'value': 0 },
		'custom_tables' : {
				'label' : 'Table',
				'type' : 'object',
				'object' : 'custom_tables',
				'isField' : false,
				'not_null' : true,
				'get' : function(obj){
					return obj.custom_table_id;
				},
				'afterSave' : function(obj, value){

					/*if(isNaN(value))
						return;
					obj.portals.forEach(function(portal){
						if(portal.id === obj.defaultPortal.portal)
							portal.area_from_id = value;
						else
							portal.area_to_id = value;
						portal.save();
					});*/
				},
				'defaultWhere' : function(where){
					where = [];
					return where;
				}
		},
		'type': {
			'label': 'Type',
			'type': 'object',
			'object': 'field_types',
			'get': function (obj) {
				if (obj.values.id != 0)
					return new field_types().get_id_from_value(
						get_database_metadata()[obj.custom_tables.values.table_name].fields[obj.values.column_name].type);
				else
					return '';
			},
			'not_null': true,
			'isField': false
		},
		'name' : { 'label' : 'Name', 'value' : '', 'type' : 'text', 'show': true , 'not_null' : true},
		'not_null': {'type': 'boolean', 'isField': false, 'label': 'Mandatory', 'show': true,
			'showTable': false,
			'get': function (obj) {
				if (obj.values.id != 0) {
					return get_database_metadata()[obj.custom_tables.values.table_name].fields[obj.values.column_name]['not null'];
				}
				else
					return false;
			}
		},
		'column_name': {'type': 'text', 'showTable': false, 'show': false}
	}
});


CID.createClass ({
	'object': 'user_types',
	'name': 'User Type',
	'order' : ['id'],
	'save': function (obj) {
		// Save personalizado
		// 1.Cria tabela se nao existir
		if (obj.values.custom_table_id == 0) {
			//Envia requisição
			var table_name = '_' + removeSpecialCharacters(replaceAccents(obj.values.custom_tables.name)) + String(Math.floor(Math.random()*90000) + 10000);
			var result = MessengerUtil.send('object_add', {
				'object': table_name,
				'name': obj.values.custom_tables.name,
				'fields': [
					{column_name: 'id', name: 'id', type: 'INTEGER', constraint: 'PRIMARY_KEY'},
					{
						column_name: 'user_id',
						name: 'user_id',
						type: 'INTEGER',
						constraint: 'FOREIGN_KEY',
						foreign_key: {object: 'users', field: 'id'}
					}
				]
			}, null, true);
			if (result.error) {
				//Deu erro na criação
				CID.AlertError(result);
				return;
			}
			obj.values.custom_tables.id =  result.ids[0];
			obj.values.custom_tables.isLoaded = true;
		}
		//Coloca como default values para o update funcionar
		obj.values.custom_tables.valuesDefault.id = obj.values.custom_tables.id;
		// 3. Grava objeto
		obj.values.custom_table_id = obj.values.custom_tables.id;
		obj.save({'newSave': false});
	},
	'fields': {
		'id' : {
			'label' : 'Id',
			'type' : 'int',
			'PK' : true,
			'show' : false
		},
		'custom_table_id' : { 'type' : 'int', 'show' : false, 'value': 0 },
		'custom_tables': {
			'label': 'Table',
			'type': 'fields',
			'show': true,
			'fieldType': 'single',
			'isField': false,
			'showTable': true,
			'fieldId': 'custom_table_id',
			'not_null': false,
			'afterSave' : function (obj, value) {
				drawUserTypesMenu();
			}
		},
		'require_visitor': {
			'type': 'boolean',
			'label': 'Requires Visit'
		}
	}
});

CID.createClass({
	'object' : 'cards',
	'name' : 'Card',
	'order' : ['id'],
	'fields' :{
		'id' : { 'label' : 'Id', 'value' : '', 'type' : 'BigInt', 'not_null' : false, 'PK' : true, 'show' : false },
		'user_id' : { 'label' : 'User', 'value' : '', 'type' : 'BigInt', 'not_null' : true, 'show' : false },

		'format' : {
			'label' : 'Format', 'type': 'object',
			'object': 'card_types',
			'not_null' : true,
			'isField' : false,
			'showTable' : false,
			'get' : function(obj){
				if (Main.isMifare()) {
					return 2;
				}
				return 1;
			},
			'selection_change' : function (obj, field){
				var $area = field.closest(".tab-content").find("#area");
				var $code = field.closest(".tab-content").find("#code");

				var parsed_area = 0;
				var parsed_code = 0;

				if ($area.val() != 0) {
					parsed_area = $area.val();
					parsed_code = $code.val();
				} else if ($code.val().substring(0,2) === "0x") {
					parsed_area = hexToArea(parseInt($code.val()));
					parsed_code = hexToCode(parseInt($code.val()));
				} else {
					parsed_area = decimalToArea(parseInt($code.val()));
					parsed_code = decimalToCode(parseInt($code.val()));
				}

				switch(obj.PK){
					case 1:
						$area.closest(".span6").show();
						$area.val(parsed_area);
						$code.val(parsed_code);
						$area.click().select();
					break;
					case 2:
						if (Main.isMifare()) {
							if ($code.val())
								$code.val(toUint64($code.val()).toString());
						} else {
						  $code.val(codeAreaToDecimal(parseInt(parsed_area), parseInt(parsed_code)));
						}
						$area.val(0);
						$area.closest(".span6").hide();
						$code.click().select();
					break;
					case 3:
						if (Main.isMifare()) {
							if ($code.val())
								$code.val("0x" + toUint64($code.val()).toString(16));
						} else {
							$code.val(codeAreaToHex(parseInt(parsed_area), parseInt(parsed_code)));
						}
						$area.val(0);
						$area.closest(".span6").hide();
						$code.click().select();
					break;
					default:
						$area.val(decimalToArea(parseInt($code.val())));
						$code.val(decimalToCode(parseInt($code.val())));
						$area.click().select();
					break;
				}
			}
		},

		'area' : {
			'label' : 'Area', 'value' : 0, 'type' : 'int',
			'not_null' : false, 'isField' : false,
			'showTable' : false, 'show': !Main.isMifare() && _wiegandFacilityBits > 0
		},

		'code' : {
			'label' : 'ID', 'value' : '', 'type' : 'BigInt',
			'not_null' : true, 'isField' : false,
			'showTable' : false
		},

		'value' : {
			'label' : 'Card', 'value' : '',
			'type' : 'card_code', 'description' : true,
			'not_null' : false, 'isField' : true,
			'showTable' : true, 'show' : false,
			'afterGet' : function(obj, value){
				var _site_code = obj.getValue('area');
				var _id = obj.getValue('code');
				function parseAreCode(siteCode, id){
					var site = siteCode.toString();
					var code = id.toString();
					if(parseInt(site) !== 0){
							return site + ',' + code;
						}
						else{
							return code;
						}
				};
				function parseDecimal(siteCode, id){
					return id;
				}
				function castId(id){
					if((typeof id == "string" && id !== ""))
						return id;
					else if(typeof id == 'bigint')
						return id.toString();
					else if(!isNaN(id))
						return id;
					return Number(id);
				}
				switch(parseInt(obj.values.format)){
					case 1:
						if (Main.isMifare()) {
							obj.setValue('value', castId(_id));
							return parseDecimal(_site_code, _id);
						} else {
							if (_site_code === 0) {
								obj.setValue('value', _id);
								return parseDecimal(_site_code, _id);
							} else {
								obj.setValue('value', composeWiegandValue(_site_code, _id));
								return parseAreCode(_site_code, _id);
							}
						}
					case 2:
						if (Main.isMifare()) {
							return castId(_id);
						} else {
							var valueToUse = typeof _id === 'bigint' ? _id : BigInt(_id || 0);
							obj.values.value = valueToUse;
							return valueToUse.toString();
						}
					case 3:
						if (Main.isMifare()) {
							return '0x' + BigInt(castId(_id)).toString(16).toUpperCase();
						} else {
							var valueToUse = typeof _id === 'bigint' ? _id : BigInt(_id || 0);
							obj.values.value = valueToUse;
							return '0x' + valueToUse.toString(16).toUpperCase();
						}
					default:
						if (Main.isMifare()) {
							obj.setValue('value', castId(_id));
							return parseDecimal(_site_code, _id);
						} else {
							obj.setValue('value', composeWiegandValue(_site_code, _id));
							return parseAreCode(_site_code, _id);
						}
				}
			},
			'set' : function(obj, value){
				if(Main.isMifare()){
					obj.values.area = 0;
					obj.values.code = value;
				}
				else {
					if (_wiegandFacilityBits === 0) {
						obj.values.area = 0;
						obj.values.code = extractCardCode(value);
					} else {
						obj.values.area = extractFacilityCode(value);
						obj.values.code = extractCardCode(value);
					}
				}
				return value;
			},
			'beforeSave' : function(obj, value){
				switch(parseInt(obj.values.format)){
					case 1:
						if (Main.isMifare()) {
							return BigInt(obj.code)
						} else {
							var result = composeWiegandValue(obj.values.area, obj.values.code);
						}
					case 2:
						if (Main.isMifare()) {
							return BigInt(obj.code)
						} else {
							var result = typeof obj.values.code === 'bigint' ? obj.values.code : BigInt(obj.values.code || 0);
							return result;
						}
					case 3:
						if (Main.isMifare()) {
							return BigInt(obj.code)
						} else {
							var hexValue = String(obj.values.code || '0').replace(/^0x/i, '');
							var result = BigInt('0x' + hexValue);
							return result;
						}
					default:
						if(Main.isMifare()){
							return BigInt(obj.code)
						} else {
							var result = composeWiegandValue(obj.values.area, obj.values.code);
							return result;
						}
				}
			}
		},
	}
});

CID.createClass({
	'object' : 'qrcodes',
	'name' : 'QR Code',
	'order' : ['id'],
	'fields' :{
		'id' : { 'label' : 'Code', 'value' : '', 'type' : 'BigInt', 'not_null' : false, 'PK' : true, 'show' : false },
		'user_id' : { 'label' : 'User', 'value' : '', 'type' : 'BigInt', 'not_null' : true, 'show' : false },


		'value' : {
			'label' : 'QR Code', 'value' : '',
			'type' : 'text', 'description' : true,
			'not_null' : false, 'isField' : true,
			'showTable' : true, 'show' : true,
		},
	}
});

/*
var infos = {};
			var result = MessengerUtil.send('system_information', null, null, false);
			if(result.error)
				return infos;
			infos.date = Main.secondsToDate(result.time);
			infos.serialNumber = result.serial;
			infos.frmVersion = result.version;
			infos.macAddress = result.network.mac;
			return infos;
*/

CID.createClass({
		'object': 'templates',
		'name': 'Fingerprints',
		'order' : ['id'],
		'fields': {
			'id': { 'label': 'Id', 'value': '', 'type': 'BigInt', 'not_null': false, 'PK': true, 'show': false },
			'user_id' : { 'label': 'User id', 'value': '', 'type': 'BigInt' },
			'finger_type' : { 'label': 'Type', 'value': 0, 'type': 'int' },
			'template' : { 'label' : 'Fingerprint', 'type' : 'text' }
		},
		'save' :function(obj){
			if(obj.template != null && obj.template.length === 3){
				var params = 'user_id=' + obj.user_id;
				for(var j = 0; j < obj.template.length; j++){
					params += '&size' + j + '=' + obj.template[j].length;
				}
				params += "&finger_type=" + obj.finger_type;

				var newtemplates = obj.template.join('');
				var imgconcat = new Uint8Array(newtemplates.length);
				for(var k = 0; k < newtemplates.length; k++){
					imgconcat[k] = newtemplates.charCodeAt(k);
				};

				var data = MessengerUtil.sendFile('template_create', imgconcat, params);
				if('error' in data) {
					var error;
					switch (data.error) {
						case 'Template exists':
							error = 'Fingerprint already enrolled';
							break;
						case 'Different fingerprints':
							error = 'Fingerprints do not match';
							break;
						default:
							error = data.error;
							break;
					}

					return ["Error while enrolling fingerprint: " + error];
				}
			}
			return true;
		}
	});

CID.createClass({
	'object': 'face_templates',
	'name': "Faces",
	'order' : ['id'],
	'fields': {
		'id': { 'label': 'Id', 'value': '', 'type': 'BigInt', 'not_null': false, 'PK': true, 'show': false },
		'user_id' : { 'label': 'User id', 'value': '', 'type': 'BigInt' },
		'template' : { 'label' : 'Faces', 'type': 'text' }
	},
	'save' :function(obj){
		if(obj.face != null && obj.face.length === 3){
			var params = 'user_id=' + obj.user_id;
			for(var j = 0; j < obj.face.length; j++){
				params += '&size' + j + '=' + obj.face[j].length;
			}
			params += "&finger_type=" + obj.finger_type;

			var newtemplates = obj.face.join('');
			var imgconcat = new Uint8Array(newtemplates.length);
			for(var k = 0; k < newtemplates.length; k++){
				imgconcat[k] = newtemplates.charCodeAt(k);
			};

			var data = MessengerUtil.sendFile('template_create', imgconcat, params);
			if('error' in data) {
				var error;
				switch (data.error) {
					case 'Template exists':
						error = 'Face exists';
						break;
					case 'Different faces':
						error = 'Different faces';
						break;
					default:
						error = data.error;
						break;
				}
				return ["Error while enrollig face: " + error];
			}
		}
		return true;
	}
});

CID.createClass({
		'object': 'access_logs',
		'name': 'Access Log',
		'order' : ['id'],
		'fields': {
			'id': { 'label': 'Id', 'value': '', 'type': 'int', 'not_null': false, 'PK': true, 'show': false },
			'time': { 'label': 'Time', 'type': 'time', 'not_null': false },
			'user_id' : { 'type' : 'int', 'show' : false },
			'portal_id' : { 'type' : 'int', 'show' : false },
			'log_type_id' : { 'type' : 'int', 'show' : false },
			'users' : {
				'label' : 'User',
				'value' : '',
				'type' : 'fields',
				'isField': false,
				'not_null' : false,
				'showTable': false,
				'fieldType': 'single',
				'fieldId' : 'user_id'
			},
			'portals' : {
				'label' : 'Portal',
				'value' : '',
				'type' : 'fields',
				'isField': false,
				'not_null' : false,
				'showTable': false,
				'fieldType': 'single',
				'fieldId' : 'portal_id'

			},
			'areas': {
				'label': 'Area',
				'object': 'areas',
				'type': 'fields',
				'isField': false,
				'not_null': false,
				'showTable': false,
				'fieldType': 'single',
				/*
				CID.createClass({
	'object': 'areas',
	'name': 'Áreas',
	'fields': {
		'id': {
			'PK': true,
			'type': 'int'
		},
		'name': {
			'type': 'text',
			'description' : true
		},
		'devices' : {
			'label' : 'Equipamentos',
			'type' : 'list',
			'isField' : false,
			'intermediateTable' : {
				'table' : 'area_access_rules',
				'pk' : 'access_rule_id',
				'fk' : 'area_id'
			},
			'listBy' : 'access_rules',
			'intermediateTableBy' : {
				'table' : 'access_rule_time_zones',
				'pk' : 'time_zone_id',
				'fk' : 'access_rule_id'
			}
		}
	}
});*/
			},
			'event': { 'label': 'Event', 'type': 'int', 'not_null': false, 'show': false}
		}
	});

CID.createClass({
		'object': 'actions',
		'name': 'Actions',
		'fields': {
			'id': {
				'PK': true,
				'type': 'int'
			},
			'name': {
				'label' : 'Name',
				'type': 'text'
			},
			'action': {
				'label' : 'Action',
				'type': 'text'
			},
			'parameters': {
				'label' : 'Parameter',
				'type': 'text'
			},
			'run_at': {
				'label' : 'Execute on',
				'type': 'int'
			}
		}
	});

CID.createClass({
		'object': 'portals',
		'name': 'Portals',
		'fields': {
			'id': {
				'PK': true,
				'type': 'int'
			},
			'name': { 'type': 'text','description' : true},
			'area_to_id' : {
				'type' : 'int'
			},
			'area_from_id' : {
				'type' : 'int'
			}
		}
	});

CID.createClass({
	'object' : 'identification_rules',
	'name' : 'Identification Rule',
	'fields': {
			'id': {
				'PK': true,
				'type': 'int',
			},
			'name': {
				'type': 'text',
				'description' : true
			}
	}
});

CID.createClass({
	'object' : 'script_instance',
	'name' : 'Identification Rule Instance',
	'fields': {
			'id': {
				'PK': true,
				'type': 'int',
			},
			'name': {
				'type': 'text',
				'description' : true
			}
	}
});


var dev_user = {
	'object': 'devices',
	'form': 'devs',
	'name': 'Devices',
	'fields': {
		'id': {
				'PK': true,
				'type': 'int',
				'show' : false
			},
		'name': {
			'type': 'text',
			'label' : 'Name',
			'show': false,
			'showTable': true
		},
		'user': {
			'type' : 'object',
			'object' : 'users',
			'show': false,
			'showTable': false,
			'isField': false
		},
		'time_zones': {
			'label' : 'Time Zones',
			'type' : 'list',
			'name' : 'Time Zones',
			'isField' : false,
			'value' : [1],
			'defaultWhere' : function(whereAtual, obj) {
				whereAtual.push({
					'object' : 'users',
					'field' : 'id',
					'value' : obj.user.id,
				});
				return whereAtual;
			},

			'intermediateTable' : {
				'table' : 'access_rule_time_zones',
				'fk' : 'time_zone_id',
				'pk' : 'access_rule_id'
			},
			'listBy' : 'access_rules',
			'intermediateTableBy' : [
				{
					'table' : 'portal_access_rules',
					'pkCallback' : function(obj){
						var lst = [];
						portals.fn.list({ 'object' : obj, 'async' : false }, function(_lst){
							_lst.forEach(function(portal){
								lst.push(portal.getValue(portal.PK));
							});
						})
						return lst;
					},
					'pk' : 'portal_id',
					'fk' : 'access_rule_id'
				},
				{
					'table' : 'user_access_rules',
					'pkCallback' : function(obj){
						return [obj.user.id];
					},
					'pk' : 'user_id',
					'fk' : 'access_rule_id'
				}
			],
		}
	}

};
// Devices para groups
CID.createClass(dev_user);


var dev_group = jQuery.extend(true, {}, dev_user);
dev_group.form = 'dev_groups';
dev_group.fields['time_zones'].intermediateTableBy[1] = {
	'table' : 'group_access_rules',
	'pkCallback' : function(obj){
		return [obj.group.id];
	},
	'pk' : 'group_id',
	'fk' : 'access_rule_id'
};
dev_group.fields['time_zones'].defaultWhere = function(whereAtual, obj) {
	whereAtual.push({
		'object' : 'groups',
		'field' : 'id',
		'value' : obj.group.id,
	});
	return whereAtual;
}

delete dev_group.fields['user'];
dev_group.fields['group'] = {
	'type' : 'object',
	'object' : 'groups',
	'show': false,
	'showTable': false,
	'isField': false
},
CID.createClass(dev_group);



var area_user = jQuery.extend(true, {}, dev_user);
area_user.object = 'areas';
area_user.form = 'area_users';
area_user.name = 'Areas';
area_user.fields.time_zones.intermediateTableBy[0]={
					'table' : 'area_access_rules',
					'pk' : 'area_id',
					'fk' : 'access_rule_id'
				}

CID.createClass(area_user);


var area_group = jQuery.extend(true, {}, area_user);
area_group.form = 'area_groups';
area_group.fields.time_zones.intermediateTableBy[1] = {
	'table' : 'group_access_rules',
	'pkCallback' : function(obj){
		return [obj.group.id];
	},
	'pk' : 'group_id',
	'fk' : 'access_rule_id'
};

area_group.fields['time_zones'].defaultWhere = function(whereAtual, obj) {
	whereAtual.push({
		'object' : 'groups',
		'field' : 'id',
		'value' : obj.group.id,
	});
	return whereAtual;
}

delete area_group.fields['user'];
area_group.fields['group'] = {
	'type' : 'object',
	'object' : 'groups',
	'show': false,
	'showTable': false,
	'isField': false
}
CID.createClass(area_group);


CID.createClass({
		'object' : 'devices',
		'name': 'Devices',
		'functions' : {
			'portals' :
				function(obj) {
					var lst = [];
					portals.fn.list({
						'object' : obj,
						'async' : false,
						'group': true,
						'callback' : function(_lst, finish){
							lst = lst.concat(_lst);
						}
					});
					return lst;
				},
			'defaultPortal' :
				function(obj){
					var data = MessengerUtil.send(
						'load_objects',
						{
							'object' : 'portals',
							'fields': ['id', 'area_to_id', 'area_from_id','COUNT(*)'],
							'group' : [{'object':'portals', 'field' : 'id'}],
							'where':{
								'devices' : {'id' : obj.getValue(obj.PK)}
							}
						}
					);
					var count = 0;
					var to = 0;
					var from = 0;
					var portal = 0;
					data.portals.forEach(function(row){
						if(row['COUNT(*)'] > count){
							count = row['COUNT(*)'];
							to = row['area_to_id'];
							from = row['area_from_id'];
							portal = row['id'];
						}
					});

					return {
						'portal' : portal,
						'area_to' : to,
						'area_from' : from
					};
				}
		},
		'save' :function(obj){
			var data = MessengerUtil.send('system_information');
			var iDevice = new devices();
			iDevice.load({'async' : false, 'value' : GetDeviceIdBySerial(data.serial) });
			if(iDevice.id === obj.id){

				devices.fn.list({
					'async' : false,
					'where' : [{
						'object' : 'devices',
						'field' : 'id',
						'value' : obj.id,
						'operator' : '!='
					}]
				}, function(lst){
					lst.forEach(function(device){
						if(!saveDevice(iDevice, iDevice, device, true, null))
							return false;
					});
				});


				data = MessengerUtil.send('system_information');
				if(!('error' in data) && obj.ip != iDevice.ip){
					var time = 10;
					setTimeout(function(){
						Main.sessionFail({error : 'customError'}, function(){
								setInterval(function(){
									time--;
									if(time == 0){
										window.location = 'http://' + obj.ip + ':' + data.network.web_server_port + '/en_US/html/device.html';
									}
									else if(time >= 0)
										$('#countReboot').html(('00' + time).slice(-2));
								}, 1000);
							},
							'Please wait...',
							'Changing device\'s IP',
							'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the device to be altered.',
							true
						);
					}, 0);


					MessengerUtil.send('set_system_network', {
						'ip': obj.ip.split(':')[0],
						'netmask': data.network.netmask,
						'gateway': data.network.gateway,
						'web_server_port' :  parseInt(obj.ip.split(':')[1] || 80)
					});

					obj.functionsValues.defaultPortal = null;
					obj.save({'async' : false, 'newSave' : false});
				}

			}else{
				var sendServer = null;
				if(obj.isLoaded === false){
					data = MessengerUtil.send(
						'request_redirect',
						{},
						('command=system_information&'+
						'address='+ obj.ip + '&' +
						'login=' + obj.login + '&' +
						'password=' + obj.password)
					);
					if(typeof data === 'string')
						data = JSON.parse(data);

					if('error' in data){
						var md = new Modal();
						md.setTitle('Enroll Device');
						md.setContent('Cannot connect to device.');
						md.addButton([{
							'type' : 'ok'
						}]);
						md.show();
						return false;
					}
					sendServer = data.license.type === 0;// 1 = servidor
					data = MessengerUtil.send(
						'request_redirect',
						{
							'object' : 'devices',
							'where' : [{
								'object' : 'devices',
								'field' : 'id',
								'value' : GetDeviceIdBySerial(data.serial)
							}]
						},
						('command=load_objects&'+
						'address='+ obj.ip + '&' +
						'login=' + obj.login + '&' +
						'password=' + obj.password)
					);

					if(typeof data === 'string')
						data = JSON.parse(data);

					if(!('error' in data)){
						data = data.devices[0];
						if(obj.name){
							data.name = obj.name;
							obj.setValue(data);
							if(!saveDevice(obj, obj, obj, false, null))
								return false;
						}else
							obj.setValue(data);
						//
						if(!saveDevice(sendServer ? iDevice : obj, sendServer ? obj : iDevice, obj, true, sendServer))
							return false;
					}
				}else{
					data = MessengerUtil.send('system_information');
					if(!('error' in data)){
						sendServer = data.license.type === 1;
						if(!saveDevice(sendServer ? iDevice : obj, sendServer ? obj : iDevice, obj, false, sendServer))
							return false;
					}

					data = MessengerUtil.send('request_redirect', {}, 'command=system_information&device_id=' + obj.id);
					if(typeof data === 'string')
						data = JSON.parse(data);
					if(!('error' in data) && (data.network.ip != obj.ip.split(':')[0] || data.network.web_server_port != obj.ip.split(':')[1]) ){
						MessengerUtil.send(
							'request_redirect',
							{
								'ip': obj.ip.split(':')[0],
								'netmask': data.network.netmask,
								'gateway': data.network.gateway,
								'web_server_port' : parseInt(obj.ip.split(':')[1] || 80)
							},
							'command=set_system_network&device_id=' + obj.id
						);

						obj.functionsValues.defaultPortal = null;
						obj.save({'async' : false, 'newSave' : false});
					}
				}
			}

			if(obj.public_key == '')
				obj.public_key = btoa('undefined');

			obj.functionsValues.defaultPortal = null;
			obj.save({'async' : false, 'newSave' : false});


			function saveDevice(server, client, connect, isNew, sendServer){
				if(connect.ip == ''){
					return ;
				}
				var conn = 'address=' + connect.ip +'&' +// device.ip + '&' +
							'login=' + connect.login + '&' +
							'password=' + connect.password;

				if(connect.isLoaded === true && connect.public_key !== btoa('undefined'))
					conn = 'device_id=' + connect.id;


				if(isNew === false){
					MessengerUtil.send(
						'request_redirect',
						{
							'object' : 'devices',
							'values' : {
								'name' : client.name,
							},
							'where' : [{
								'object' : 'devices',
								'field' : 'id',
								'value' : client.id
							}]
						},
						'command=modify_objects&'+conn
					);
				}else{
					data = MessengerUtil.send(
						'request_redirect',
						{
							'object' : 'devices',
							'where' : [{
								'object' : 'devices',
								'field' : 'id',
								'value' : server.id
							}]
						},
						'command=load_objects&'+conn
					);
					if(typeof data === 'string')
						data = JSON.parse(data);

					if('error' in data)
						return false;
					if(data.devices.length === 0){
						MessengerUtil.send(
							'request_redirect',
							{
								'object' : 'devices',
								'where' : {
									'devices' : {
										'id' : {'!=' : client.id}
									}
								}
							},
							'command=destroy_objects&'+conn
						);
						data = MessengerUtil.send(
							'request_redirect',
							{
								'object' : 'devices',
								'values' : [{
									'id' : server.id,
									'name' : server.name,
									'ip' : server.ip,
									'public_key' : server.public_key
								}]
							},
							'command=create_objects&'+conn
						);
						if(typeof data === 'string')
							data = JSON.parse(data);

						if('error' in data){
							var md = new Modal();
							md.setTitle('Enroll Device');
							md.setContent(data.error);
							md.addButton([{
								'type' : 'ok'
							}]);
							md.show();
							return false;
						}
					}else{
						MessengerUtil.send(
							'request_redirect',
							{
								'object' : 'devices',
								'values' : {
									'name' : server.name,
								},
								'where' : [{
									'object' : 'devices',
									'field' : 'id',
									'value' : server.id
								}]
							},
							'command=modify_objects&'+conn
						);
					}
				}

				if(sendServer === true){
					MessengerUtil.send(
						'request_redirect',
						{
							'online_client': {'server_id': iDevice.id + ''}
						},
						'command=set_configuration&'+conn
					);
					MessengerUtil.send(
						'request_redirect',
						{
							'general': {'online': '1'}
						},
						'command=set_configuration&'+conn
					);
				}else if(sendServer === false){
					MessengerUtil.send(
						'set_configuration',
						{
							'online_client': {'server_id': connect.id + ''}
						}
					);
					MessengerUtil.send(
						'set_configuration',
						{
							'general': {'online': '1'}
						}
					);
				}
			return true;
			}
		},
		'fields': {
			'id': {
				'PK': true,
				'type': 'int',
				'show' : false,
				'value' : 0
			},
			'name': {
				'type': 'text',
				'label' : 'Name',
				'description': true
			},
			'ip': {
				'type': 'text',
				'label' : 'IP',
				'not_null' : true
			},
			'login': {
				'type': 'text',
				'label' : 'Login',
				'isField' : false,
				'showTable' : false
			},
			'password': {
				'type': 'password',
				'label' : 'Password',
				'isField' : false,
				'showTable' : false
			},
			'public_key': {
				'type': 'text',
				'label' : 'Public key',
				'show' : false
			},

			/*'identification_rules' : {
				'isField' : false,
				'type' : 'list',
				'label' : 'Regras de Identificação',
				'intermediateTable' : {
					'table' : 'device_identification_rules',
					'pk' : 'device_id',
					'fk' : 'identification_rule_id'
				}
			},*/
			/*'portals' : {
				'label' : 'Portal',
				'type' : 'fields',
				'fieldType' : 'single',
				'isField' : false
			},*/
			'area_from' : {
				'label' : 'Area from',
				'type' : 'object',
				'object' : 'areas',
				'isField' : false,
				'not_null' : true,
				'get' : function(obj){
					return obj.defaultPortal.area_from;
				},
				'afterSave' : function(obj, value){
					if(isNaN(value))
						return;
					obj.portals.forEach(function(portal){
						if(portal.id === obj.defaultPortal.portal)
							portal.area_from_id = value;
						else
							portal.area_to_id = value;
						portal.save();
					});
				}
			},
			'area_to' : {
				'label' : 'Area to',
				'type' : 'object',
				'object' : 'areas',
				'isField' : false,
				'not_null' : true,
				'get' : function(obj){
					return obj.defaultPortal.area_to;
				},
				'afterSave' : function(obj, value){
					if(isNaN(value))
						return;
					obj.portals.forEach(function(portal){
						if(portal.id === obj.defaultPortal.portal)
							portal.area_to_id = value;
						else
							portal.area_from_id = value;
						portal.save();
					});
				}
			},
			client: {
				label: 'Client',
				type: 'boolean',
				not_null: true,
				isField: false,
				get: function(obj){
					if (!obj.isLoaded)
						return true;

					var device_clients = MessengerUtil.send('load_objects', {
						object: 'device_clients',
						where: { device_clients: { device_id: Main.currentDeviceID(), client_id: obj.id } }
					});
					return device_clients.device_clients.length > 0;
				},
				afterSave: function(obj, value){
					if (value === true) {
						var device_client = new device_clients();
						device_client.device_id = Main.currentDeviceID();
						device_client.client_id = obj.id;
						device_client.save();
					} else {
						MessengerUtil.send('destroy_objects', {
							object: 'device_clients',
							where: { device_clients: { device_id: Main.currentDeviceID(), client_id: obj.id } }
						});
					}
				}
			}/*,
			'server' : {
				'type' : 'boolean',
				'label' : 'servidor',
				'isField' : false,
				'get' : function(obj){
					return obj.id === 467694;
				}
			}*/

			/*'area_from' : {
				'label' : 'Responsável',
				'type' : 'object',
				'object' : 'areas',

			}*/
		}
	});

CID.createClass({
	'object': 'areas',
	'name': 'Areas',
	'fields': {
		'id': {
			'PK': true,
			'type': 'int',
			'value' : '',
			'show' : false,
			'not_null' : false
		},
		'name': {
			'type': 'text',
			'description' : true,
			'not_null' : true,
			'label' : 'Name'
		}/*,
		'devices' : {
			'label' : 'Equipamentos',
			'type' : 'list',
			'isField' : false,
			'intermediateTable' : {
				'table' : 'area_access_rules',
				'pk' : 'access_rule_id',
				'fk' : 'area_id'
			},
			'listBy' : 'access_rules',
			'intermediateTableBy' : [{
				'table' : 'access_rule_time_zones',
				'pk' : 'time_zone_id',
				'fk' : 'access_rule_id'
			}]
		}*/
	}
});



CID.createClass
	({
		'object' : 'access_rules',
		'name' : 'Access Rule',
		'fields' : {
			'id' : { 'label' : 'Id', 'value' : '', 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
			'name' : { 'label' : 'Name', 'value' : '', 'type' : 'text', 'not_null' : true, 'description' : true },
			'type' : { 'label' : 'Type', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'priority' : { 'label' : 'Priority', 'value' : 0, 'type' : 'int', 'not_null' : true }
		}
	});

CID.createClass
	({
		'object' : 'time_spans',
		'name' : 'Schedule',
		'order' : ['start'],
		'fields' : {
			'id' : { 'label' : 'Id', 'value' : '', 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
			'time_zone_id' : { 'label' : 'Time Zone', 'value' : '', 'type' : 'int', 'not_null' : true, 'show' : false },

			'start' : { 'label' : 'Start', 'value' : 0, 'type' : 'time', 'not_null' : true },
			'end' : { 'label' : 'End', 'value' : 86399, 'type' : 'time', 'not_null' : true },

			'sun' : { 'label' : 'Sunday', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'mon' : { 'label' : 'Monday', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'tue' : { 'label' : 'Tuesday', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'wed' : { 'label' : 'Wednesday', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'thu' : { 'label' : 'Thursday', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'fri' : { 'label' : 'Friday', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'sat' : { 'label' : 'Saturday', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'hol1' : { 'label' : 'Holidays 1', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'hol2' : { 'label' : 'Holidays 2', 'value' : true, 'type' : 'boolean', 'not_null' : true },
			'hol3' : { 'label' : 'Holidays 3', 'value' : true, 'type' : 'boolean', 'not_null' : true },
		}
	});

CID.createClass
       ({
               'object' : 'holidays',
               'name' : 'Holidays',
               'order' : ['start'],
               'fields' : {
                       'id' : { 'label' : 'Id', 'value' : '', 'type' : 'int', 'not_null' : false, 'PK' : true, 'showTable' : false, 'show' : false },
                       'name' : { 'label' : 'Name', 'value' : '', 'type' : 'text', 'not_null' : true, 'description' : true },

                       'start' : { 'label' : 'Date', 'value' : 0, 'type' : 'date', 'not_null' : true,
                               'get' : function(obj){
                                       if (obj.isLoaded) {
                                               return obj['start'];
                                       } else {
                                               return Main.getSystemDate().getTime() / 1000;
                                       }
                               }
                       },

                       'hol1' : { 'label' : 'Type 1', 'value' : true, 'type' : 'boolean', 'not_null' : true },
                       'hol2' : { 'label' : 'Type 2', 'value' : true, 'type' : 'boolean', 'not_null' : true },
                       'hol3' : { 'label' : 'Type 3', 'value' : true, 'type' : 'boolean', 'not_null' : true },
                       'repeats' : { 'label' : 'Repeats yearly', 'value' : true, 'type' : 'boolean', 'not_null' : true },

                       'end' : { 'label' : 'End', 'value' : 0, 'type' : 'date', 'isField' : true, 'showTable' : false, 'show' : false, 'not_null' : true,
                               'afterGet' : function(obj, value){
                                       return obj.getValue('start') + 86399;
                               },
                               'beforeSave' : function(obj, value){
                                       return obj.values.start + 86399
                               },
                       },
                }
        });

CID.createClass
	({
		'object' : 'log_types',
		'name' : 'Register Status',
		'order' : ['id'],
		'fields' : {
			'id' : { 'label' : 'Id', 'value' : '', 'type' : 'int', 'not_null' : false, 'PK' : true },
			'name' : { 'label' : 'Name', 'value' : '', 'type' : 'text', 'not_null' : true, 'description' : true }
		}
	});

CID.createClass
	({
		'object' : 'time_zones',
		'name' : 'Schedule',
		'noSave' : [1],
		'fields' : {
			'id' : { 'label' : 'Id', 'value' : 0, 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
			'name' : { 'label' : 'Name', 'value' : '', 'type' : 'text', 'not_null' : true, 'description' : true },
			'time_spans' : {
				'label' : 'Time Spans', 'value' : '',
				'type' : 'fields',
				'not_null' : false, 'isField' : false,
				'afterSave' : function(obj, value){
					value.forEach(function(item){
						item.object.setValue('time_zone_id', obj.getValue(obj.PK));
					});
					return value;
				}
			}/*,
			'groups' : {
				'label' : 'Departamentos', 'value' : [1],
				'type' : 'list',
				'noSave' : {1 : [1]},
				'intermediateTable' : { 'table' : 'group_access_rules', 'pk' : 'access_rule_id', 'fk' : 'group_id' },
				'listBy' : 'access_rules',
				'intermediateTableBy' : [{ 'table' : 'access_rule_time_zones', 'pk' : 'time_zone_id', 'fk' : 'access_rule_id' }],
				'not_null' : false, 'isField' : false
			},
			'users' : {
				'label' : 'Usuários',
				'type' : 'list',
				'intermediateTable' : { 'table' : 'user_access_rules', 'pk' : 'access_rule_id', 'fk' : 'user_id' },
				'listBy' : 'access_rules',
				'intermediateTableBy' : [{ 'table' : 'access_rule_time_zones', 'pk' : 'time_zone_id', 'fk' : 'access_rule_id' }],
				'not_null' : false, 'isField' : false
			}*/
		}
	});

CID.createClass
	({
		'object' : 'user_roles',
		'name' : 'Rights',
		'order' : ['user_id'],
		'fields' : {
			'user_id' :  { 'label' : 'Id', 'value' : '', 'type' : 'BigInt', 'not_null' : false, 'PK' : true, 'show' : false },
			'role' :  { 'label' : 'Id', 'value' : '', 'type' : 'int', 'not_null' : true }
		}
	});

CID.createClass
	({
		object: 'device_clients',
		name: 'Clients',
		order: ['device_id'],
		fields: {
			device_id: { label: 'Server', value: '', type: 'int', not_null: false, PK: true, show: false },
			client_id: { label: 'Client', value: '', type: 'int', not_null: true }
		}
	});

CID.createClass
	({
		'object' : 'alarm_zones',
		'name' : 'External Alarms',
		'order' : ['zone'],
		'fields' : {
			'zone' :  { 'label' : 'Id', 'value' : '', 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
			'name' :  { 'label' : 'Name', 'value' : '', 'type' : 'text', 'not_null' : false, 'isField' : false,
				'enabled' : false,
				'get' : function(obj){
					return 'Zone ' + obj.zone;
				}
			},
			'alarm_delay' :  { 'label' : 'Delay (s)', 'value' : '', 'type' : 'int', 'not_null' : true },
			'enabled' :  { 'label' : 'Active', 'value' : '', 'type' : 'boolean', 'not_null' : true },
			'active_level' :  { 'label' : 'Type', 'value' : '', 'type' : 'boolean', 'not_null' : true, 'true' : 'NO', 'false' : 'NC' }
		}
	});

CID.createClass({
	'object' : 'api_logins',
	'name' : 'Web Login',
	'order' : ['login'],
	'fields': {
		'id': {
			'PK': true,
			'type': 'int',
			'not_null' : false,
			'show': false
		},
		'login': {
			'label' :  'Web Login',
			'type': 'text',
			'description' : true,
			'not_null' : false
		},
		'user_id': {
			'type': 'int',
			'not_null' : true,
			'show': false
		},
		'password' : {
			'label' : 'Web Password',
			'type' : 'password',
			'not_null' : false,
			'beforeSave': function(obj, value) {
				var result = MessengerUtil.send('user_hash_password', {'password': value});
				obj.setValue("salt", result.salt);
				return result.password;
			}
		},
		'salt' : {
			'label' : 'Web Salt',
			'type' : 'text',
			'not_null' : false,
			'show': false
		}
	}
});

CID.createClass({
	'object' : 'api_access_levels',
	'name' : 'Access Level',
	'order' : ['name'],
	'functions' : {
		'accessLevel' :
			function(obj) {
				var lstCommand = [];
				api_commands.fn.list({
					'object' : obj,
					'async' : false,
					'group': true,
					'callback' : function(_lst, finish){
						lstCommand = lstCommand.concat(_lst);
					}
				});
				return lstCommand;
			},
	},
	'fields': {
		'id': {
			'PK': true,
			'type': 'int',
			'value' : 0,
			'not_null' : false,
			'show': false
		},
		'name': {
			'label' : 'Access Group',
			'type': 'text',
			'description' : true,
			'not_null' : true
		},
		'api_logins' : {
			'label' : 'Users',
			'type' : 'list',
			'isField' : false,
			'show' : true,
			'intermediateTable' : {
				'table' : 'api_login_api_access_levels',
				'pk' : 'api_access_level_id',
				'fk' : 'api_login_id'
			},
		}/*,
		'api_access' : {
			'label' : 'Acessos',
			'type' : 'list',
			'isField' : false,
			'show' : false,
			'intermediateTable' : {
				'table' : 'api_commands',
				'pk' : 'id',
				'fk' : 'api_access_level_id'
			}
		}*/
	}
});

CID.createClass({
	'object' : 'api_commands',
	'name' : 'Web Login Command',
	'order' : ['name'],
	'fields': {
		'id': {
			'PK': true,
			'type': 'int',
			'not_null' : false,
			'show': false
		},
		'name': {
			'label' : 'Command',
			'type': 'text',
			'description' : true,
			'not_null' : true
		},
		'api_access_level_id': {
			'type': 'int',
			'not_null' : true,
			'show' : false
		}/*,
		'api_object_commands' : {
			'label' : 'Objetos',
			'type' : 'list',
			'isField' : false,
			'showTable' : true
		}*/
	}
});

/*
CID.createClass({
	'object' : 'api_object_commands',
	'name' : 'Web Login Command',
	'order' : ['name'],
	'fields': {
		'api_command_id': {
			'PK' : true,
			'type': 'int',
			'not_null' : false,
			'show': false
		},
		'name': {
			'label' : 'Comando',
			'type': 'text',
			'description' : true,
			'not_null' : true
		}
	}
});
*/


var userData = {
	'object' : 'users',
	'name' : 'Users',
	'order' : ['name'],
	'validateBeforeSave': function(obj, values) {
		var prevValues, newValues;

		prevValues = obj.valuesDefault;
		if (values == null)
			newValues = obj.values;
		else
			newValues = values;

		if (BigInt(prevValues.id) !== BigInt(newValues.id)) {
			var newId = BigInt(newValues.id);
			var ret = MessengerUtil.send('load_objects',{
				object: 'users',
				where: [{object: 'users', field: 'id', value: newId}]
			});
			if (ret && ret.users.length > 0)
				return ["This user id already exists"];
		}

		// Validate administrator
		if (newValues.administrator) {
			var data = MessengerUtil.send('get_configuration', {
				identifier: ['multi_factor_authentication']
			});
			var face_load = MessengerUtil.send('load_objects', {
				object: 'face_templates',
				fields: ['COUNT(*)'],
				where: { face_templates: { user_id: { '=': obj.values.id}} }
			});
			var qrcode_load = MessengerUtil.send('load_objects', {
				object: 'qrcodes',
				fields: ['COUNT(*)'],
				where: { qrcodes: { user_id: { '=': obj.values.id}} }
			});
			function hasCardsMaintained() {
				cardPresent = false;
				for(card of obj.values.cards) {
					if (card.new || card.add) {
						cardPresent = true;
					}
				}
				return cardPresent;
			}

			let removeFaceOnSave = (btFoto != null) && btFoto.length == 1 && btFoto[0] == 1;

			// Double negative is necessary because length != 0 when cards are being deleted
			var hasCard = !(obj.values.cards.length == 0 || !hasCardsMaintained());
			var hasQrcode = qrcode_load.qrcodes[0]['COUNT(*)'] > 0;
			var hasPassword = (newValues.password != undefined) ? (newValues.password != '') : (obj.values.password != '');
			var hasPIN = $('#pin_entry_text').val() != '';

			var hasFace = face_load.face_templates[0]['COUNT(*)'] > 0 && !removeFaceOnSave;
			var hasOtherIdentifications = hasPassword || hasPIN || hasCard || hasQrcode;

			if ((data.identifier.multi_factor_authentication == "1" && !(hasFace && hasOtherIdentifications))
				|| (data.identifier.multi_factor_authentication == "0" && !(hasFace || hasOtherIdentifications))
			) {
				return ["Registered identification methods are insufficient for user with administrator previleges."];
			}
		}
		
		return [];
	},
	'filters':	[
		{
			'label': 'Name',
			'where': function (val) {
				return [{
					'object' : 'users',
					'field' : 'name',
					'value' : '%' + val + '%',
					'connector' : 'AND'
				}];
			}
		},
		{
			'label': 'ID',
			'where': function (val) {
				if (!isNaN(parseInt(val)))
					return [{
						'object' : 'users',
						'field' : 'id',
						'value' : parseInt(val),
						'connector' : 'AND'
					}];
			}
		},
		{
			'label': 'Card',
			'where': function (val) {
				var code = null;
				if (val.split(',').length == 1) {
					if (!isNaN(parseInt(val))) {
						var inputValue = parseInt(val);
						var area = extractFacilityCode(inputValue);
						var cardCode = extractCardCode(inputValue);
						code = composeWiegandValue(area, cardCode);
					}
				}
				else if (val.split(',').length == 2) {
					if (!isNaN(parseInt(val.split(',')[0])) && !isNaN(parseInt(val.split(',')[1]))) {
						var area = parseInt(val.split(',')[0]);
						var cardCode = parseInt(val.split(',')[1]);
						code = composeWiegandValue(area, cardCode);
					}
				}
				if (code != null)
					return [{
						'object' : 'cards',
						'field' : 'value',
						'value' : code,
						'operator' : '==',
						'connector' : 'AND'
					}];
				return [];
			}
		}
	],
	'fields' : {

		'image' : {
			'label' : 'Image',
			'type' : 'image',
			'isField' : false,
			'get' : function(obj){ return  '/user_get_image.fcgi?user_id=' + obj.id }
		},

		'id' :  {
			'label' : 'Id',
			'value' : 0,
			'type' : 'BigInt',
			'PK' : true
		},

		'name' : {
			'label' : 'Name',
			'type' : 'text',
			'not_null' : true,
			'description' : true
		},

		'registration' : {
			'label' : 'Employee ID',
			'type' : 'text',
		},

		'password' : {
			'label' : 'Password',
			'type' : 'password',
			'beforeSave': function(obj, value) {
				var result = MessengerUtil.send('user_hash_password', {'password': value});
				obj.setValue("salt", result.salt);
				return result.password;
			}
		},
		'salt' : {
			'label' : 'Salt',
			'type' : 'text',
			'show': false
		},
		'begin_time': {
			'label': 'Start Date',
			'isField': true,
			'type': 'date',
			'value' : 0,
			'not_null' : false,
			'showTable' : true,
			'get' : function(obj) {
				if(!obj.isLoaded || obj['begin_time'] === 0)
					return '';
				var dateTime = obj['begin_time'] * 1000;
				var time = dateTime % 86400000; /*Milliseconds in a day*/;
				return (dateTime - time) / 1000;
			},
			'beforeSave': function(obj, value) {
				var _begin_time = obj.getValue('_begin_time') === '' ? 0 : obj.getValue('_begin_time');
				return value + _begin_time;
			}
		},
		'_begin_time' : {
			'label': 'Start Time',
			'isField': false,
			'type': 'time',
			'get': function(obj) {
				if(!obj.isLoaded || obj['begin_time'] === 0)
					return '';
				return obj['begin_time'] % 86400 /*Milliseconds in a day*/;
			}
		},
		'end_time': {
			'label': 'End Date',
			'isField': true,
			'type': 'date',
			'value' : 0,
			'not_null' : false,
			'showTable' : true,
			'get' : function(obj) {
				if(!obj.isLoaded || obj['end_time'] === 0)
					return '';
				var dateTime = obj['end_time'] * 1000;
				var time = dateTime % 86400000; /*Milliseconds in a day*/;
				return (dateTime - time) / 1000;
			},
			'beforeSave': function(obj, value) {
				var _end_time = obj.getValue('_end_time') === '' ? 0 : obj.getValue('_end_time');
				return value + _end_time;
			}
		},
		'_end_time' : {
			'label': 'End Time',
			'isField': false,
			'type': 'time',
			'get': function(obj) {
				if(!obj.isLoaded || obj['end_time'] === 0)
					return '';
				return obj['end_time'] % 86400 /*Milliseconds in a day*/;
			}
		},
		'groups' : {
			'label' : 'Groups',
			'value' : [1],
			'type' : 'list',
			'isField' : false,
			'showTable' : true,
			'intermediateTable' : {
				'table' : 'user_groups',
				'pk' : 'user_id',
				'fk' : 'group_id'
			}
		},
		'user_type_id' : {
			'type' : 'int',
			'object' : 'user_types',
			'show': false,
			'isField': true,
			'showTable':false,
			'not_null': false,
			'value': null,
			'afterSave' : function(obj){
				if(obj.isLoaded){
					var custom_table = MessengerUtil.send('load_objects', {'object': 'custom_tables', where:{'custom_tables':{'id' : obj.valuesDefault.custom_tables.id}}});
					var table_name = custom_table.custom_tables[0].table_name;
					if(table_name){
						var where = {};
						where[table_name] = {'user_id' : obj.id};
						MessengerUtil.send('destroy_objects', {'object': table_name, where: where});
					}
				}
				return obj.user_type_id;
			}
		},

		/*'time_zones' : {
			'label' : 'Horários',
			'type' : 'list',
			'isField' : false,
			'intermediateTable' : {
				'table' : 'access_rule_time_zones',
				'pk' : 'access_rule_id',
				'fk' : 'time_zone_id'
			},
			'listBy' : 'access_rules',
			'intermediateTableBy' : {
				'table' : 'user_access_rules',
				'pk' : 'user_id',
				'fk' : 'access_rule_id'
			},
		},*/

		'cards' : {
			'label' : 'Cards',
			'type' : 'listEdit',
			// 'showTable' : true,
			// 'show' : false,
			'remoteEnroll' : true,
			'isField' : false,
			'afterSave' : function(object, lstObjects){
				lstObjects.forEach(function(obj){
					obj.object.user_id = object.id;
				});
				return lstObjects;
			}
		},

		'qrcodes' : {
			'label' : 'QR Codes',
			'type' : 'listEdit',
			'showTable' : qrcode_alpha,
			'show' : qrcode_alpha,
			'isField' : false,
			'afterSave' : function(object, lstObjects){
				if (qrcode_alpha) {
					lstObjects.forEach(function(obj){
						obj.object.user_id = object.id;
					});
					return lstObjects;
				}
			}
		},

		'face_templates' : {
			'label' : 'Faces',
			'type' : 'listedit',
			'showTable' : false,
			'show' : false,
			'isField' : false,
			'afterSave' : function(object, lstObjects){
				lstObjects.forEach(function(obj){
					obj.object.user_id = object.id;
				});
				return lstObjects;
			}
		},

		'face' : {
			'label' : 'Face',
			'type' : 'boolean',
			'value' : true,
			'not_null' : true,
			'show' : false,
			'showTable' : true,
			'isField' : false,
			'get' : function(obj){
				var hasFace = false;
				new face_templates().list({'object' : obj, 'async' : false},
					function(lst){
						hasFace = lst.length > 0;
						console.log(hasFace);
					}
				);
				console.log(obj);
				return hasFace;
			}
		},


		'opening_time' : {
			'label' : 'Opening time (ms)',
			'type' : 'text',
			'isField' : false,
			'show' : is_idflex,
			'showTable' : false,
			'get' : function(object){
				var data = MessengerUtil.send(
					'load_objects',
					{
						'object' : 'opening_times',
						'fields' : ['id', 'user_id', 'door_id', 'time'],
						'where' : [{
							'object' : 'opening_times',
							'field' : 'user_id',
							'value' : object.id
						}],
						'limit' : 1
					}, null, true
				);
				if(data.opening_times.length == 0)
					return '';
				var time;
				for (var op_time in data.opening_times) {
					time = data.opening_times[op_time].time;
				}
				return time;
			},
			'save' : function(object, value){
				var time = parseInt(value);
				if (!isNaN(time) && (time < 100 || time > 10000)) {
					CID.AlertError({'validate' : ['Opening time must be between 100 ms and 10000 ms']});
					return;
				}
				var isNew;
				var nextId;
				var data = MessengerUtil.send(
					'load_objects',
					{
						'object' : 'opening_times',
						'fields' : ['id', 'user_id', 'door_id', 'time'],
						'order' : [{ 'object' : 'opening_times', 'field' : 'id' }]
					}
				);
				if (data.opening_times.length == 0) {
					nextId = 1;
				} else {
					nextId = data.opening_times[data.opening_times.length - 1].id + 1;
				}
				data = MessengerUtil.send(
					'load_objects',
					{
						'object' : 'opening_times',
						'fields' : ['id', 'user_id', 'door_id', 'time'],
						'where' : [{
							'object' : 'opening_times',
							'field' : 'user_id',
							'value' : object.id
						}],
						'limit' : 2
					}, null, true
				);
				if(data.opening_times.length == 0){
					isNew = true;
				} else {
					isNew = false;
				}
				if(!isNaN(time)){
					if(isNew){
						var result = MessengerUtil.send(
							'create_objects',
							{
								'object' : 'opening_times',
								'fields' : ['id', 'user_id', 'door_id', 'time'],
								'values' : [{
									'id' : nextId,
									'user_id' : object.id,
									'door_id' : 65793,
									'time' : time
								}]
							}, null, true
						);
					} else  {
						MessengerUtil.send(
							'modify_objects',
							{
								'object' : 'opening_times',
								'fields' : ['time'],
								'where' : [{
									'object' : 'opening_times',
									'field' : 'user_id',
									'value' : object.id
								},{
									'object' : 'opening_times',
									'field' : 'door_id',
									'value' : 65793
								}],
								'values' : {
									'time' : time
								}
							}, null, true
						);
					}
				} else {
					if (!isNew) {
						MessengerUtil.send(
							'destroy_objects',
							{
								'object' : 'opening_times',
								'where' : [{
									'object' : 'opening_times',
									'field' : 'user_id',
									'value' : object.id
								},{
									'object' : 'opening_times',
									'field' : 'door_id',
									'value' : 65793
								}]
							}, null, true
						);
					}
				}
			}
		},
		'last_access': {
			'label': 'Last Access Date',
			'isField': true,
			'type': 'date',
			'value' : 0,
			'not_null' : false,
			'showTable' : true,
			'get' : function(obj) {
				if(!obj.isLoaded || obj['last_access'] === 0)
					return '';
				var dateTime = obj['last_access'] * 1000;
				var time = dateTime % 86400000; /*Milliseconds in a day*/;
				return (dateTime - time) / 1000;
			},
			'beforeSave': function(obj, value) {
			var _last_access = obj.getValue('_last_access') === '' ? 0 : obj.getValue('_last_access');
			return value + _last_access;
			},
		},
		'_last_access' : {
			'label': 'Last Access Time',
			'isField': false,
			'type': 'time',
			'get': function(obj) {
				if(!obj.isLoaded || obj['last_access'] === 0)
					return '';
				return obj['last_access'] % 86400 /*Milliseconds in a day*/;
			}
		}
		/*'user_type': {
			'label' : 'Tipo de Usuário',
			'type' : 'object',
			'object': 'user_types',
			'value': 0,
			'isField': false,
			'showTable': false,
			'not_null': false,
			'intermediateTable' : {
				'table' : 'user_types',
				'pk' : 'id',
				'fk' : 'user_type_id'
			},

			'afterGet' : function(obj, value){
				//value =
				console.log(value);
				//value.setValue(value.foreign_key, obj.id);
				//return value;
			},
			'beforeSave': function(obj, value) {
				console.log(value);
				console.log(obj);
				teste1 = obj;
				//obj.setValue('user_type_id', value)
				//obj. = value;
			},
			'show': true
		},*/
	}
};
userData.fields.c_users = {
	'label' : 'Custom Fields',
	'type' : 'fields',
	'fieldType' : 'single',
	'isField': false,
	'showTable': true,
	'afterGet' : function(obj, value){
		value.user_id = obj.id;
		return value;

	},
	'beforeSave' : function(obj, value){
		value.user_id = obj.id;
		return value;
	}
};
if (is_server) {
	userData.fields.api_logins = {
		'label' : 'Login',
		'type' : 'fields',
		'fieldType' : 'single',
		'isField' : false,
		'show' : false,
		'afterGet' : function(obj, value){
			value.user_id = obj.id;
			return value;

		},
		'beforeSave' : function(obj, value){
			value.user_id = obj.id;
			return value;
		}
	};
	userData.fields.devs = {
		'label' : 'Devices',
		'isField': false,
		'type': 'listEdit',
		'listEdit' : true,
		'listAdd' : false,
		'listRemove' : false,
		'showTable': false,
		'set': function(obj, value) {
			for(var key in value){
				value[key].object.user = obj;
			}
			return value;
		},
		'defaultWhere': function(where) { return []; }
	};
	userData.fields.area_users = {
		'label' : 'Areas',
		'isField': false,
		'type': 'listEdit',
		'listEdit' : true,
		'listAdd' : false,
		'listRemove' : false,
		'showTable': false,
		'set': function(obj, value) {
			for(var key in value){
				value[key].object.user = obj;
			}
			return value;
		},
		'defaultWhere': function(where) { return []; }
	}
}
else {
	userData.fields.time_zones = {
		'label' : 'Time Zones',
		'type' : 'list',
		'isField' : false,
		'showTable' : false,
		'intermediateTable' : {
			'table' : 'access_rule_time_zones',
			'pk' : 'access_rule_id',
			'fk' : 'time_zone_id'
		},
		'listBy' : 'access_rules',
		'intermediateTableBy' : [
		{
			'table' : 'portal_access_rules',
			'pkCallback' : function(obj){
				var lst = [];

				Main.currentDevice().portals.forEach(function(portal){
					lst.push(portal.getValue(portal.PK));
				});
				return lst;
			},
			'pk' : 'portal_id',
			'fk' : 'access_rule_id'
		},
		{
			'table' : 'user_access_rules',
			'pk' : 'user_id',
			'fk' : 'access_rule_id'
		}],
	};
}
userData.fields.administrator = {
	'label' : 'Administrator',
	'value' : true,
	'type' : 'boolean',
	'show' : false,
	'not_null' : true,
	'isField' : false,
	'get' : function(obj){
		var isAdmin = false;
		new user_roles().list({'object' : obj, 'async' : false},
			function(lst){
				lst.forEach(function(role){
					if(role.role === 1)
						isAdmin = true;
				});
			}
		);
		return  isAdmin;
	},
	'afterSave' : function(obj, value){
		var role = new user_roles();
		role.user_id = obj.id;
		if(value === true){
			role.role = 1;
			role.save();
		}else
			role.remove({
				'where' : [{
					'field' : 'role',
					'value' : 1
				}]
			});
	}
};

userData.defaultWhere = function(defaultWhere) {
	/*defaultWhere.push({
			'object' : 'user_roles',
			'field' : 'role',
			'value' : 2,
			'operator' : '!=',
			'connector' : 'OR'
		});
	defaultWhere.push(
		{
			'object' : 'user_roles',
			'field' : 'role',
			'operator' : 'IS NULL',
			'connector' : ') AND ('
		});*/
	return defaultWhere;
}

/*

userData.fields.visitor = {
	'label' : 'Visitante',
	'value' : false,
	'type' : 'boolean',
	'not_null' : true,
	'defaultValue' : false,
	'show': false,
	'showTable' : false,
	'isField' : false,
	'get' : function(obj){
		var isVisitor = false;
		new user_roles().list({'object' : obj, 'async' : false},
			function(lst){
				lst.forEach(function(role){
					if(role.role === 2)
						isVisitor = true;
				});
			}
		);
		return  isVisitor;
	},
	'afterSave' : function(obj, value){
		var role = new user_roles();
		role.user_id = obj.id;
		if(value === true){
			role.role = 2;
			role.save();
		}else
			role.remove({
				'where' : [{
					'field' : 'role',
					'value' : 2
				}]
			});
	}
};
*/


/*u.fn.defineNewField({'access_rules' : { 'label' : 'Regras de Acesso', 'value' : '', 'type' : 'list',
	'intermediateTable' : { 'table' : 'access_rule_time_zones', 'pk' : 'access_rule_id', 'fk' : 'time_zone_id' },
	'not_null' : false, 'isField' : false }});*/









/* Tabela Layouts */



var default_objects =
{
	/*'groups':
	{
		'name' : 'groups',
		'alias' : 'Departamento',
		'fields' : {
			'id' : { 'label' : 'Código', 'value' : 0, 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
			'name' : { 'label' : 'Nome', 'value' : '', 'type' : 'text', 'not_null' : true, 'description' : true },
			'users' :  {
				'label' : 'Usuários', 'value' : '',
				'type' : 'list',
				'intermediateTable' : { 'table' : 'user_groups', 'pk' : 'group_id', 'fk' : 'user_id' },
				'not_null' : false, 'isField' : false
			},
			'time_zones' : {
				'label' : 'Horários', 'value' : [1],
				'type' : 'list',
				'intermediateTable' : { 'table' : 'access_rule_time_zones', 'pk' : 'access_rule_id', 'fk' : 'time_zone_id' },
				'listBy' : 'access_rules',
				'intermediateTableBy' : { 'table' : 'group_access_rules', 'pk' : 'group_id', 'fk' : 'access_rule_id' },
				'not_null' : false, 'isField' : false
			}
		}
	},*/
	'users': userData

}





function ReadForms() {
	/*var forms = [
		{
			'id' : 1,
			'object': 'users',
			'name': 'Usuáriossss',
			'form': 'users'
		}
	];*/
	var forms = MessengerUtil.send('load_objects', {'object': 'forms'}).forms;

	forms.forEach(function (form) {

		var new_form = default_objects[form.form || form.object];
		for (var key in form)
			new_form[key] = form[key];
		c = new_form;
		ReadTabs(new_form);

		CID.createClass(new_form);

	});
}

function ReadTabs(form) {
	/*var tabs = [
		{
			'id': 0,
			'name': 'Nova Tab'
		}
	];*/
	var tabs = MessengerUtil.send('load_objects', {'object': 'tabs', 'where': {'tabs': { 'form_id': form.id } } }).tabs;

	form.tabs = {};
	tabs.forEach(function (tab) {
		form.tabs[tab.id] = tab.name;
		ReadFields(form, tab.id);
	});
}

function ReadFields(form, tab_id) {
	/*var fields = [
		{
			'id': 0,
			'is_default': true,
			'label': 'Código do Grupo',
			'column': 'id',
			'type': 'int',
			'sequence': '0'
		},
		{
			'id': 1,
			'is_default': false,
			'label': 'RG',
			'column': 'column_1',
			'type': 'text',
			'sequence': '1'
		}
	];*/
	var fields = MessengerUtil.send('load_objects', {'object': 'fields', 'where': {'fields': { 'tab_id': tab_id} } }).fields;

	if (!form.fields)
		form.fields = {};
	/*
'id' : { 'label' : 'Código', 'value' : '', 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
		'user_id' : { 'label' : 'Usuário', 'value' : '', 'type' : 'int', 'not_null' : true, 'show' : false },

	*/
	var auxiliar_form = {
		'object': 'c_' + form.object,
		'form': 'c_' + form.form,
		'fields': {
			'id': { 'label' : 'Auxiliary Code', 'value' : '', 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false }
		},
		'order' : ['id']
	};
	auxiliar_form['foreign_key'] = (form.object.charAt(form.object.length-1)=='s' ? form.object.substring(0,form.object.length-1) : form.object) + '_id';
	auxiliar_form.fields[auxiliar_form.foreign_key] = { 'label': 'User', 'value': '', 'not_null': true, 'show': false, 'type': 'int', 'PK': false}
	fields.forEach(function (field) {
		var current_form = form;
		if (!field.is_default)
			current_form = auxiliar_form;
		if (!current_form.fields[field.column])
			current_form.fields[field.column] = {};
		for (var key in field)
			current_form.fields[field.column][key] = field[key];

		ReadProperties(current_form, field);
	});
	form.fields[auxiliar_form.form] = {
		'label' : 'Custom Fields',
		'type' : 'fields',
		'fieldType' : 'single',
		'isField': false,
		'showTable': false,
		'afterGet' : function(obj, value){
			value.setValue(value.foreign_key, obj.id);
			return value;
		},
		'beforeSave' : function(obj, value){
			t = this;
			v = value;
			o = obj;
			a = auxiliar_form;
			value.setValue(auxiliar_form.foreign_key, obj.id);
			return value;
		}
	};
	CID.createClass(auxiliar_form);
}

function ReadProperties(form, field) {
	var properties = MessengerUtil.send('load_objects', {'object': 'properties', 'where': {'properties': { 'field_id': field.id } } }).properties;
	properties.forEach(function (property) {
		form.fields[field.column][property.key] = property.value;
	});
}

//ReadForms();

CID.createClass(userData);

//Cria classes para cada tipo de usuário
function CreateUserTypesClass() {
	//c_users
	new_c_users = {
		'object' : 'c_users',
		'order' : ['id'],
		'fields' : {
			'user_id': { 'show': false, 'type': 'BigInt'},
			'id' : { 'label' : 'Id', 'value' : '', 'type' : 'BigInt', 'not_null' : false, 'PK' : true, 'show' : false }
		}
	};

	//c_visits
	new_c_visits = {
		'object' : 'c_visits',
		'order' : ['id'],
		'fields' : {
			'visit_id': { 'show': false, 'type': 'BigInt'},
			'id' : { 'label' : 'Id', 'value' : '', 'type' : 'BigInt', 'not_null' : false, 'PK' : true, 'show' : false }
		}
	};

	_IterateFields(1, function (inner_val) {
		new_c_users.fields[inner_val.values['column_name']] = {
				'label': inner_val.values['name'],
				'show': true,
				'showTable': false,
				'not_null': inner_val.not_null,
				'defaultValue': inner_val.default_value,
				'type': inner_val.type.object.js_value
			};
	});

	_IterateFields(2, function (inner_val) {
		new_c_visits.fields[inner_val.values['column_name']] = {
				'label': inner_val.values['name'],
				'show': true,
				'showTable': true,
				'not_null': inner_val.not_null,
				'defaultValue': inner_val.default_value,
				'type': inner_val.type.object.js_value
			};
	});

	CID.createClass(new_c_users);
	CID.createClass(new_c_visits);

	var result_tables = MessengerUtil.send('load_objects', {
				'object': 'user_types',
				'join': 'LEFT',
				'fields': ['id', 'require_visitor', { 'object': 'custom_tables', 'field': 'name' },
				{ 'object': 'custom_tables', 'field': 'id' }, { 'object': 'custom_tables', 'field': 'table_name' } ],
				'order': [{ 'object': 'custom_tables', 'field': 'name'}]
			}, null, true);
	$.each(result_tables.user_types, function (key, val) {
		var userTypeClass = jQuery.extend(true, {}, userData);

		if(val.require_visitor) {
			userTypeClass.fields.administrator.show = false;
			userTypeClass.functions = {
				is_visitor: function() {
					return true;
				}
			};
		}
		else {
			userTypeClass.fields.administrator.show = true;
			userTypeClass.functions = {
				is_visitor: function() {
					return false;
				}
			};
		}

		userTypeClass.form = 'usertype' + val.id;
		userTypeClass.name = val['custom_tables.name'];
		var custom_table = {
			'object' : val['custom_tables.table_name'],
			'order' : ['id'],
			'fields' : {
				'user_id': { 'show': false, 'type': 'BigInt'},
				'id' : { 'label' : 'Code', 'value': '', 'type' : 'BigInt', 'not_null' : false, 'PK' : true, 'show' : false }
			},
		};
		userTypeClass.defaultWhere = function(defaultWhere) {
			//defaultWhere = [];
			defaultWhere.push({
				'object': 'user_types',
				'field': 'id',
				'value': val.id,
				'connector': ') AND ('
			});
			return defaultWhere;
		}
		userTypeClass.fields.user_type_id.isField = true;
		userTypeClass.fields.user_type_id.defaultValue = val.id;
		userTypeClass.fields.user_type_id.get = function() { return val.id };



		//Pega os campos a mais
		_IterateFields(val['custom_tables.id'] , function (inner_val) {
			custom_table.fields[inner_val.values['column_name']] = {
				'label': inner_val.values['name'],
				'show': true,
				'showTable': false,
				'not_null': inner_val.not_null,
				//'defaultValue': inner_val.default_value,
				'type': inner_val.type.object.js_value,
				'doNotSave' : false,
				// 'save' : function(obj){
				// 	// if (!custom_table.doNotSave){
				// 		obj.save({'newSave': false});
				// 	// }
				// 	// else{
				// 		// obj.isLoaded = true;
				// 		// obj.save({'newSave': false});
				// 	// }
				// }
			};
		});

		userTypeClass.fields[val['custom_tables.table_name']] = {
			'label' : 'Specific Custom Fields',
			'type' : 'fields',
			'fieldType' : 'single',
			'isField': false,
			'showTable': false,
			//'fieldId': 'user_id',
			'afterGet' : function(obj, value){
				value.user_id = obj.id;
				return value;

			},
			'beforeSave' : function(obj, value){
				if(obj.values.user_type_id != obj.valuesDefault.user_type_id){
					var lst = [];
					custom_columns.fn.list({'async': false, 'where': [{ 'object': 'custom_tables', 'field': 'id', 'value': val['custom_tables.id']  }]},
						function(_lst) {
							lst = lst.concat(_lst);
					});
					for (var i = lst.length - 1; i >= 0; i--) {
						obj[val['custom_tables.table_name']].fields[lst[i].values['column_name']].doNotSave = true;
					};

				}
			}
		};
		CID.createClass(custom_table);
		CID.createClass(userTypeClass);
	});

	// Default user creation
	var defaultUser = jQuery.extend(true, {}, userData);
	defaultUser.fields.administrator.show = true;

	defaultUser.form = 'default_user';
	defaultUser.name = 'Default Users';
	defaultUser.defaultWhere = function(defaultWhere) {
		defaultWhere.push({
			'object': 'users',
			'field': 'user_type_id',
			'operator': '=',
			'value': 0,
			'connector': 'OR'
		});
		defaultWhere.push({
			'object': 'users',
			'field': 'user_type_id',
			'operator': 'IS NULL',
			'connector': ') AND ('
		});
		return defaultWhere;
	}
	CID.createClass(defaultUser);
}

function _IterateFields(table_id, funct) {
	//Pega os campos a mais
	var lst = [];
	custom_columns.fn.list({'async': false, 'where': [{ 'object': 'custom_tables', 'field': 'id', 'value': table_id  }]},
		function(_lst) {
			lst = lst.concat(_lst);
	});

	$.each(lst, function (inner_key, inner_val) {
		funct(inner_val);
	});
}

CreateUserTypesClass();
//Usuários anfitriões
var host_users_obj = jQuery.extend(true, {}, userData);
host_users_obj.form = 'host_users';
host_users_obj.name = 'Hosts';
host_users_obj.defaultWhere = function (whereAtual) {
	defaultWhere = [];
	defaultWhere.push({
		'object': 'user_types',
		'field': 'require_visitor',
		'value': 0,
		'connector': 'OR'
	});
	defaultWhere.push({
		'object': 'users',
		'field': 'user_type_id',
		'operator': '=',
		'value': 0,
		'connector': 'OR'
	});
	defaultWhere.push({
		'object': 'users',
		'field': 'user_type_id',
		'operator': 'IS NULL',
		'connector': ') AND ('
	});

	return defaultWhere;
}
CID.createClass(host_users_obj);
//Usuário visitantes
var visit_users_obj = jQuery.extend(true, {}, userData);
visit_users_obj.form = 'visit_users';
visit_users_obj.name = 'Visitors';
visit_users_obj.defaultWhere = function (whereAtual) {
	defaultWhere = [];
	defaultWhere.push({
		'object': 'user_types',
		'field': 'require_visitor',
		'value': 1,
		'connector': ') AND ('
	});
	return defaultWhere;
}
CID.createClass(visit_users_obj);

/*
var visitorData = jQuery.extend(true, {}, userData);

visitorData.form = 'visitors'
visitorData.name = 'Visitante';
visitorData.defaultWhere = function (where) { where.push({
							'object' : 'user_roles',
							'field' : 'role',
							'value' : 2
						});
						return where;
					}
visitorData.fields.administrator.show = false;
visitorData.fields['expires'] = {
			'label': 'Data de Expiração',
			'type': 'date'
		};
visitorData.fields.visitor.defaultValue = true;
visitorData.fields.visitor.get = function () { return true; }


CID.createClass(visitorData);
*/

// userData.fields.visitor.show = true;


var groupsData =
	{
		'object' : 'groups',
		'name' : 'Groups',
		'noSave' : [1],
		'fields' : {
			'id' : { 'label' : 'Id', 'value' : 0, 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
			'name' : { 'label' : 'Name', 'value' : '', 'type' : 'text', 'not_null' : true, 'description' : true },
			'users' :  {
				'label' : 'Users', 'value' : '',
				'type' : 'list',
				'intermediateTable' : { 'table' : 'user_groups', 'pk' : 'group_id', 'fk' : 'user_id' },
				'not_null' : false, 'isField' : false
			},
			/*'time_zones' : {
				'noSave' : {1 : [1]},
				'label' : 'Horários', 'value' : [1],
				'type' : 'list',
				'intermediateTable' : { 'table' : 'access_rule_time_zones', 'pk' : 'time_zone_id', 'fk' : 'access_rule_id' },
				'listBy' : 'access_rules',
				'intermediateTableBy' : [{ 'table' : 'group_access_rules', 'pk' : 'group_id', 'fk' : 'access_rule_id' }],
				'not_null' : false, 'isField' : false
			}*/

		}
	};

if (is_server) {
	groupsData.fields.dev_groups = {
		'label' : 'Devices',
		'isField': false,
		'type': 'listEdit',
		'listEdit' : true,
		'listAdd' : false,
		'listRemove' : false,
		'showTable': false,
		'set': function(obj, value) {
			for(var key in value){
				value[key].object.group = obj;
			}
			return value;
		},
		'defaultWhere': function(where) { return []; }
	};
	groupsData.fields.area_groups = {
		'label' : 'Areas',
		'isField': false,
		'type': 'listEdit',
		'listEdit' : true,
		'listAdd' : false,
		'listRemove' : false,
		'showTable': false,
		'set': function(obj, value) {
			for(var key in value){
				value[key].object.group = obj;
			}
			return value;
		},
		'defaultWhere': function(where) { return []; }
	};
}
else {
	groupsData.fields.time_zones = {
		'noSave' : {1 : [1]},
		'label' : 'Time Zones', 'value' : [1],
		'type' : 'list',
		'intermediateTable' : { 'table' : 'access_rule_time_zones', 'pk' : 'access_rule_id', 'fk' : 'time_zone_id' },
		'listBy' : 'access_rules',
		'intermediateTableBy' :
		[
		{
			'table' : 'portal_access_rules',
			'pkCallback' : function(obj){
				var lst = [];
				Main.currentDevice().portals.forEach(function(portal){
					lst.push(portal.getValue(portal.PK));
				});
				return lst;
			},
			'pk' : 'portal_id',
			'fk' : 'access_rule_id'
		},
		{
			'table' : 'group_access_rules',
			'pk' : 'group_id',
			'fk' : 'access_rule_id' }
		],
		'not_null' : false, 'isField' : false
	};
}

CID.createClass(groupsData);

var scheduledUnlockData =
	{
		'object' : 'scheduled_unlocks',
		'name'   : 'Scheduled Unlock',
		'fields' : {
			'id'         : { 'label' : 'Id', 'value' : 0, 'type' : 'int', 'not_null' : false, 'PK' : true, 'show' : false },
			'name'       : { 'label' : 'Name', 'value' : '', 'type' : 'text', 'not_null' : true, 'description' : true },
			'message'    : { 'label' : 'Message', 'value' : '', 'type' : 'text', 'not_null' : false, 'description' : true },
			'time_zones' : {
				'label'               : 'Time Zones',
				'value'               : [1],
				'type'                : 'list',
				'intermediateTable'   : { 'table' : 'access_rule_time_zones', 'pk' : 'access_rule_id', 'fk' : 'time_zone_id' },
				'listBy'              : 'access_rules',
				'intermediateTableBy' : [
					{
						'table'      : 'portal_access_rules',
						'pkCallback' : function(obj){
							var lst = [];
							Main.currentDevice().portals.forEach(function(portal){
								lst.push(portal.getValue(portal.PK));
							});
							return lst;
						},
						'pk'         : 'portal_id',
						'fk'         : 'access_rule_id'
					},
					{
						'table'      : 'scheduled_unlock_access_rules',
						'pk'         : 'scheduled_unlock_id',
						'fk'         : 'access_rule_id'
					}
				],
				'not_null'            : false,
				'isField'             : false
			}
		}
	};
CID.createClass(scheduledUnlockData);

//# sourceURL=class.js
