function splitAndUnescapeRow(row, delimiter) {
	var result = [];
	result.push('');
	for (var i = 0; i < row.length; i++) {
		switch (row[i]) {
			case '\\':
				result[result.length - 1] += row[++i];
				break;
			case ';':
				result.push('');
				break;
			default:
				result[result.length - 1] += row[i];
				break;
		}
	}
	return result;
}

function Report(){
	var $enumTypes = {
		'int' : {
			'label' : 'Number',
			'format' : { 'adjustment': 2, 'width': 15, 'fill': '0', 'format' : '%s'}
		},
		'text' : {
			'label' : 'Text',
			'format' : { 'adjustment': 1, 'width': 50, 'fill': ' ', 'format' : '%s'}
		},
		'boolean' : {
			'label' : 'True or False',
			'format' : { 'adjustment': 1, 'width': 1, 'fill': ' ', 'format' : '%s' }
		},
		'accessevent' : {
			'label' : 'Access Type',
			'format' : { 'adjustment': 2, 'width': 2, 'fill': '0', 'format' : '%s' }
		},
		'alarmevent' : {
			'label' : 'Alarm Event',
			'format' : { 'adjustment': 1, 'width': 1, 'fill': ' ', 'format' : '%s' }
		},
		'alarmcause' : {
			'label' : 'Alarm Cause',
			'format' : { 'adjustment': 2, 'width': 2, 'fill': '0', 'format' : '%s' }
		},
		'datetime' : {
			'label' : 'Date and Time',
			'format' : { 'adjustment': 0, 'width': 0, 'fill': '0', 'format' : '%d/%m/%Y %H:%M:%S' }
		},
		'time' : {
			'label' : 'Time',
			'format' : { 'adjustment': 0, 'width': 0, 'fill': '0', 'format' : '%H:%M:S' }
		},
		'calltime' : {
			'label' : 'Time',
			'format' : { 'adjustment': 0, 'width': 0, 'fill': '0', 'format' : '%s' }
		},
		'callrole': {
			'label' : 'Call Type',
			'format' : { 'adjustment': 1, 'width': 1, 'fill': ' ', 'format' : '%s' }
		},
		'dtmfevent' : {
			'label' : 'Remote opening',
			'format' : { 'adjustment': 1, 'width': 1, 'fill': ' ', 'format' : '%s' }
		},
		'p2penable' : {
			'label' : 'Operation mode',
			'format' : { 'adjustment': 1, 'width': 1, 'fill': ' ', 'format' : '%s' }
		},
		'callstatus' : {
			'label' : 'Call status',
			'format' : { 'adjustment': 1, 'width': 1, 'fill': ' ', 'format' : '%s' }	
		},
		'identification' : {
			'label' : 'Identification',
			'format' : { 'adjustment': 1, 'width': 1, 'fill': ' ', 'format' : '%s' }	
		}
	};
	this.getTypes = function(){
		return $enumTypes;
	}

	var $enumAdjustment = {
		0 : 'Auto',
		1 : 'Left',
		2 : 'Right'
	};
	this.getAdjustment = function(){
		return $enumAdjustment;
	}


	var $elements = {
		'access_logs' : {
			'PK' : 'event',
			'order' : ['descending', 'time'],
			'object' : 'access_logs',
			'label' : 'Access Logs',
			'fields' : {
				'user_id' : {
					'object' : 'access_logs',
					'label' : 'User',
					'type' : 'int'
				},
				'time' : {
					'object' : 'access_logs',
					'label' : 'Date and Time',
					'type' : 'datetime'
				},
				'event' : {
					'object' : 'access_logs',
					'label' : 'Authorization',
					'type' : 'accessevent'
				},
				'log_type_id' : {
					'object' : 'access_logs',
					'label' : 'Register Status',
					'type' : 'int'
				},
				'identifier_id' : {
					'object' : 'access_logs',
					'label' : 'Identification',
					'type' : 'identification'
				}
			},
			'objects' : ['users', 'groups', 'time_zones', 'devices', 'areas', 'log_types']
		},

		'log_types' : {
			'PK' : 'id',
			'object' : 'log_types',
			'label' : 'Register Status',
			'fields' : {
				'id' : {
					'object' : 'log_types',
					'label' : 'Id',
					'type' : 'int'
				},
				'name' : {
					'object' : 'log_types',
					'label' : 'Name',
					'type' : 'text'
				}
			}
		},

		'alarm_logs' : {
			'PK' : [],
			'order' : ['descending', 'time'],
			'object' : 'alarm_logs',
			'label' : 'Alarm Logs',
			'fields' : {
				'time' : {
					'object' : 'alarm_logs',
					'label' : 'Date and Time',
					'type' : 'datetime'
				},
				'event' : {
					'object' : 'alarm_logs',
					'label' : 'Event',
					'type' : 'alarmevent'
				},
				'cause' : {
					'object' : 'alarm_logs',
					'label' : 'Cause',
					'type' : 'alarmcause'
				}
			}
		},

		'call_logs' : {
			'PK' : [],
			'order' : ['descending', 'time'],
			'object' : 'call_logs',
			'label' : 'Call Logs',
			'fields' : {
				'time' : {
					'object' : 'call_logs',
					'label' : 'Date and Time',
					'type' : 'datetime'
				},
				'role' : {
					'object' : 'call_logs',
					'label' : 'Call Type',
					'type' : 'callrole'
				},
				'remote_uri' : {
					'object' : 'call_logs',
					'label' : 'Contact',
					'type' : 'text'
				},
				'connection_time' : {
					'object' : 'call_logs',
					'label' : 'Duration (s)',
					'type' : 'calltime'
				},
				'dtmf_event' : {
					'object' : 'call_logs',
					'label' : 'Remote opening',
					'type' : 'dtmfevent'
				},
				'p2p_enable' : {
					'object' : 'call_logs',
					'label' : 'Operation mode',
					'type' : 'p2penable'
				},
				'call_status' : {
					'object' : 'call_logs',
					'label' : 'Call status',
					'type' : 'callstatus'
				}
			}
		},

		'portals' : {
		 	'PK' : 'id',
			'show' : false,
			'object' : 'portals',
			'label' : 'Portal',
			'fields' : {
				'name' : {
					'object' : 'portals',
					'label' : 'Name',
					'type' : 'text'
				}
			}
		},

		'users' : {
			'PK' : 'id',
			'object' : 'users',
			'label' : 'User',
			'fields' : {
				'id' : {
					'object' : 'users',
					'label' : 'Id',
					'type' : 'int'
				},
				'name' : {
					'object' : 'users',
					'label' : 'Name',
					'type' : 'text'
				},
				'registration' : {
					'object' : 'users',
					'label' : 'Employee ID',
					'type' :'text'
				},
				'password' : {
					'object' : 'users',
					'label' : 'Password',
					'type' : 'text'
				},
			},
			'objects' : ['c_users', 'groups', 'user_roles', 'time_zones']
		},

		'user_roles' : {
			'PK' : 'role',
			'show' : false,
			'object' : 'user_roles',
			'label' : 'Right',
			'fields' : {
				'role' : {
					'object' : 'user_roles',
					'label' : 'Administrator',
					'type' : 'boolean'
				}
			}
		},

		'groups' : {
			'PK' : 'id',
			'object' : 'groups',
			'label' : 'Group',
			'fields' : {
				'name' : {
					'object' : 'groups',
					'label' : 'Name',
					'type' : 'text'
				}
			},
			'objects' : ['users']
		},

		'devices' : {
			'PK' : 'id',
			'show' : false,
			'showFilter' : true,
			'object' : 'devices',
			'label' : 'Device',
			'fields' : {
				'name' : {
					'object' : 'devices',
					'label' : 'Name',
					'type' : 'text'
				}
			},
			'objects' : ['areas']
		},

		'areas' : {
			'PK' : 'id',
			'show' : false,
			'showFilter' : true,
			'object' : 'areas',
			'label' : 'Area',
			'fields' : {
				'name' : {
					'object' : 'areas',
					'label' : 'Name',
					'type' : 'text'
				}
			},
			//'objects' : ['users']
		},

		'time_zones' : {
			'PK' : 'id',
			'object' : 'time_zones',
			'label' : 'Time Zone',
			'fields' : {
				'name' : {
					'object' : 'time_zones',
					'label' : 'Name',
					'type' : 'text'
				}
			},
			'objects' : ['time_spans']
		},

		'time_spans' : {
			'PK' : 'id',
			'show' : false,
			'object' : 'time_spans',
			'label' : 'Time Span',
			'fields' : {
				'start' : {
					'object' : 'time_spans',
					'label' : 'Start',
					'type' : 'time'
				},
				'end' : {
					'object' : 'time_spans',
					'label' : 'End',
					'type' : 'time'
				},
				'mon' : {
					'object' : 'time_spans',
					'label' : 'Monday',
					'type' : 'boolean'
				},
				'tue' : {
					'object' : 'time_spans',
					'label' : 'Tuesday',
					'type' : 'boolean'
				},
				'wed' : {
					'object' : 'time_spans',
					'label' : 'Wednesday',
					'type' : 'boolean'
				},
				'thu' : {
					'object' : 'time_spans',
					'label' : 'Thursday',
					'type' : 'boolean'
				},
				'fri' : {
					'object' : 'time_spans',
					'label' : 'Friday',
					'type' : 'boolean'
				},
				'sat' : {
					'object' : 'time_spans',
					'label' : 'Saturday',
					'type' : 'boolean'
				},
				'sun' : {
					'object' : 'time_spans',
					'label' : 'Sunday',
					'type' : 'boolean'
				}
			}
		}
	};

	if (!Main.isIdAccess() && !Main.isIdFlex()) {
		$elements.visitors = {
			'PK' : 'id',
			'object' : 'users',
			'label' : 'Visitor',
			'show': false,
			'showFilter': true,
			'fields' : {
				'id' : {
					'object' : 'users',
					'label' : 'Id',
					'type' : 'int'
				},
				'name' : {
					'object' : 'users',
					'label' : 'Name',
					'type' : 'text'
				},
				'registration' : {
					'object' : 'users',
					'label' : 'Employee ID',
					'type' :'text'
				},
				'password' : {
					'object' : 'users',
					'label' : 'Password',
					'type' : 'text'
				},
			},
			'objects' : ['c_users', 'groups', 'user_roles', 'time_zones']
		};
		$elements.hosts = {
			'PK' : 'id',
			'object' : 'users',
			'label' : 'Host',
			'show': false,
			'fields' : {
				'id' : {
					'object' : 'users',
					'label' : 'Id',
					'type' : 'int'
				},
				'name' : {
					'object' : 'users',
					'label' : 'Name',
					'type' : 'text'
				},
				'registration' : {
					'object' : 'users',
					'label' : 'Employee ID',
					'type' :'text'
				},
				'password' : {
					'object' : 'users',
					'label' : 'Password',
					'type' : 'text'
				},
			},
			'objects' : ['c_users', 'groups', 'user_roles', 'time_zones']
		};
		$elements.visits = {
			'PK': 'id',
			'order': ['descending', 'begin_time'],
			'object': 'visits',
			'label': 'Visits',
			'fields': {
				'id' : {
					'object' : 'visits',
					'label' : 'Id',
					'type' : 'int'
				},
				'visitor_id': {
					'object': 'visits',
					'label': 'Visit',
					'type': 'int'
				},
				'begin_time': {
					'object': 'visits',
					'label': 'Start Date',
					'type': 'datetime'
				},
				'end_time': {
					'object': 'visits',
					'label': 'End Date',
					'type': 'datetime'
				},
				'finished': {
					'object': 'visits',
					'label': 'Concluded',
					'type': 'boolean'
				}
			},
			'objects': ['visitors', 'c_users', 'c_visits']
		};
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
	//Carrega tipos de usuário
	$elements.c_users = {
		'label': 'User',
		'PK': 'id',
		'object' : 'c_users',
		'show': false,
		'showFilter': false,
		'fields' : { }
	};
	if (!Main.isIdAccess() && !Main.isIdFlex()) {
		//Campos customizáveis das visitas
		$elements.c_visits = {
			'label': 'Visits',
			'PK': 'id',
			'object' : 'c_visits',
			'show': false,
			'showFilter': false,
			'fields' : { }
		};
	}

	_IterateFields(1, function (inner_val) {
		$elements.c_users.fields[inner_val.values['column_name']] = {
			'object': 'c_users',
			'label': inner_val.values['name'],
			'type': inner_val.type.object.js_value
		};
	});

	_IterateFields(2, function (inner_val) {
		$elements.c_visits.fields[inner_val.values['column_name']] = {
			'object': 'c_visits',
			'label': inner_val.values['name'],
			'type': inner_val.type.object.js_value
		};
	});

	var visitors_user_types = [];

	if (!Main.isIdAccess() && !Main.isIdFlex()) {
		var result_tables = MessengerUtil.send('load_objects', {
					'object': 'user_types',
					'join': 'LEFT',
					'fields': ['id', { 'object': 'custom_tables', 'field': 'name' }, 'require_visitor',
					{ 'object': 'custom_tables', 'field': 'id' }, { 'object': 'custom_tables', 'field': 'table_name' } ],
					'order': [{ 'object': 'custom_tables', 'field': 'name'}]
				}, null, true);

		$.each(result_tables.user_types, function (key, val) {
			if (val['require_visitor'] == 1)
				visitors_user_types.push(val.id);
			//Copia c_users
			$elements['c_users_user_type' + val.id] = jQuery.extend(true, {}, $elements.c_users);
			$elements['c_users_user_type' + val.id].label = val['custom_tables.name'];

			$elements['user_type' + val.id] = jQuery.extend(true, {}, $elements.users);
			$elements['user_type' + val.id].label = val['custom_tables.name'];

			$elements['user_type' + val.id].objects[0] = 'c_users_user_type' + val.id;
			$elements['user_type' + val.id].objects.splice(1, 0, val['custom_tables.table_name']);

			$elements['user_type' + val.id].defaultWhere = {
				'users': {
					'user_type_id': [val.id]
				}
			};

			$elements[val['custom_tables.table_name']] = {
				'PK': 'id',
				'label': val['custom_tables.name'],
				'object' : val['custom_tables.table_name'],
				'show': false,
				'showFilter': false,
				'fields' : { }
			};

			_IterateFields(val['custom_tables.id'] , function (inner_val) {
				$elements[val['custom_tables.table_name']].fields[inner_val.values['column_name']] = {
					'object': val['custom_tables.table_name'],
					'label': inner_val.values['name'],
					'type': inner_val.type.object.js_value
				};
			});
		});
	}

	/*Removido para mostrar todos os usuários (e não apenas visitas) em visitors
	$elements.visitors.defaultWhere = {
		'users': {
			'user_type_id': visitors_user_types
		}
	};*/

	this.getElements= function(){
		return $elements;
	}

	var $reportID = null;
	var $reportName = '';
	var $reportFileName = '';
	var $formattedFileName = '';
	var $reportObject = '';
	var $reportDelimiter = '';
	var $reportLineBreak = '';
	var $reportHeader = '';
	var $fakeHeader = [];
	var $reportColumns = [];

	this.getFormattedFileName = function(){
		if($formattedFileName == ''){
			var dt = Main.getInfo().date;
			return $reportName + ' ' +
				('00' + dt.getUTCDate()).slice(-2) + '-' +
				('00' + (dt.getUTCMonth()+1)).slice(-2) + '-' +
				dt.getUTCFullYear().toString() + ' ' +
				('00' + dt.getUTCHours()).slice(-2) + '.' +
				('00' + dt.getUTCMinutes()).slice(-2) + '.csv' ;
		}
		return $formattedFileName;
	};

	this.getExportFileName = function(){
		return $reportFileName;
	};

	this.getFakeHeader = function(){
		return $fakeHeader;
	};

	this.setHeader = function(header){
		$reportHeader = header;
	};

	this.getElements = function(){
		return $elements;
	};

	this.getOrder = function(){
		var obj = $elements[$reportObject];
		if('order' in  obj)
			return obj.order;
		else if('name' in obj.fields)
			return ['ascending', 'name'];
		else
			[];
	};

	this.load = function(id){
		$reportID = parseInt(id);
		var data = MessengerUtil.send(
			'load_objects',
			{
			   'object':'reports',
				'where' : {
					'reports' : {
						'id' : $reportID
					}
				}
			}
		);
		if(data.reports.length === 0){
			return false;
		}
		data = data.reports[0];
		$reportName = data.name;
		$reportFileName = data.file_name;
		$reportObject = data.object;
		$reportHeader = data.header;
		$reportDelimiter = data.delimiter;
		$reportLineBreak = data.line_break;

		var columnsId = [];
		var data = MessengerUtil.send(
			'load_objects',
			{
				'fields' : ['id'],
				'object' : 'report_columns',
				'order' : ['sequence'],
				'where' : {
					'report_columns' : {
						'report_id' : $reportID
					}
				}
		   }
		);
		data.report_columns.forEach(function(column){
			columnsId.push(column.id);
		});

		var data = MessengerUtil.send(
			'load_objects',
			{
				'object' : 'object_field_report_columns',
				'where' : {
					'object_field_report_columns' : {
						'report_column_id' : columnsId
					}
				}
		   }
		);
		data.object_field_report_columns.forEach(function(column){
			$fakeHeader.push($elements[column.object].fields[column.field].label + ' (' + $elements[column.object].label +')');
			$reportColumns.push({
				'type' : 'object_field',
				'object' : column.object,
				'field' : column.field
				//'format' : $enumTypes[$elements[column.object].fields[column.field].type].format
			});
		});

		var data = MessengerUtil.send(
			'load_objects',
			{
				'object' : 'report_column_formats',
				'where' : {
					'report_column_formats' : {
						'report_column_id' : columnsId
					}
				}
		   }
		);
		for(var i = 0; i <  data.report_column_formats.length; i++){
			var column = data.report_column_formats[i];
			var format = {};
			format.adjustment = parseInt(column.adjustment);
			format.width = column.width;
			format.fill = column.fill;
			format.format = column.format;
			$reportColumns[i].format = format;
			//$elements[$reportColumns[i].object].fields[$reportColumns[i].field].format = format;
		}

		return true;
	};

	function getGroupBy(where) {
		var hasGroupBy = false;
		var hasIdJoin = false;
		Object.keys(where).forEach(function (object) {
			if (object === $reportObject)
				return;
			Object.keys(where[object]).forEach(function (field) {
				if (field === 'id') {
					if (hasIdJoin)
						hasGroupBy = true;
					hasIdJoin = true;
					if (Array.isArray(where[object][field]) && where[object][field].length > 1)
						hasGroupBy = true;
				} else {
					hasGroupBy = true;
				}
			});
		});
		return hasGroupBy ? ['id'] : undefined;
	}

	this.getCount = function(where){
		var object = $reportObject;

		$reportColumns.forEach(function(item){
			if(item.object !==  $reportObject)
				object = item.object;
		})
		where.object = $elements[$reportObject].object;
		where.fields = [ 'COUNT(*)' ];
		where.join = 'LEFT';
		where.group = getGroupBy(where.where);
		delete where.limit;
		delete where.offset;
		var queryResult = MessengerUtil.send(
			'load_objects',
			where
		)[$elements[$reportObject].object];
		return where.group ? queryResult.length : queryResult[0]["COUNT(*)"];
	};

	this.getData = function(delimiter, where, hasFormat, addColumnId){
		var _delimiter = $reportDelimiter;
		if(delimiter != null)
			_delimiter = delimiter;

		where.object = $elements[$reportObject].object;
		where.delimiter = _delimiter;
		where.line_break = $reportLineBreak;
		where.header = ($reportHeader) ? _delimiter + $reportHeader : $reportHeader;
		where.file_name = $reportFileName;
		where.join = 'LEFT';

		var _columns = [];
		if(addColumnId === true){
			_columns = [{
				'field': 'id',//$elements[$reportObject].PK,
				'object': $elements[$reportObject].object,
				'type': 'object_field'
			}];

			where.group = getGroupBy(where.where);
			where.columns = _columns;
			where.where[$elements[$reportObject].object] = {
				'id' : generate_report(where).split($reportLineBreak.replace('\\r', '\r').replace('\\n', '\n')).map(Number)
			};
			// Prevents spurious "not a number" errors in the first positions
			while (where.where[$elements[$reportObject].object].id.length > 0 && !where.where[$elements[$reportObject].object].id[0]) {
				where.where[$elements[$reportObject].object].id.shift();
			}
		}
		_columns = _columns.concat($reportColumns);
		 if(hasFormat === false){
		 	_columns.forEach(function(item){
		 		delete item.format;
		 	});
		 }
		 delete where.group;
		 delete where.limit;
		 delete where.offset;
		 where.columns = _columns;

		function generate_report(data){
			var dataOut = null;
			$.ajax({
				data: Main.bigJSONstringify(data),
				url: '/report_generate.fcgi',
				async: false,
				type: 'POST',
				contentType: 'application/json',
				success: function(result, textStatus, jqXHR){
					if(jqXHR.getResponseHeader('Content-Disposition') != null)
						$formattedFileName = jqXHR.getResponseHeader('Content-Disposition').split('filename="')[1].slice(0, -1);

					dataOut = result;
				},
				error: function (result) {
					console.log(result.responseJSON);
					Main.sessionFail(result.responseJSON, null);
					dataOut = result.responseJSON;
				}
			});

			return dataOut;
		}
		var objOffset = 0;
		for (const key in  where.where) {
			if ("id" in where.where[key] && key != $elements[$reportObject].object) {
				objOffset += where.where[key].id.length;
			}
		}
		var objectCount = where.where[$elements[$reportObject].object].id.length;
		var idTotal = [];
		idTotal = where.where[$elements[$reportObject].object].id;
		var numObjects = 0;
		var numPack = 0;
		var idBlock = [];
		var reports = [];
		var reportsNoLine = [];
		var reportOut;
		while (objectCount - numObjects >= 900-objOffset) {
			idBlock[numPack] = where.where[$elements[$reportObject].object].id.slice(numObjects, numObjects + 900 - objOffset);
			numObjects += 900-objOffset;
			numPack++;
		}
		if (objectCount - numObjects > 0) {
			idBlock[numPack] = where.where[$elements[$reportObject].object].id.slice(numObjects);
		}
		for (let i = 0; i < idBlock.length; i++) {
			where.where[$elements[$reportObject].object].id = idBlock[i];
			reports[i] = generate_report(where);
			if (i > 0) {
				var lines = reports[i].split('\n');
				lines.splice(0,1);
				reportsNoLine[i] = lines.join('\n');
			} else if (i == 0) {
				reportsNoLine[i] = reports[i]
			}
		}
		reportOut = reportsNoLine.join('\r\n');
		return [reportOut, where.delimiter, where.line_break];
	}

	this.getHTMLHeader = function(){
		var lstTh = [];
		var i = 0;
		$fakeHeader.forEach(function(value){
			lstTh.push({ 'key' : i++, 'value' : value });
		});
		return lstTh;
	};

	this.makeTable = function(delimiter, where, hasFormat){
		var _delimiter = $reportDelimiter;
		if(delimiter != null)
			_delimiter = delimiter
		var table = [];

		var data = this.getData(_delimiter, where, hasFormat, true)[0];
		if(data.length === 0)
			return [];
		data = data.replaceAll('>', '&gt').replaceAll('<', '&lt');
		var lstRows = data.split($reportLineBreak.replace('\\r', '\r').replace('\\n', '\n').replace('\\r', '\r').replace('\\n', '\n'));
		for(var j = 0; j < lstRows.length; j++){
			var add = true;
			var tr = {};
			var lstFields = splitAndUnescapeRow(lstRows[j], _delimiter);
			if(lstRows[j-1]){
				var lstFieldsOld = splitAndUnescapeRow(lstRows[j - 1], delimiter);
				if(lstFields[0] == lstFieldsOld[0]){
					add = false;
					tr = table[table.length - 1];
					for(var i = 1; i < lstFields.length; i++){
						if(lstFields[i] != lstFieldsOld[i])
							tr[i-1] = tr[i-1] +'<div class="table-bordered" />' + checkType(lstFields[i], $elements[$reportColumns[i-1].object].fields[$reportColumns[i-1].field].type);
					}
				}
			}
			if(add){
				for(var i = 1; i < lstFields.length; i++){
					tr[i-1] = checkType(lstFields[i], $elements[$reportColumns[i-1].object].fields[$reportColumns[i-1].field].type);
				}
				table.push(tr);
			}
		}
		return table;

		function checkType(value, type){
			function checkBoolean(value){
				var font = '';
				var icon = '';
				if(value == true){
					font = 'font-green';
					icon = 'icon-ok'
				}else if(value == false){
					font = 'font-red';
					icon = 'icon-remove';
				}else
				{
					font = 'font-grey';
					icon = 'icon-remove';
				}
				return'<center><div class="' + font + '"><icon class="' + icon +'"></icon></div></center>';
			}
			const clock_format_message = MessengerUtil.send('get_configuration', { general: ['clock_12h_format', 'month_day_year_format'] }).general;
			switch(type){
					case 'boolean':
						if(isNaN(value))
							return value;
						return checkBoolean(value);

					case 'datetime':
						if(isNaN(value))
							return value;
						if (value === '0' || value === 0)
							return '';
						var dt = Main.secondsToDate(value);
						var format_hour = dt.getUTCHours();
						if (clock_format_message.clock_12h_format != "0") {
							if (format_hour == 0) {
								format_hour = 12
							}
							else if (format_hour > 12) {
								format_hour -= 12
							}
						}
						return ('00' + (clock_format_message.month_day_year_format == "0" ? dt.getUTCDate() : (dt.getUTCMonth()+1))).slice(-2) + '/' +
							('00' + (clock_format_message.month_day_year_format == "0" ? (dt.getUTCMonth()+1) : dt.getUTCDate())).slice(-2) + '/' +
							dt.getUTCFullYear().toString() + ' ' +
							('00' + format_hour).slice(-2) + ':' +
							('00' + dt.getUTCMinutes()).slice(-2) + ':' +
							('00' + dt.getUTCSeconds()).slice(-2) +
							(clock_format_message.clock_12h_format != "0" ? (dt.getUTCHours() < 12 ? ' AM' : ' PM') : '');

					case 'time':

						if(isNaN(value))
							return value;

						var dt = Main.secondsToDate(value);
						var format_hour = dt.getUTCHours();
						if (clock_format_message.clock_12h_format != "0") {
							if (format_hour == 0) {
								format_hour = 12
							}
							else if (format_hour > 12) {
								format_hour -= 12
							}
						}
						return ('00' + format_hour).slice(-2) + ':' +
							('00' + dt.getUTCMinutes()).slice(-2) + ':' +
							('00' + dt.getUTCSeconds()).slice(-2) +
							(clock_format_message.clock_12h_format != "0" ? (dt.getUTCHours() < 12 ? ' AM' : ' PM') : '');

					case 'accessevent':
						 if(isNaN(value))
							return value;

						var bool;
						var desc;
						switch(parseInt(value)){
							case 7:
							case 10:
							case 11:
							case 12:
							case 15:
								bool = true;
								desc = "Granted";
							break;

							case 6:
								bool = false;
								desc = 'Not authorized';
							break;

							default:
								bool = null;
								desc = 'Not recognized';
							break;
						}
						return checkBoolean(bool, desc);
					
					case 'alarmevent':
						if(isNaN(value))
						   return value;

					   switch(parseInt(value)){
						   case 1:
							   return "Activated";
						   case 2:
							   return "Deactivated";
						   default:
							   return "Invalid";
					   }

				   case 'alarmcause':
						if(isNaN(value))
						   return value;

					   switch(parseInt(value)){
						   case 0:
							   return "No cause"
						   case 6:
							   return "Door held open"
						   case 7:
							   return "Door forced open"
						   case 9:
							   return "Tamper"
						   case 10:
							   return "Panic card"
						   default:
							   return "Invalid"
					   }

				   case 'calltime':

						if(isNaN(value))
							return value;

						return value;
					
					case 'callrole':
						if(isNaN(value))
						   return value;

					   switch(parseInt(value)){
						   case 0:
							   return "Call made by device"
						   case 1:
							   return "Call received by device"
						   default:
							   return "Invalid"
					   }

				   case 'dtmfevent':
						if(isNaN(value))
						   return value;

					   switch(parseInt(value)){
						   case 0:
							   return "Door not opened"
						   case 1:
							   return "Door opened"
						   default:
							   return "Invalid"
					   }

				   case 'p2penable':
						if(isNaN(value))
						   return value;

					   switch(parseInt(value)){
						   case 0:
							   return "SIP Client"
						   case 1:
							   return "Peer-To-Peer"
						   default:
							   return "Invalid"
					   }

				   case 'callstatus':
						if(isNaN(value))
						   return value;

					   switch(parseInt(value)){
						   case 0:
							   return "Missed call"
						   case 1:
							   return "Completed call"
						   default:
							   return "Invalid"
					   }

				   case 'identification':
						if(isNaN(value))
						   return value;

						function getIdentifierId(s,n) {
							var bytes = [];
							for(var i = 0; i < s.length; i++) {
								var char = s.charCodeAt(i);
								bytes.push(char & 0xFF);
							}
							return (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | n);
						}

						var identifier_id = parseInt(value) >> 8;
						if (identifier_id == getIdentifierId("bio",0) >> 8) {
							return "Biometry";
						} else if (identifier_id == getIdentifierId("face",0) >> 8) {
							return "Facial";
						} else if (identifier_id == getIdentifierId("win",0) >> 8 || identifier_id == getIdentifierId("mag",0) >> 8
								|| identifier_id == getIdentifierId("rfi",0) >> 8 || identifier_id == getIdentifierId("mif",0) >> 8) {
									return "Card";
						} else if (identifier_id == getIdentifierId("gui",0) >> 8) {
							// compare _identifier_id (original value) to differentiate ID/Password and PIN
							if (parseInt(value) == getIdentifierId("gui",1)) {
								return  "PIN";
							} else {
								return "Password";
							}
						} else if (identifier_id ==  getIdentifierId("qrcode", 0) >> 8) {
							return "QR Code";
						} else if (identifier_id == getIdentifierId("rex", 0) >> 8) {
							return "REX button";
						} else if (identifier_id == getIdentifierId("web", 0) >> 8) {
							return "Web Interface";
						} else if (identifier_id == getIdentifierId("intercom", 0) >> 8) {
							return "Intercom";
						}
				   break;


					default :
						return value;
				}
			}

	}
}
//# sourceURL=report.js
