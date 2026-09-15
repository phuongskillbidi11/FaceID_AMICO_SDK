function cameraEquipamento(i) {
    switch (i) {
        case 0:
            return '<img src="http://192.168.0.178/videostream.cgi?rate=0" width="100" />';
        case 1:
            return '<img src="http://192.168.0.142/videostream.cgi?rate=0" width="100" />';
        default:
            return '<img src="../users/idaccess.jpg">';
    }
}

function cameraCadeada(i) {
    switch (i) {
        case 0:
            return '<img src="http://192.168.0.178/videostream.cgi?rate=0" width="48" />';
        case 1:
            return '<img src="http://192.168.0.142/videostream.cgi?rate=0" width="48" />';
        default:
            return '<i class="icon-unlock float-right" style="font-size: 48px;"></i>';
    }
}

function cameraFundo(i) {
    if (!useCamera)
        i = 9;
    switch (i) {
        case 0:
            return '<div class="portlet-body cameraIP" style="background-image: url(http://192.168.0.178/videostream.cgi?rate=0);">';
        case 1:
            return '<div class="portlet-body cameraIP" style="background-image: url(http://192.168.0.142/videostream.cgi?rate=0);">';
        default:
            return '<div class="portlet-body">';
    }
}

var useCamera = true;

var lstLastAccess = []
var lstAccessTrue = [];
var lstAccessFalse = [];
var lstAccessNull = [];
var lstUsersByTimeZone = [];
var lstUsersByTimeZoneLegend = [];
var $countTrue = 0;
var $countFalse = 0;
var $countNull = 0;

function timelineRefresh() {
	var firstRun = $timeline.getLastEvent().id != null;
	if($countAccess < 1)
		$('#content').removeClass('span8').addClass('span12');
	else
		$('#content').removeClass('span12').addClass('span8');

	limit = $limit;

	var params = {'limit': limit, 'order': ['time', 'descending']};
	if ($timeline.getLastEvent().id != null){
		params['where'] =  [{
			'field' : 'time',
			'value' : $timeline.getLastEvent().time,
			'operator' : '>'
		}];
	}else{

		params['where'] =  [{
			'field' : 'time',
			'value' : Main.dateToSeconds(Main.getInfo().date),
			'operator' : '<='
		}];
	}

	params['callback'] = function(ret, finished) {
		geral = ret;
		$timeline.add(ret);
		if (firstRun){
			lstLastAccess = lstLastAccess.concat(ret);
			graficoUltimas24hora();
		}
	};


	new access_logs().list(params);
}

function refreshAccessLogs() {
	access_logs.fn.count({

		callback: function(count) {
			$('#total_access').html(count);
			if ($countAccess != count) {
				$countAccess = count;
				timelineRefresh();
			}
		}
	});
}

var modalOpened = false;

function refreshAlarm() {
	var result = MessengerUtil.send('alarm_status');
	if (result.error) {
		//Deu erro na criação
		CID.AlertError(result);
		return;
	} else if (result.active == true){

		if (modalOpened == false) {
			var md = new Modal();
			md.setTitle('Alarm active');
			md.setContent('The alarm is active. Do you wish to deactivate it?')

			md.addButton([
				{
					'type' : 'ok',
					'callback': deactivate
				},
				{
					'type' : 'cancel'
				}
			]);

			md.show();
			modalOpened = true;
			function deactivate() {
				var result = MessengerUtil.send('alarm_status', 
					{
						"stop": true
					});
				if (result.error) {
					//Deu erro na criação
					CID.AlertError(result);
					return;
				}
				md.close();
				modalOpened = false;
			}
		}
	}
}

function newInitIndexPage() {
	users.fn.count({callback: function(count) { $('#total_users').html(count); } });
	$('#total_faces').html(MessengerUtil.send("face_template_count_distinct").count)
	templates.fn.count({callback: function(count) { $('#total_dig').html(count); } });
	time_zones.fn.count({callback: function(count) { $('#total_timespan').html(count); } });
	refreshAccessLogs();
	refreshAlarm();
}

