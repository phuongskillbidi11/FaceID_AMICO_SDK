function initReportAccessHistoryPage(){

	var queryString = {};
	window.location.search.substr(1).split('&').forEach(function(param){
		var args = param.split('=');
		if(args.length === 2)
			queryString[args[0]] = args[1];
	});


	var report = new Report();
	if('report' in queryString && ValidateUtil.isNumber(queryString.report)){
		if(!report.load(queryString.report))
			window.location = 'reportcustomconfig.html';
	}
	else
		window.location = 'reportcustomconfig.html';

	$('#BREADCRUMB .page-title').html($('#MasterPage_menu #rel #' + queryString.report + ' a').html());
	$('#MasterPage_menu #rel #' + queryString.report).addClass('active');
	$('#BREADCRUMB .breadcrumb').append('<li> <i class="icon-angle-right"></i></li><li>' + $('#BREADCRUMB .page-title').html() +'</li>');

	report.setHeader('');


	var dtEnd= new Datepicker();
	var dtStart = new Datepicker();
	dtEnd.language = 'en';
	dtStart.language = 'en';

	const date_format_message = MessengerUtil.send('get_configuration', { general: ['month_day_year_format'] }).general;
	dtEnd.monthDayYearFormat = date_format_message.month_day_year_format == "1";
	dtStart.monthDayYearFormat = date_format_message.month_day_year_format == "1";
	dtEnd.init($('#dtEnd'));

	dtStart.setCallbackChange(function(){
		dtEnd.setMinDate(dtStart.getDate());
	});
	dtStart.init($('#dtStart'));
	var dt = Main.getInfo().date;
	dtEnd.setDate(dt);
	dt.setDate(dt.getDate()-15);
	dtStart.setDate(dt);

	var rules = new Chosen();
	rules.init($('#lstRules'), 1, new TimeZone());
	Main.addItem(rules, new TimeZone().listAll(), false);

	if (!((new User().countAll()) > 10000)) {
		var users = new Chosen();
		users.init($('#lstUsers'), 1, new User());
		Main.addItem(users, new User().listAll(), false);
	}

	var group = new Chosen();
	group.init($('#lstGroups'), 1, new Group());
	Main.addItem(group, new Group().listAll(), false);


	var table = new Table(
		$('#table'),
		null,
		{
			'add' : false,
			'edit' : false,
			'remove' : false,
			'name' : $('#BREADCRUMB .page-title').html(),
			'callbackCount' : function(where){
				return report.getCount(makeWhere(where));
			},
			'callbackLoad' : function(where, callbackFinish){
				callbackFinish(true, report.makeTable(';',makeWhere(where), false));
			},
			'callbackHeader' : function(){
				return report.getHTMLHeader();
			},
			'callbackHTML' : function(obj, callbackTr){
				callbackTr(obj);
			}
		}
	);

	/*table.setCallbackCount(function(find){
		return report.getCount(makeWhere());
	});

	table.setCallbackLoadData(function(start, size, find, order){

		return report.makeTable(';', start, size, makeWhere(), report.getOrder(), false);
	});
	table.init('table', $('#BREADCRUMB .page-title').html());*/

	function makeWhere(_where){
		if(!_where)
			_where = {}
		var where = {};
		$.extend(true, where, _where);
		where.order = report.getOrder();
		where.where = {};
		if(_where.Json)
			where.where = _where.Json;
		delete where.Json;



		for(var obj in $reportFilters){
			if (!where.where)
				where.where = {};
			if (!where.where[report.getElements()[obj].object])
				where.where[report.getElements()[obj].object] = {};
			//Where default
			if (report.getElements()[obj].defaultWhere) {
				$.extend(where.where, report.getElements()[obj].defaultWhere);
			}
			for(var item in $reportFilters[obj])
				if(!Array.isArray($reportFilters[obj][item].values) || $reportFilters[obj][item].values.length > 0)
					where.where[report.getElements()[obj].object][item] = $reportFilters[obj][item].values;
		}
		return where;
	}


	$('.dataTables_filter').hide();

	$('#btSearch').click(function() {
		table.clear();
		table.load();
	});

	$('#btExport').click(function(){

		var md = new Modal();
		md.setTitle('Export of ' + $('#BREADCRUMB .page-title').html());
		md.setContent('Analysing data, please wait...');


		md.show(function(){
			if(report.getCount(makeWhere()) >= 5000){
				md.setContent('<h4>This operation can take a few minutes.<br /><br />Are you sure you want to export the report?</h4>');
				md.addButton([
					{
						'type' : 'ok',
						'class' : 'green',
						'text' : 'Export',
						'callback' : function(){
							ExportReport();
						}
					},
					{
						'type' : 'cancel'
					}
				]);
			}
			else{
				//modal.setText('<h4>Deseja realmente exportar o relatório?</h4>');
				ExportReport();
			}
		});



		function ExportReport(){
			md.setContent('Generating report, please wait...');

			var exportReport = new Report();
			exportReport.load(queryString.report);

			function trimText(text, line_break, delimiter, splitLines, splitColumns, joinColumns)
			{
				if (!String.prototype.trim) {
					String.prototype.trim = function () {
						return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
					};
				}
				var array = splitLines(text);
				var line, trimmed_array = [];
				for (var i in array) {
					line = splitColumns(array[i]);
					for (var j in line) {
						line[j] = line[j].trim();
					}
					trimmed_array = trimmed_array.concat(joinColumns(line));
				}
				return trimmed_array;
			}

			function deleteFirstColumn(original_array, delimiter)
			{
				var array = original_array;
				for (var pos in array) {
					array[pos] = array[pos].substring(array[pos].indexOf(delimiter) + 1);
				}
				return array;
			}

			function removeDuplicates(text, line_break, delimiter)
			{
				/***
				 *   Removes duplicates in text, which is separated by delimiter's and line_break's and in
				 *   ascending or descending order with respect to an id column (the first one).
				 *   All indexes must be unique, so duplicates are merged into the first appearance of that id,
				 *   each of them separated by " / " in their respective column (since there is a difference to the
				 *   reference). Consequently, exactly identical lines are just removed.
				 *   Every string in the input is trimmed (blank spaces in the beginning or in the end are excluded).
				 */
				const splitLines = str => str.split(RegExp(line_break));
				const splitColumns = str => str.split(RegExp(delimiter));
				const joinLines = array => array.join('\r' + '\n');
				const joinColumns = array => array.join(delimiter);

				var original_text_array = trimText(text, line_break, delimiter, splitLines, splitColumns, joinColumns);
				if (original_text_array.length <= 2) {
					return joinLines(deleteFirstColumn(original_text_array, delimiter));
				}
				var new_array = [original_text_array[0], original_text_array[1]];
				var line, line_aux = [];
				var last_object_id = splitColumns(original_text_array[1])[0];

				// For each line from #2, iterates checking duplicates and appending their positions to the first
				// appearance. This last one's id is saved in the variable last_object_id:
				for (var i = 2; i < original_text_array.length; i++) {
					line = splitColumns(original_text_array[i]);

					// Treatment to the first column: if it is equal to the previous one, keeps to the next comparisons;
					// otherwise, concatenates it to new_array and updates current last_object_id:
					if (line[0] !== last_object_id) {
						last_object_id = line[0];
						new_array = new_array.concat(joinColumns(line));
						// continues the "for" loop to the next line of the input:
						continue;
					}

					// It reaches here if there is a match in the first column (i.e., a duplicate). From this point the
					// other columns are compared; differences are appended (with a " / " separator) to the reference:
					for (var j = 1; j < line.length; j++) {
						if (splitColumns(new_array[new_array.length - 1])[j].indexOf(line[j]) === -1) {
							line_aux = splitColumns(new_array[new_array.length - 1]);
							line_aux[j] += " / " + line[j];
							new_array[new_array.length - 1] = joinColumns(line_aux);
						}
					}
				}

				// Deletes first column (object_id) and joins the result to finalize the function:
				return joinLines(deleteFirstColumn(new_array, delimiter));
			}

			function saveTextAsFile(file_name, textToWrite)
			{
				var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});

				var downloadLink = document.createElement("a");
				downloadLink.download = file_name;
				downloadLink.innerHTML = "Download File";
				if (window.webkitURL != null)
				{
					// Chrome allows the link to be clicked
					// without actually adding it to the DOM.
					downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
				}
				else
				{
					// Firefox requires the link to be added to the DOM
					// before it can be clicked.
					downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
					downloadLink.onclick = destroyClickedElement;
					downloadLink.style.display = "none";
					document.body.appendChild(downloadLink);
				}

				downloadLink.click();
			}

			var reportData_array = exportReport.getData(
				null, makeWhere(), true, true
			);
			var reportData = reportData_array[0];
			var reportData_delimiter = reportData_array[1];
			var reportData_line_break = reportData_array[2];

			saveTextAsFile(
				exportReport.getFormattedFileName(), removeDuplicates(
					reportData, reportData_line_break, reportData_delimiter
				)
			);

			md.setContent('Export finished successfully.');
			md.getContent().parent().find('.btn').remove();
			md.addButton([
				{
					'type' : 'ok',
					'class' : 'blue',
					'text' : 'OK',
					'callback' : function(){
						md.close()
					}
				}
			]);
		}

	});


	//###################################### FILTERS #####################################################

			var $reportFilters = {};
			var dataFilters = {};
			var loadDataFilters = MessengerUtil.send(
				'load_objects',
				{
				'object' : 'report_filters',
				'where' : {
						'report_filters' :{
							'report_id' : parseInt(queryString.report)
						}
					}
				}
			).report_filters;
			loadDataFilters.forEach(function(row){
				if(!('show' in report.getElements()[row.object]) || report.getElements()[row.object].show === true ||  report.getElements()[row.object].showFilter === true){
					if(!(row.object in dataFilters))
						dataFilters[row.object] = {};
					dataFilters[row.object][row.field] = {
						'value' : row.value.split(';'),
						'editable' : row.editable,
						'visible' : row.visible
					}
					addFilter(row.object, row.field);

				}
			});
			function addFilter(obj, field){
				var hide = '';
				var data = [];
				const clock_format_message = MessengerUtil.send('get_configuration', { general: ['clock_12h_format', 'month_day_year_format'] }).general;
				var object = report.getElements()[obj];
				if(!(obj in $reportFilters))
					$reportFilters[obj] = {};

				if(object.object in dataFilters && field in dataFilters[object.object]){
					hide = dataFilters[object.object][field].visible ? '' : 'hide';
					hide += dataFilters[object.object][field].editable ? '' : ' notEditable';
				}

				$reportFilters[obj][field] = {
					'values' : [],
					'visible' : 1,
					'editable' : 1
				};

				if((obj === 'access_logs' || obj === 'alarm_logs' || obj == 'call_logs') && field === 'time'){
					$('#filtersLocation').prepend(
						'<div class="span12 no-margin">' +
							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<label class="control-label">Start Date</label>' +
								'<div class="controls">' +
									'<div class="input-append span11 editableField">' +
										'<input id="filter_dtStart" class="m-wrap span11" type="text">' +
										'<span class="add-on" style="border-left: 0px; background-color: #ffffff; border-top-right-radius: 4px !important; border-bottom-right-radius: 4px !important;"><img src="/images/calendar.png" width="16px" /></span>' +
									'</div>' +
								'</div>' +
							'</div>' +

							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<label class="control-label">End Date</label>' +
								'<div class="controls">' +
									'<div class="input-append span11 editableField">' +
										'<input id="filter_dtEnd" class="m-wrap span11 " type="text">' +
										'<span class="add-on" style="border-left: 0px; background-color: #ffffff; border-top-right-radius: 4px !important; border-bottom-right-radius: 4px !important;"><img src="/images/calendar.png" width="16px" /></span>' +
									'</div>' +
								'</div>' +
							'</div>' +
						'</div>' +

						'<div class="span12 no-margin">' +
							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<label class="control-label">Start Time</label>' +
								'<div class="controls">' +
									'<div class="input-append bootstrap-timepicker-component span11 editableField">' +
										'<input id="filter_tmStart" class="m-wrap span11" type="text" style="border-top-right-radius: 0px !important; border-bottom-right-radius: 0px !important"/>' +
										'<span class="add-on" id="start-click" style="border-left: 0px; background-color: #ffffff; border-top-right-radius: 4px !important; border-bottom-right-radius: 4px !important;"><img src="/images/alarm.png" width="16px" /></span>' +
									'</div>' +
								'</div>' +
							'</div>' +

							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<label class="control-label">End Time</label>' +
								'<div class="controls">' +
									'<div class="input-append bootstrap-timepicker-component span11 editableField">' +
										'<input id="filter_tmEnd" class="m-wrap span11" type="text" style="border-top-right-radius: 0px !important; border-bottom-right-radius: 0px !important" />' +
										'<span class="add-on" id="start-click" style="border-left: 0px; background-color: #ffffff; border-top-right-radius: 4px !important; border-bottom-right-radius: 4px !important;"><img src="/images/alarm.png" width="16px" /></span>' +
									'</div>' +
								'</div>' +
							'</div>' +
						'</div>'
					);

					$reportFilters[obj][field].values = {};

					var dt = Main.getInfo().date;
					var _dtEnd = new Date(dt.getTime());
					var _dtStart;

					var data = JSON.parse(dataFilters[object.object][field].value);
					if(data.type === 'day'){
						_dtEnd.setUTCDate(_dtEnd.getUTCDate() - data.finish);
						_dtStart = new Date(_dtEnd.getTime());
						_dtStart.setUTCDate(_dtStart.getUTCDate() - data.interval);
					}else{
						_dtEnd.setUTCMonth(_dtEnd.getUTCMonth() - data.finish);
						_dtStart = new Date(_dtEnd.getTime());
						_dtStart.setUTCDate(1);
						_dtStart.setUTCMonth(_dtStart.getUTCMonth() - data.interval);
					}

					var tmStart = new Timepicker();
					tmStart.clock12hFormat = clock_format_message.clock_12h_format == '1';
					tmStart.init($('#filter_tmStart'));
					tmStart.setTime(0, 0);
					tmStart.setCallbackChange(function(){
						var dt = dtStart.getDate();
						if(dt!= null){
							dt.setSeconds(tmStart.getTimeInSeconds());
							$reportFilters[object.object][field].values['>='] = Main.dateToSeconds(dt);
						}else{
							$reportFilters[object.object][field].values['>='] = 0;
						}
					});

					var tmEnd = new Timepicker();
					tmEnd.clock12hFormat = clock_format_message.clock_12h_format == '1';
					tmEnd.init($('#filter_tmEnd'));
					tmEnd.setTime(23, 59);
					tmEnd.setCallbackChange(function(){
						var dt = dtEnd.getDate();
						if(dt!= null){
							dt.setSeconds(tmEnd.getTimeInSeconds() + 59);
							$reportFilters[object.object][field].values['<='] = Main.dateToSeconds(dt);
						}else{
							$reportFilters[object.object][field].values['<='] = 0;
						}
					});

					var dtEnd= new Datepicker();
					var dtStart = new Datepicker();
					dtEnd.language = 'en';
					dtStart.language = 'en';
					dtEnd.monthDayYearFormat = clock_format_message.month_day_year_format == '1';
					dtStart.monthDayYearFormat = clock_format_message.month_day_year_format == '1';
					dtEnd.init($('#filter_dtEnd'));
					dtStart.init($('#filter_dtStart'));

					dtStart.setCallbackChange(function(){
						var dt = dtStart.getDate();
						dtEnd.setMinDate(dt);
						if(dt!= null){
							dt.setUTCSeconds(tmStart.getTimeInSeconds());
							$reportFilters[object.object][field].values['>='] = Main.dateToSeconds(dt);
						}else{
							$reportFilters[object.object][field].values['>='] = 0;
						}
					});
					dtEnd.setCallbackChange(function(){
						var dt = dtEnd.getDate();
						dtStart.setMaxDate(dt);
						if(dt!= null){
							dt.setUTCSeconds(tmEnd.getTimeInSeconds()  + 59);
							$reportFilters[object.object][field].values['<='] = Main.dateToSeconds(dt);
						}else{
							$reportFilters[object.object][field].values['<='] = 0;
						}
					});

					dtEnd.setDate(_dtEnd);
					dtStart.setDate(_dtStart);



					//$('#filter_dtEnd').change();
					//$('#filter_dtStart').change();


				}
				else if (obj === 'visits' && field === 'begin_time') {
					$('#filtersLocation').prepend(
						'<div class="span12 no-margin">' +
							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<label class="control-label">Start Date</label>' +
								'<div class="controls">' +
									'<div class="input-append span11 editableField">' +
										'<input id="filter_dtStart" class="m-wrap span11" type="text">' +
										'<span class="add-on" style="border-left: 0px; background-color: #ffffff; border-top-right-radius: 4px !important; border-bottom-right-radius: 4px !important;"><img src="/images/calendar.png" width="16px" /></span>' +
									'</div>' +
								'</div>' +
							'</div>' +

							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<label class="control-label">End Date</label>' +
								'<div class="controls">' +
									'<div class="input-append span11 editableField">' +
										'<input id="filter_dtEnd" class="m-wrap span11 " type="text">' +
										'<span class="add-on" style="border-left: 0px; background-color: #ffffff; border-top-right-radius: 4px !important; border-bottom-right-radius: 4px !important;"><img src="/images/calendar.png" width="16px" /></span>' +
									'</div>' +
								'</div>' +
							'</div>' +
						'</div>' +

						'<div class="span12 no-margin">' +
							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<label class="control-label">Start Time</label>' +
								'<div class="controls">' +
									'<div class="input-append bootstrap-timepicker-component span11 editableField">' +
										'<input id="filter_tmStart" class="m-wrap span11" type="text" style="border-top-right-radius: 0px !important; border-bottom-right-radius: 0px !important"/>' +
										'<span class="add-on" id="start-click" style="border-left: 0px; background-color: #ffffff; border-top-right-radius: 4px !important; border-bottom-right-radius: 4px !important;"><img src="/images/alarm.png" width="16px" /></span>' +
									'</div>' +
								'</div>' +
							'</div>' +

							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<label class="control-label">End Time</label>' +
								'<div class="controls">' +
									'<div class="input-append bootstrap-timepicker-component span11 editableField">' +
										'<input id="filter_tmEnd" class="m-wrap span11" type="text" style="border-top-right-radius: 0px !important; border-bottom-right-radius: 0px !important" />' +
										'<span class="add-on" id="start-click" style="border-left: 0px; background-color: #ffffff; border-top-right-radius: 4px !important; border-bottom-right-radius: 4px !important;"><img src="/images/alarm.png" width="16px" /></span>' +
									'</div>' +
								'</div>' +
							'</div>' +
						'</div>'
					);

					$reportFilters[obj][field].values = {};

					var dt = Main.getInfo().date;
					var _dtEnd = new Date(dt.getTime());
					var _dtStart;

					var data = JSON.parse(dataFilters[object.object][field].value);
					if(data.type === 'day'){
						_dtEnd.setUTCDate(_dtEnd.getUTCDate() - data.finish);
						_dtStart = new Date(_dtEnd.getTime());
						_dtStart.setUTCDate(_dtStart.getUTCDate() - data.interval);
					}else{
						_dtEnd.setUTCMonth(_dtEnd.getUTCMonth() - data.finish);
						_dtStart = new Date(_dtEnd.getTime());
						_dtStart.setUTCDate(1);
						_dtStart.setUTCMonth(_dtStart.getUTCMonth() - data.interval);
					}

					var tmStart = new Timepicker();
					tmStart.clock12hFormat = clock_format_message.clock_12h_format == '1';
					tmStart.init($('#filter_tmStart'));
					tmStart.setTime(0, 0);
					tmStart.setCallbackChange(function(){
						var dt = dtStart.getDate();
						if(dt!= null){
							dt.setSeconds(tmStart.getTimeInSeconds());
							$reportFilters[object.object][field].values['>='] = Main.dateToSeconds(dt);
						}else{
							$reportFilters[object.object][field].values['>='] = 0;
						}
					});

					var tmEnd = new Timepicker();
					tmEnd.clock12hFormat = clock_format_message.clock_12h_format == '1';
					tmEnd.init($('#filter_tmEnd'));
					tmEnd.setTime(23, 59);
					tmEnd.setCallbackChange(function(){
						var dt = dtEnd.getDate();
						if(dt!= null){
							dt.setSeconds(tmEnd.getTimeInSeconds() + 59);
							$reportFilters[object.object][field].values['<='] = Main.dateToSeconds(dt);
						}else{
							$reportFilters[object.object][field].values['<='] = 0;
						}
					});

					var dtEnd= new Datepicker();
					var dtStart = new Datepicker();
					dtEnd.language = 'en';
					dtStart.language = 'en';
					dtEnd.monthDayYearFormat = clock_format_message.month_day_year_format == '1';
					dtStart.monthDayYearFormat = clock_format_message.month_day_year_format == '1';
					dtEnd.init($('#filter_dtEnd'));
					dtStart.init($('#filter_dtStart'));

					dtStart.setCallbackChange(function(){
						var dt = dtStart.getDate();
						dtEnd.setMinDate(dt);
						if(dt!= null){
							dt.setUTCSeconds(tmStart.getTimeInSeconds());
							$reportFilters[object.object][field].values['>='] = Main.dateToSeconds(dt);
						}else{
							$reportFilters[object.object][field].values['>='] = 0;
						}
					});
					dtEnd.setCallbackChange(function(){
						var dt = dtEnd.getDate();
						dtStart.setMaxDate(dt);
						if(dt!= null){
							dt.setUTCSeconds(tmEnd.getTimeInSeconds()  + 59);
							$reportFilters[object.object][field].values['<='] = Main.dateToSeconds(dt);
						}else{
							$reportFilters[object.object][field].values['<='] = 0;
						}
					});

					dtEnd.setDate(_dtEnd);
					dtStart.setDate(_dtStart);

				}
				else{
					if(obj === 'access_logs' && field === 'event'){
						data = [
							{'id': 7, 'name':'Granted'},
							{'id': 6, 'name':'Denied'},
							{'id': 3, 'name':'Not recognized'}
						];
					}
					else if(obj === 'alarm_logs' && field === 'event'){
						data = [
							{'id': 1, 'name':'Activated'},
							{'id': 2, 'name':'Deactivated'}
						];
					}
					else if(obj === 'alarm_logs' && field === 'cause'){
						data = [
							{'id': 6, 'name':'Door held open'},
							{'id': 7, 'name':'Door forced open'},
							{'id': 9, 'name':'Tamper'},
							{'id': 10, 'name':'Panic card'}
						];
					}
					else if (obj === 'call_logs' && field === 'role'){
						data = [
							{'id':0, 'name':'Call made by device'},
							{'id':1, 'name':'Call received by device'}
						];
					}
					else if (obj === 'call_logs' && field === 'dtmf_event'){
						data = [
							{'id': 0, 'name':'Door not opened'},
							{'id': 1, 'name':'Door opened'}
						];
					}
					else if(obj === 'user_roles' && field === 'role'){
						data = [
							{'id': 1, 'name':'Administrator'}
						];
					}else if (!(obj === 'users' && (new User().countAll()) > 10000)){
						var fields = ['id'];
						var order = [];
						if('order' in  object)
							order =  object.order;
						else if('name' in object.fields)
							order =  ['ascending', 'name'];

						var load_params = {
							'object': object.object,
							'order' : order
						};
						if (object.defaultWhere)
							load_params.where = object.defaultWhere;
						data = MessengerUtil.send(
							'load_objects',
							load_params
						)[object.object];
					} else if (obj === 'log_types'){
						var fields = ['id'];
						var order = [];
						if('order' in  object)
							order =  object.order;
						else if('name' in object.fields)
							order =  ['ascending', 'name'];

						var load_params = {
							'object': object.object,
							'order' : order
						};
						if (object.defaultWhere)
							load_params.where = object.defaultWhere;
						data = MessengerUtil.send(
							'load_objects',
							load_params
						)[object.object];
					}

					if (obj === 'call_logs') {
						$('#filtersLocation').append(
							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<div class="span12">' +
									'<label class="control-label">' +
										(object.object === "call_logs" && field === "role" ?
											'Call type' :
											(object.object === "call_logs" && field === "dtmf_event" ?
												'Remote opening' :
												object.label)
										) +
									'</label>' +
									'<div class="controls">' +
										'<div id="filter_' + object.object + '_' + field + '" class="span11 editableField"></div>' +
									'</div>' +
								'</div>' +
							'</div>'
						);

					} else {
						$('#filtersLocation').append(
							'<div class="control-group span4 no-margin ' + hide + '">' +
								'<div class="span12">' +
									'<label class="control-label">' +
										(object.object === "alarm_logs" && field === "event" ?
											'Event' :
											(object.object === "alarm_logs" && field === "cause" ?
												'Cause' :
												object.label)
										) +
									'</label>' +
									'<div class="controls">' +
										'<div id="filter_' + object.object + '_' + field + '" class="span11 editableField"></div>' +
									'</div>' +
								'</div>' +
							'</div>'
						);
					}
					var chosen = new Chosen();
					chosen.init($('#filter_' + object.object + '_' + field), 1, null);
					data.forEach(function(row){
						var bool = false;
						var obj;
						$.each(report.getElements(), function (key, val) {
							if (val == object) {
								obj = key;
								return false;
							}
						});
						if(obj in dataFilters && dataFilters[obj][field].value.indexOf(row.id+'') >= 0){
							bool = true;
							//$reportFilters[object.object].field = row.field;
							$reportFilters[obj][field].values.push(row.id);
						}

						if(row.id == null || row.id === ''){
							row.name = '(Not recognized)';
						}else if(row.name == null || row.name == '' || row.name.length <= 0)
							row.name = '(id: '+ row.id + ')';

						chosen.addItem(row.id, row.name, bool, null);
					});
					chosen.setCallbackChange(function(){
						//Acha objeto
						var obj;
						$.each(report.getElements(), function (key, val) {
							if (val == object) {
								obj = key;
								return false;
							}
						});
						$reportFilters[obj][field].values = [];
						var lst = chosen.getSelected();
						for(var item in lst){
							$reportFilters[obj][field].values.push(lst[item].id);
						}
					});
				}
			}

			$('#filtersLocation').find('.notEditable .controls').each(function(){
				$(this).css('position', 'relative');
				$(this).append('<div style="'+
					'cursor: not-allowed; ' +
					'position:absolute; top:0; left:0; '+
					'background: rgba(0,0,0,0.2); '+
					'width:' + $(this).find('.editableField').width()  + 'px; ' +
					'height:' + $(this).find('.editableField').height() + 'px; ' +
				'"></div>');
			});

		table.load();
}


function goBack () {
	window.location = "index.html";
}

LoadPage(function(){
	var initQueryString = {};
	window.location.search.substr(1).split('&').forEach(function(param){
		var args = param.split('=');
		if(args.length === 2)
		initQueryString[args[0]] = args[1];
	});


	if (initQueryString.report == "7") {
		var data = MessengerUtil.send('system_information', null, null, false);
		var max_facial_biometrics = parseInt(data.biometrics.max_num_records);

	}

	if (initQueryString.report == "7" && max_facial_biometrics < 10000){
		var md = new Modal();
		md.setTitle('Call Logs');
		md.setContent('Feature available only for devices in PRO mode');
		md.addButton([
			{
				'type' : 'ok',
				'callback': goBack
			}
		]);
		md.show();
	}  else {
		initReportAccessHistoryPage();
	}
});

//# sourceURL=reportcustomview.js