function initGraficos(){
	var previousPoint = null;
	const clock_format_message = MessengerUtil.send('get_configuration', { general: ['clock_12h_format', 'month_day_year_format'] }).general;
	$("#site_statistics").bind("plothover", function (event, pos, item) {
		if (item) {
			if (previousPoint != item.dataIndex) {
				previousPoint = item.dataIndex;

				$("#tooltip").remove();
				var x = item.datapoint[0].toFixed(2),
					y = item.datapoint[1].toFixed(2);
				var dt = new Date(parseInt(x));
				var format_hour = dt.getUTCHours();
				if (clock_format_message.clock_12h_format != "0") {
					if (format_hour == 0) {
						format_hour = 12
					}
					else if (format_hour > 12) {
						format_hour -= 12
					}
				}
				var sDt = ('00' + clock_format_message.month_day_year_format == "0" ? dt.getUTCDate(): (dt.getUTCMonth()+1)).slice(-2) + '/' +
						('00' + clock_format_message.month_day_year_format == "0" ? (dt.getUTCMonth()+1) : dt.getUTCDate()).slice(-2) + '/' +
						dt.getUTCFullYear().toString().slice(-2) +
						' ' +
						('00' + format_hour).slice(-2) + ':' +
						('00' + dt.getUTCMinutes()).slice(-2) +
						(clock_format_message.clock_12h_format != "0" ? (dt.getUTCHours() < 12 ? ' AM' : ' PM') : '');

				showTooltip(item, sDt + ' (' + parseInt(y) + ')');
			}
		} else {
			$("#tooltip").remove();
			previousPoint = null;
		}
	});

	function showTooltip(item, contents) {

		$("<div id='tooltip' class='font-20'>" + contents + "</div>").css({
			position: "absolute",
			display: "none",
			top: item.pageY - 20,
			left: item.pageX  + 10,
			border: "1px solid #fdd",
			padding: "10px",
			color: '#FFF',
			"background-color": item.series.color,
			opacity: 0.90
		}).appendTo('body').fadeIn(200);
	}

	//if(lstLastAccess == null){
		lstLastAccess = [];
		$('#site_statistics_loading').show();
		var dtStart = Main.getInfo().date;
		var dtEnd = new Date(dtStart.getTime());
		dtStart.setDate(dtStart.getDate()-3);
		dtStart.setHours(0);
		dtStart.setMinutes(0);
		dtStart.setSeconds(0);
		dtStart.setMilliseconds(0);

		lstAccessTrue.push([dtStart.getTime(), 0]);
		lstAccessFalse.push([dtStart.getTime(), 0]);
		lstAccessNull.push([dtStart.getTime(), 0]);
		/*var data = MessengerUtil.send('load_objects', {
			object: "access_logs",
			fields: ["id", "event", "time"],
			limit: 20000,
			order: ["time", "descending"],
			where: {
				"access_logs": {
					"time": {">=": Main.dateToSeconds(dtStart), "<=":Main.dateToSeconds(dtEnd)}
				}
			}
		});*/

		lstLastAccess = [];
		var params = {'order': ['time', 'ascending']};
		params['where'] = [
			{
				'field' : 'time',
				'value' : Main.dateToSeconds(dtStart),
				'operator' : '>='
			},
			{
				'field' : 'time',
				'value' : Main.dateToSeconds(dtEnd),
				'operator' : '<='
			},
		];
		params['callback'] = function(ret, finished) {
				//lstLastAccess = ret;
				lstLastAccess = lstLastAccess.concat(ret);
				graficoUltimas24hora();

				if (finished) {
					setInterval(refreshAccessLogs, 2000);
					setInterval(refreshAlarm, 2000);
				}
			};
		new access_logs().list(params);
	//}
}

function graficoUltimas24hora(){
	////////////////////////////// 24 HORAS///////////////////////////////////////////////

	const clock_format_message = MessengerUtil.send('get_configuration', { general: ['clock_12h_format'] }).general;
	var dtStart = Main.getInfo().date;
	dtStart.setDate(dtStart.getDate()-3);
	dtStart.setHours(0);
	dtStart.setMinutes(0);
	dtStart.setSeconds(0);
	dtStart.setMilliseconds(0);

	//lstLastAccess.reverse();
	lstLastAccess.forEach(function(access){

		var day = Main.secondsToDate(access.time)
		day.setUTCMinutes(0);
		day.setUTCSeconds(0);
		if (access.event === 7 || access.event === 10 || access.event === 11 || access.event === 12 || access.event === 15) {
			$countTrue++;
			addPoints(lstAccessTrue, day);
		} else if (access.event === 6) {
			$countFalse++;
			addPoints(lstAccessFalse, day);
		} else {
			$countNull++;
			addPoints(lstAccessNull, day);
		}
	});

	lstLastAccess = [];

	function addPoints(lst, day){
		var i = lst.length - 1;
		if(lst.length > 0 && parseInt(lst[i][0]) == day.getTime()){
			lst[i][1] = lst[i][1]+1;
		}else{
			if(i > 0){
				var newDay = new Date(lst[i][0]);
				newDay.setUTCHours(newDay.getUTCHours() + 1);
				if(newDay.getTime() != day.getTime()){
					lst.push([newDay.getTime(), 0]);
					i++;
				}
			}

			var newDay = new Date(day.getTime());
			newDay.setUTCHours(newDay.getUTCHours() - 1);
			if(parseInt(lst[i][0]) < newDay.getTime()){
				lst.push([newDay.getTime(), 0]);
			}
			lst.push([day.getTime(),  1]);
		}

	};

	$('#site_statistics_loading').hide();
	$('#site_statistics_content').show();
	$('#site_statistics').width('100%');
	$('#site_statistics').height('300px');

	$.plot("#site_statistics", [
			{
				data: lstAccessNull,
				label: "Not recognized (" + $countNull + ")"
			},
			{
				data: lstAccessTrue,
				label: "Authorized (" + $countTrue + ")"
			},
			{
				data: lstAccessFalse,
				label: "Denied (" + $countFalse + ")"
			}
		], {
		series: {
			lines: {
					show: true,
					lineWidth: 2,
					fill: true,
					fillColor: {
						colors: [{
								opacity: 0.05
							}, {
								opacity: 0.2
							}
						]
					}
				},
				points: {
					show: true
				},
				shadowSize: 2
		},
		grid: {
				hoverable: true,
				clickable: true,
				tickColor: "#eee",
				borderWidth: 0
		},
		colors: ["#333333", "#3cc051", "#d12610"],
		yaxis: {
			tickDecimals: 0
		},
		xaxis: {
			mode: "time",
			minTickSize: [1, "hour"],
			twelveHourClock: clock_format_message.clock_12h_format == "1",
			monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
		},

		legend: {
			position: "nw",
			show: true
		}
	}).resize();

	//////////////////////////////////////////////////////////////////////////////
}


function graficoAccessos(){
	////////////////////////////// BARRAS ////////////////////////////////////////
	$('#timezone_user_loading').hide();
	$('#timezone_user_content').show();

	$('#timezone_user').width('100%');
	$('#timezone_user').height('300px');


	lstLastAccess.forEach(function(evt){
		var nodo = null;
		lstUsersByTimeZone.forEach(function(elem){
			if(elem.label == evt.getGroups().id)
				nodo = elem;
		});

		if(nodo != null)
			nodo.data[0][1] = nodo.data[0][1]+1;
		else{
			lstUsersByTimeZone.push({label: evt.getGroups().id, data:[[lstUsersByTimeZone.length+1, 1]]});
			lstUsersByTimeZoneLegend.push([lstUsersByTimeZone.length, '(id: ' + evt.getGroups().id + ')']);
		}
	});

	$.plot('#timezone_user', lstUsersByTimeZone, {
		series: {stack: false,
			bars: {
				show: true,
				barWidth: 0.5,
				align: 'center',
				fillColor: "#ca2e2e",
				//fillColor: "#505050",
				lineWidth: 1
			},
			fill: 1,
			color: "#0057B7"
		},
		xaxis: {ticks: lstUsersByTimeZoneLegend},
		legend: { show: true }
	}).resize();
	//////////////////////////////////////////////////////////////////////////////
}





var $countAccess = -1;
var $timeline;
var $limit = 7;
LoadPage(function(){

	initGraficos();
	$timeline = new Timeline($('#timeline'), $limit);

	setTimeout(newInitIndexPage, 0);

	// Antes era carregado aqui, mudei para carregar em newInitIndexPage
	//$('#total_timespan').html(new TimeZone().countAll());
	if(Main.isOnline() === true && Main.isServer() === false){
		$('div.dashboard-stat a.more').attr('href', '#');
	}


});

function getLastEvent(portal, event){
		var out = '<br />';
		var evt = null;
		if(event == null && portal.getAccessEvents().length > 0){
			evt = portal.getAccessEvents()[0];
		}else{
			evt = event;
		}
		if(evt != null){
			out = 	'Last access: ' +
					('00' + evt.getTime().getHours()).slice(-2) + ':' +
					('00' + evt.getTime().getMinutes()).slice(-2) + ' ' +
					('00' + evt.getTime().getDate()).slice(-2) + '/' +
					('00' + (evt.getTime().getMonth()+1)).slice(-2);// + ' - ' +
					//event.getUser().getName();
		}
		return out;
	};
