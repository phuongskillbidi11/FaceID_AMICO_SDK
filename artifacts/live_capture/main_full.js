
$('html, body').css('background-color', '#ffffff');
$('#MasterConteudo').hide();

window.addEventListener('load', function () {
	setTimeout(() => {
		const navbarInner = document.querySelector('.brand-bar');
		if (navbarInner) {
			navbarInner.style.display = 'flex';
		}
	}, 1);
});

var system_information;

function convertBigInt(value, radix) {
    return [...value.toString()]
        .reduce((r, v) => r * BigInt(radix) + BigInt(parseInt(v, radix)), 0n);
}

function GetDeviceIdBySerial(nserie) {
    var parts = nserie.split('/');
    if (parts.length == 2) {
        var cHW = parts[0].substring(0, parts[0].length - 1);
        var nHW = convertBigInt(cHW, 36);
        var nSEQ = convertBigInt(parts[1], 16);
        var vHigh = BigInt(2**32);
        return (nHW * vHigh) + nSEQ;
    }
    else
        return convertBigInt(nserie, 36);
}

function get_system_information(){
	if(!system_information)
		system_information = MessengerUtil.send('system_information');
	return system_information;
}

var database_metadata;

function get_database_metadata(){
	if(!database_metadata)
		database_metadata = MessengerUtil.send('object_metadata');
	return database_metadata;
}

function reload_database_metadata() {
	database_metadata = null;
	get_database_metadata();
	tables = null;
	get_tables_order();
	tables_default = null;
	get_tables_order(true);
}

var rfid_module;

function get_rfid_module() {
  if (!rfid_module)
    rfid_module = MessengerUtil.send('device_rfid_module').module;
  return rfid_module;
}

var tables = null;
var tables_default = null;

function get_tables_order(default_tables) {
	var default_tbls =  typeof default_tables !== 'undefined' ? default_tables : false;

	if (!default_tbls && tables == null)
		tables = MessengerUtil.send("objects_dependency_order", {"insert_order": true, "only_default": false }).tables;

	if (default_tbls && tables_default == null)
		tables_default = MessengerUtil.send("objects_dependency_order", {"insert_order": true, "only_default": true }).tables;

	return default_tbls ? tables_default : tables;
}

var Main = function(){
	return {
		isOnlineAvailable : function(){
			return get_system_information().online_available;
		},
		isOnline : function(){
			var result = MessengerUtil.send('get_configuration', { 'general' : ['online'] });
			if(result.error)
				return false;

			return Main.isOnlineAvailable() && result.general.online == 1;
		},

		isIdFlex:function () {
        	var serial = get_system_information().serial;
        	var patt = (/^0A|^0E|^0F|^0G/);
            return patt.test(serial);
        },

		isQRCodeModeAlpha:function() {
			const data = MessengerUtil.send(
				'get_configuration',
				{
					face_id: [
						'qrcode_legacy_mode_enabled'
					]
				}
			);
			if (data.face_id.qrcode_legacy_mode_enabled === "0") {
				return true;
			} else {
				return false;
			}

		},

		isIdFlexAttendance:function () {
			var serial = get_system_information().serial;
			var patt = (/^0[A|E|F|G][0-9A-Z][0-9A-Z][0-9A-Z][2|3]/);
			return patt.test(serial);
		},

		isIdAccess:function () {
            // Verifica se é IdAccess
            var serial = get_system_information().serial;
            var patt;
            if (serial.length === 4){
            	patt = (/^[J-Lj-lsS]/);
            	return !patt.test(serial);
            }else{
            	patt = (/^02|^03|^04|^0I|^0J/);
            	return patt.test(serial);
            }
        },

		isIdBoxController:function () {
            // Verifica se é IdBoxController
            var serial = get_system_information().serial;
            var patt;
            if (serial.length === 4){
            	patt = (/^[lL]/); //
            }else{
            	patt = (/^0502/);
            }
            return patt.test(serial);
		},

		isIdBlock: function () {
			//verifica se é IdBlock
			var serial = get_system_information().serial;
			var patt;
			if(serial.length == 4){
				patt = (/^[kKsS]/);
			}else{
				patt = (/^09|^0K/);
			}
			return patt.test(serial);
		},

		isAllwinner: function () {
			// Verifica se é iDAccess Nano, iDAccess Pro, iDFlexV2, iDAccessH2, iDFitH2 ou iDBlockV2
			var serial = get_system_information().serial;
			var patt;
			if(serial.length == 4){
				return false;
			}else{
				patt = (/^0E|^0F|^0G|^0I|^0J|^0K/)
			}
			return patt.test(serial);
		},

		isIdUHF: function () {
			//verifica se é iDUHF
			var serial = get_system_information().serial;
			if(serial.length == 4){
				return false;
			}

			var patt = (/^0N/);
			return patt.test(serial);
		},

		has_SecBox: function () {
			return true;
		},

		iDBlockNext_mode: function () {
			const data = MessengerUtil.send('get_configuration',
			{
				sec_box: ["catra_role"]
			});

			if (data.error)
				return false;

			var catra_enabled = data.sec_box.catra_role != '0';

			return catra_enabled;
		},

		secbox_mode: function () {
			const data = MessengerUtil.send('get_configuration',
			{
				sec_box: ["catra_role"]
			});

			if (data.error)
				return false;

			var secbox_enabled = data.sec_box.catra_role == '0';

			return secbox_enabled;
		},

		isiDBlockNextPrimary: function () {
			const data = MessengerUtil.send('get_configuration',
			{
				sec_box: ["catra_role"]
			});

			if (data.error)
				return false;

			var catra_role = data.sec_box.catra_role == '1';

			return catra_role;
		},

		hasBiometricIhm: function () {
			const data = MessengerUtil.send('get_ihm');

			if (data.error)
				return false;

			return data.id !== 0 && data.has_bio === 1;
		},

		isiDBlockNextSecondary: function () {
			const data = MessengerUtil.send('get_configuration',
			{
				sec_box: ["catra_role"]
			});

			if (data.error)
				return false;

			var catra_role = data.sec_box.catra_role == '2';

			return catra_role;
		},

		isRfid: function () {
			const serial = get_system_information().serial;
			const rfidSubModels = [
				// iDAccess Pro
				"0E02",
				"0E04",

				// iDAccess Nano
				"0F02",
				"0F04",

				// iDFlex V2
				"0G02",
				"0G04",

				// iDAccess H2
				"0I02",
				"0I04",

				// iDFit H2
				"0J02",

				// iDBlock V2
				"0K03",
				"0K04",
				"0K07",
				"0K08",
				"0K0C",
				"0K0E",
				"0K13",
				"0K14",
				"0K17",
				"0K18",
				"0K1C",
				"0K1E",
				"0K23",
				"0K24",
				"0K27",
				"0K28",
				"0K2C",
				"0K2E",
				"0K33",
				"0K34",
				"0K37",
				"0K38",
				"0K3C",
				"0K3E",
				"0K40",
				"0K42",
				"0K44",
				"0K46",
				"0K48",
				"0K51",
				"0K52",
				"0K57",
				"0K58",

				// iDFace
				"0M02",
			];
			return rfidSubModels.includes(serial.substring(0,4));
		},

		isMifare: function () {
			const serial = get_system_information().serial;
			var has_mifare = false;
			const mifareSubModels = [
				"0A03", "0A05", "0E03", "0E05",
				"0F03", "0F05", "0G03", "0G05",
				"0I03", "0I05", "0J03", "0J05",
				"0M03"
			];
		
			//Checks for old serial
			if(serial.length <= 4) {
				switch (serial[0].toUpperCase()) {
					case 'E':
					case 'I':
					case 'Q':
					case 'V':
						has_mifare = true;
						break;
					default:
						has_mifare = false;
						break;
				}
			} else {
				has_mifare = mifareSubModels.includes(serial.substr(0,4));
			}
		
			return has_mifare;
		},

		isHID: function () {
			const serial = get_system_information().serial;
			const hidSubModels = [
				"0E06", "0E07", "0M04", "0Z01", "1Z01"

			];
			return hidSubModels.includes(serial.substring(0, 4));
		},

		isServer: function () {
			// Pega se é servidor
			return get_system_information().license.type == 1;
		},

    attendanceMode: function() {
      const data = MessengerUtil.send('get_configuration',
        {
          general: ["attendance_mode"]
        });

      if (data.error)
        return false;

      return data.general.attendance_mode == '1';
    },

    isLogType: function() {
      const data = MessengerUtil.send('get_configuration',
        {
          identifier: ["log_type"]
        });

      if (data.error)
        return false;

      var logType = data.identifier.log_type == '1';
      return logType;
    },

		tablesOrder: function(insert, tbls_list_or_default) {
			var insert_order = typeof insert !== 'undefined'? insert : true;
			var tbls_list = typeof tbls_list_or_default !== 'undefined' &&
							typeof tbls_list_or_default !== 'boolean' ? tbls_list_or_default : null;
			var default_tbls = typeof tbls_list_or_default === 'boolean' ? tbls_list_or_default : false;
			var lst_ret = [];
			$.each(get_tables_order(default_tbls), function (key, val) {
				if (tbls_list == null || tbls_list.indexOf(val) != -1)
					lst_ret.push(val);
			});

			return insert_order ? lst_ret : lst_ret.reverse();
		},

		currentDeviceID: function () {
			return GetDeviceIdBySerial(get_system_information().serial);
		},

		currentDevice: function () {
			var iDevice = new devices();
			iDevice.load({'async' : false, 'value' : Main.currentDeviceID() });
			return iDevice;
		},

		getInfo : function() {
			var infos = {};
			var result = get_system_information();
			if(result.error)
				return infos;
			infos.date = Main.secondsToDate(result.time);
			infos.serialNumber = result.serial;
			infos.frmVersion = result.version;
			infos.macAddress = result.network.mac;
			return infos;
		},
		getSystemDate : function() {
			var system_information = MessengerUtil.send('system_information');
			if(system_information.error)
				return {};
			return Main.secondsToDate(system_information.time);
		},
		blockUI : function (el) {
            var el = jQuery(el);
            el.block({
                    message: '<img src="/assets/img/ajax-loading.gif" align="">',
                    centerY: true,
                    css: {
                        top: '10%',
                        border: 'none',
                        padding: '2px',
                        backgroundColor: 'none'
                    },
                    overlayCSS: {
                        backgroundColor: '#000',
                        opacity: 0.3,
                        cursor: 'wait'
                    }
                });
        },

        // wrapper function to  un-block element(finish loading)
        unblockUI : function (el) {
            jQuery(el).unblock();
        },

		addItem : function(choisen, lst, add){
			for(var i = 0; i < lst.length; i++){
				choisen.addItem(lst[i].getId(), lst[i].getName(), add, lst[i]);
			};
		},


		addItemSingle : function(choisen, lst, add){
			for(var i = 0; i < lst.length; i++){
				choisen.addItem(lst[i].id, lst[i].name, add, null);
			};
		},

		dateToSeconds : function(dt){
			if (!dt)
				return 0;
			return parseInt(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), dt.getUTCHours(), dt.getUTCMinutes(), dt.getUTCSeconds(), dt.getUTCMilliseconds()) / 1000);
		},

		secondsToDate : function(sec){
			var d = new Date(0);
			d.setUTCSeconds(sec);
			return d;
		},

		secondsToDateString: function (sec) {
			if (sec === 0 || sec === '')
				return '';
			const clock_format_message = MessengerUtil.send('get_configuration', { general: ['month_day_year_format'] }).general;
			var d = new Date(0);
			d.setUTCSeconds(sec);
			if (clock_format_message.month_day_year_format == "0") {
				return ('00' + d.getUTCDate()).slice(-2) + '/' +
					('00' + (d.getUTCMonth() + 1)).slice(-2) + '/' +
					(d.getUTCFullYear());
			} else {
				return ('00' + (d.getUTCMonth() + 1)).slice(-2) + '/' +
					('00' + d.getUTCDate()).slice(-2) + '/' +
					(d.getUTCFullYear());
			}
		},


		secondsToTimeString : function(sec){
			if (sec === '')
				return '';
			const clock_format_message = MessengerUtil.send('get_configuration', { general: ['clock_12h_format'] }).general;
			var d = new Date(0);
			d.setUTCSeconds(sec);
			var format_hour = d.getUTCHours();
			if (clock_format_message.clock_12h_format != "0") {
				if (format_hour == 0) {
					format_hour = 12
				}
				else if (format_hour > 12) {
					format_hour -= 12
				}
			}
			return ('00' + format_hour).slice(-2) + ':' +
						('00' + d.getUTCMinutes()).slice(-2) + // ':' +
						//('00' + d.getUTCSeconds()).slice(-2) +
						(clock_format_message.clock_12h_format != "0" ? (d.getUTCHours() < 12 ? ' AM' : ' PM') : '');
		},

		sessionFail : function(data, callback, oops, title, desc, isFullScreen) {

			if (data && data.error){
				if((data.error === 'Invalid session' || data.error.indexOf('Invalid access level') === 0) && $.cookie('login') && $.cookie('password')) {
					$.ajax({
						url: "/hidlogin.fcgi",
						cache: false,
						async: false,
						type: 'POST',
						data:{
							login: $.cookie('login'),
							password: $.cookie('password')
						},
						success: function(data) {
							document.cookie = "session=" + data.session + "; path=/";
							//window.location.replace("/en_US/html/index.html");
						},
						dataType: "JSON"
					});

					function ReturnSession(){
						location.reload();
						/*clearInterval(interval);
						$('#MasterConteudo').show();
						$('#sessionFail').remove();*/
					}
					var interval;
					var time = 5;
					callback = function(){
						$('#btnReturnSession').click(function(event) {
							ReturnSession();
						});
						interval = setInterval(function(){

							if(time == 0)
								ReturnSession();

							$('#countReboot').html(('00' + time).slice(-2));
							time--;
						}, 1000);

					};
					desc = 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds or'+
					' <a class="pointer" id="btnReturnSession"> click here</a> to return.';
					isFullScreen = true;



				}else if(data.error !== 'customError' &&
						data.error !== 'Invalid session' &&
						data.error.indexOf('Invalid access level') !== 0)
					return false;


				if(title == null)
					title = 'Session has expired';
				if(desc == null)
					desc = '';
				else
					desc += '<br />';

				if(oops == null)
					oops = 'Oops!';

				var content;
				//$('#MasterConteudo').before('<div id="sessionFail"></div>');
				//$('#MasterConteudo').hide();
				content = $('#MasterConteudo');

				if(isFullScreen == true){
					$('#MasterPage_header .brand').attr('href', '#')
				}else{
					desc += 'To return to the initial screen <a href="login.html"> click here!</a>';
					//content = $('#MasterConteudo .page-content .container-fluid');
				}

				content.html('<div class="col-md-6 page-404">'+
					'<br /><br /><br />' +
					'<div class="number font-light-red">' + oops +'</div>'+
					'<div class="details font-light-grey">'+
						'<h3>' + title + '</h3>'+
						'<p>' + desc + '</p>'+
					'</div>'+
				'</div>');
				/*var modal = new Modal();
				modal.setHasConfirm(false);
				modal.setCancelButton(null);
				modal.setOkButton('OK');
				modal.setModal('');
				//modal.setText('<center><h1>Sessão Encerrada</h1></center>');


				modal.setType(false);
				modal.setCallbackSave(function () {
					window.location = "/";
				});
				modal.show(function(){
					setTimeout(function(){ window.location.replace("/");}, 3000);
				});*/
				//throw(data.error);
				if(callback != null)
					callback();
			}
		},

		verifyImage : function(){
			$('img').bind('error', function(){
				$(this).attr('src', '/images/null.jpg');
			});
		},

		bigJSONparse : function(objStr) {
		  var obj = JSONbig.parse(objStr);
		  if (obj.cards) { //TODO: deveria tratar BigInts de forma mais genérica
		    for (const card of obj.cards) {
		      if (bignumber.BigNumber.isBigNumber(card.value)) {
		        card.value = BigInt(card.value.toString());
		      }
		    }
		  }
		  return obj;
		},

		bigJSONstringify : function(objJson) {
		  return JSONbig.stringify(objJson);;
		}

	}
}();


$.ajax({
	  url: "/en_US/html/header.html",
	  cache: true,
	  async: false,
	  dataType: "html",
	}).done(function( html ) {
		var elem = $(html);
		elem.hide();
		$("body").prepend(html);
		elem.show();
	});



$.ajax({
	url: "/en_US/html/footer.html",
	cache: true,
	async: false,
	dataType: "html",
}).done(function( html ) {
	var footer = $(html);
	footer.hide();
	$("body").append(footer);
});


$(document).ready(function() {



	document.onkeydown = function(e){
        e = e || window.event;
        if (e.keyCode == 116)
            localStorage.clear();
		else if (e.keyCode == 13)
			$('.clickDefault').click();
	}

	addScript([
		"/assets/plugins/jquery-ui-1.10.4.custom.min.js",
		"/assets/plugins/jquery-slimscroll/jquery.slimscroll.min.js",
		"/assets/plugins/bootstrap/js/bootstrap.min.js",
		"/assets/plugins/uniform/jquery.uniform.min.js",
		"/assets/plugins/jquery-migrate-1.2.1.min.js",
		"/assets/plugins/bootstrap-wizard/jquery.bootstrap.wizard.min.js",
		"/assets/plugins/bootstrap-switch/static/js/bootstrap-switch.js",
		"/assets/plugins/jquery.blockui.min.js",
		"/assets/plugins/jquery.cookie.min.js",
		"/assets/plugins/jquery.mask.min.js",
		"/assets/plugins/json-bigint/json-bigint.js",
		"/assets/scripts/app.js",
		"/en_US/js/messenger.js",
		"/en_US/js/CID.js",
		"/en_US/js/class.js"
	]);

	$('#MasterConteudo').show();


	addScript([
			"/en_US/js/class/report.js",
			"/en_US/js/class/baseclass.js",
			"/en_US/js/class/accessevent.js",
			"/en_US/js/class/accessrule.js",
			"/en_US/js/class/portal.js",
			"/en_US/js/class/alarm.js",
			"/en_US/js/class/group.js",
			"/en_US/js/class/timespan.js",
			"/en_US/js/class/timezone.js",
			"/en_US/js/class/user.js",
			"/en_US/js/class/action.js",
			"/en_US/js/class/area.js",
			// "/en_US/js/class/waitingroom.js", TODO: Modificar para portal_rule
			"/en_US/js/class/device.js",
			"/en_US/js/class/intermediatetable.js",
			"/assets/plugins/validate.js",
			"/assets/plugins/wColorPicker/wColorPicker.js",
			"/assets/plugins/flot/jquery.flot.min.js",
			"/assets/plugins/flot/jquery.flot.stack.min.js",
			"/assets/plugins/flot/jquery.flot.pie.min.js",
			"/assets/plugins/flot/jquery.flot.categories.min.js",
			"/assets/plugins/flot/jquery.flot.time.min.js",
			"/assets/plugins/flot/jquery.flot.resize.min.js",
			"/assets/plugins/datepicker/bootstrap-datepicker.js",
			"/assets/plugins/datepicker/bootstrap-datepicker.pt-BR.js",
			"/assets/plugins/datepicker/bootstrap-datepicker.es.js",
			"/assets/plugins/datepicker/datepicker.js",
			"/en_US/plugins/table.js",
			"/en_US/plugins/chosen.js",
			"/assets/plugins/modal/bootstrap-modal.js",
			"/assets/plugins/modal/bootstrap-modalmanager.js",
			"/en_US/plugins/modal.js",
			"/assets/plugins/timepicker/timepicker.js",
			"/assets/plugins/timeline/timeline.js",
		]);
		Main.blockUI($('#MasterConteudo .page-content'));

		$('a.link[href]').live('click', function(){
			link($(this).attr('href'));
			return false;
		});
		$.ajax({
			url: "/en_US/html/menu.html",
			cache: true,
			async: false,
			dataType: "html",
		}).done(function( html ) {
			var menu = $(html);
			menu.hide();
			$("#MasterConteudo").prepend(menu);
			$.each($CustomItensMenu, function (key, val) {
				val();
			});
			if ($BeforeLoad)
				$BeforeLoad();
			var categoria = $('#MasterConteudo ul.page-sidebar-menu li#'+$('#MasterConteudo #BREADCRUMB').attr('cat'));
			categoria.addClass('active');
			categoria.find('.arrow').addClass('open');
			var nivel = categoria.find('#'+$('#MasterConteudo #BREADCRUMB').attr('nivel'));
			categoria = categoria.find('a');
			if(nivel.length > 0){
				nivel.addClass('active');
				nivel = nivel.find('a');
				$('#MasterConteudo #BREADCRUMB').html(
				'<div class="span12">'+
					'<!-- BEGIN PAGE TITLE & BREADCRUMB-->'+
					'<h3 class="page-title">'+
						 nivel.html()+
						'<small>'+
							'<span id="sys_date"></span>'+
						'</small>'+
					'</h3>'+
					'<ul class="breadcrumb">'+
						'<li> ' + categoria.html() + ' </li>'+
						'<li> <i class="icon-angle-right"></i> </li>'+
						'<li> ' + nivel.html() + ' </li>'+
					'</ul>'+
					'<!-- END PAGE TITLE & BREADCRUMB-->'+
				'</div>'
			 );
			}else{
				$('#MasterConteudo #BREADCRUMB').html(
					'<div class="span12">'+
						'<!-- BEGIN PAGE TITLE & BREADCRUMB-->'+
						'<h3 class="page-title">'+
							 categoria.find('span').html()+
							'<small>'+
								'<span id="sys_date"></span>'+
							'</small>'+
						'</h3>'+
						'<ul class="breadcrumb">'+
							'<li> ' + categoria.html() + ' </li>'+
						'</ul>'+
						'<!-- END PAGE TITLE & BREADCRUMB-->'+
					'</div>'
				 );
			}
			menu.find('#btnLogOut_Menu').click(function() {
				$.cookie('password', null, {'expires' : -1, 'path' : '/'});

				MessengerUtil.send('logout', null, null, false);
				window.location.replace("login.html");
			});

			menu.show();
		});


		if($MainLoad != null){
			setTimeout(function(){$MainLoad()}, 200);
		}
		App.init()

		if (Main.isServer())
			$('.server').show();
		else{
			$('.server').hide();
			if(Main.isOnline())
				$('.offline').hide();
			else
				$('.offline').show();
		}

		if(Main.isOnlineAvailable()) {
			$('.online_available').show();
		} else {
			$('.online_available').hide();
		}

		if(Main.isIdAccess()) {
			$('.idaccess').show();
			$('.hide_idaccess').hide();
		} else {
			$('.idaccess').hide();
			$('.hide_idaccess').show();
		}

		if(Main.isIdBoxController()) {
			$('.idboxcontroller').show();
			$('.hide_idboxcontroller').hide();
		} else {
			$('.idboxcontroller').hide();
		}

		if(Main.isIdBlock()){
			$('.idblock').show();
			$('.hide_idblock').hide();
		}else{
			$('.idblock').hide();
			$('.hide_idblock').show();
		}

		if(Main.isAllwinner()){
			$('.allwinner').show();
			$('.hide_allwinner').hide();
		}
		else{
			$('.allwinner').hide();
			$('.hide_allwinner').show();
		}

		if(Main.isIdUHF()){
			$('.iduhf').show();
			$('.hide_iduhf').hide();
		}else{
			$('.iduhf').hide();
		}

		if(Main.isIdFlexAttendance()) {
			$('.idflex').show();
			$('.hide_idflex').hide();
			$('.idflex_attendance').show();
			$('.hide_idflex_attendance').hide();
		} else if(Main.isIdFlex()) {
			$('.idflex').show();
			$('.hide_idflex').hide();
			$('.idflex_attendance').hide();
		}  else {
			$('.idflex_attendance').hide();
			$('.idflex').hide();
			$('.hide_idflex').show();
		}

		// FIXME: Pensar em algo melhor
		if(Main.isIdAccess() || Main.isIdFlex()) {
			$('.idaccess_or_idflex').show();
			$('.hide_idaccess_or_idflex').hide();
		} else {
			$('.idaccess_or_idflex').hide();
			$('.hide_idaccess_or_idflex').show();
		}

		if(Main.has_SecBox()) {
			$('.has_secbox').show();
		} else {
			$('.has_secbox').hide();
		}

        if(Main.secbox_mode()) {
			$('.secbox_mode').show();
		} else {
			$('.secbox_mode').hide();
		}

		if(Main.iDBlockNext_mode()) {
			$('.idblocknext_mode').show();
			$('.hide_idblocknext_mode').hide();
		} else {
			$('.idblocknext_mode').hide();
			$('.hide_idblocknext_mode').show();
		}

		if (Main.isRfid()) {
			$('.rfid').show();
		} else {
			$('.rfid').hide();
		}

		if (Main.isMifare()) {
			$('.mifare').show();
		} else {
			$('.mifare').hide();
		}

		if (Main.isHID()) {
			$('.hid').show();
		} else {
			$('.hid').hide();
		}

		$('.hide_idblock_next_secondary').show();

    if (Main.attendanceMode()) {
      $('.attendance_mode').show();
      $('.hide_attendance_mode').hide();
    } else {
      $('.attendance_mode').hide();
      $('.hide_attendance_mode').show();
    }

    if (Main.isLogType()) {
      $('.log_type').show();
      $('.hide_log_type').hide();
    } else {
      $('.log_type').hide();
      $('.hide_log_type').show();
    }

		Main.verifyImage();
		Main.unblockUI($('#MasterConteudo .page-content'));
		$('body').addClass('page-header-fixed page-sidebar-fixed page-footer-fixed');
});



$( document ).ajaxComplete(function() {

	$('a.link[href]').bind('click', function(){
		link($(this).attr('href'));
		return false;
	});
	Main.verifyImage();
});
function addScript(scripts, callback){
	scripts.forEach(function(script){
		$.ajax({
			url: script,
			cache: false,
			async: false,
			dataType: "script"
		});
	});
}

function link(url){
	$('body').fadeOut("fast", function(){
		window.location = url;
	});
}

var date;
var uptime;

var $MainLoad;
function LoadPage(callback){
	$MainLoad = callback;

}

var $BeforeLoad = false;
function BeforeLoad(fun) {
	$BeforeLoad = fun;
}

function reboot(time) {
	$('#reboot_p').show();
	$("#mask_loading").show();
	$("#main").addClass("loading");

	$.get('/fcgi/command.fcgi', {
		command : 'reboot',
		reboot_time : time
	}).done(function(data) {
		setTimeout(function() {
			location.assign('/');
		}, time * 1000 + 2000);
	});
}


function tick_clock() {
	//$('#sys_date').html(date.format("dddd, dd de MMMM de YYYY, HH:mm:ss"));
	var options = {
		weekday: "long", year: "numeric", month: "long", day: "numeric"
	};
	$('#sys_date').html(date.toLocaleTimeString("pt",options));
	/*$('#sys_time').html(
			' ' + print_2_digits(date.getHours()) + ":" + print_2_digits(date.getMinutes()) + ":"
					+ print_2_digits(date.getSeconds()));
	$('#sys_date').html(
			' ' + print_2_digits(date.getDate()) + "/" + print_2_digits((date.getMonth() + 1)) + "/"
					+ date.getFullYear());*/

	var days = Math.floor(uptime.getTime() / (1000 * 60 * 60 * 24));
	if (days == 0) {
		days = "";
	} else if (days == 1) {
		days += " day, ";
	} else {
		days += " days, ";
	}
	$('#sys_uptime').html(
			days + print_2_digits(uptime.getUTCHours()) + ":" + print_2_digits(uptime.getUTCMinutes()) + ":"
					+ print_2_digits(uptime.getUTCSeconds()));

	date.setSeconds(date.getSeconds() + 1);
	uptime.setSeconds(uptime.getSeconds() + 1)
}

function print_2_digits(value) {
	return (value < 10 ? "0" : "") + value;
}

function get_sys_info() {
	$.getJSON('/fcgi/command.fcgi', {
		command : 'sys_info'
	}, function(data) {
		date = new Date(data.sys_info.date.year, data.sys_info.date.month, data.sys_info.date.day,
				data.sys_info.time.hour, data.sys_info.time.min, data.sys_info.time.sec);

		uptime = new Date((data.sys_info.uptime.days * (1000 * 60 * 60 * 24))
				+ (data.sys_info.uptime.hours * (1000 * 60 * 60)) + (data.sys_info.uptime.mins * (1000 * 60))
				+ (data.sys_info.uptime.secs * 1000));
		tick_clock();
		$('#sys_free_ram').append(' ' + data.sys_info.free_ram + ' kb');
		$('#sys_total_ram').append(' ' + data.sys_info.total_ram + ' kb');
		$('#sys_free_disk').append(' ' + data.sys_info.free_disk + ' mb');
		$('#sys_total_disk').append(' ' + data.sys_info.total_disk + ' mb');
		$('#total_users').append(' ' + data.sys_info.user_count);
		$('#total_templates').append(' ' + data.sys_info.template_count);
		$('#total_cards').append(' ' + data.sys_info.card_count);
	});
}


var relays;

const OutputMode = {
	NORMAL_ACCESS: "0",
	ONLY_REJECTED: "1",
	BELL: "2",
	SIREN: "3",
	EMERGENCY: "4",
	OUTPUT_MODE_COUNT: "5"
};

const GpioExtMode = {
	DISABLED: "0",
	ENABLE_ID: "1",
	ALARM_INPUT: "2",
	EMERGENCY_MODE_INPUT: "3",
	LOCKDOWN_MODE_INPUT: "4",
	PJSIP_BUTTON: "5",
	INTERLOCK: "6",
	OPEN_RELAY: "7",
	OPEN_SEC_BOX: "8",
	OPEN_ALL: "9"
};

const ActivationMode = {
	PULSE: "1",
	EDGE: "2"
};

function updateRelaysData() {
	//Descobre o que cada relé controla
	relays = [];
	var relaysCodes = [];
	var currentDev = Main.currentDevice();
	var relay_count = MessengerUtil.send('get_configuration', { general: [ 'relay_count']}).general.relay_count;
	var conf_json = { general: ['bell_enabled', 'bell_relay'], 'alarm': ['siren_enabled', 'siren_relay']};
	let relay_out_mode = MessengerUtil.send('get_configuration', { general: [ 'relay_out_mode']}).general.relay_out_mode;
	for (var i = 1; i <= relay_count; i++) {
		conf_json.general.push("relay" + i +"_enabled");
		relaysCodes.push(i);
	}
	var general_conf = MessengerUtil.send('get_configuration', conf_json);

	var primeiraPorta = null;
	$.each(relaysCodes, function(index,relay) {
		var target = '';
		var icon = '';
		var type = '';
		if (general_conf.alarm.siren_relay == relay.toString() && general_conf.alarm.siren_enabled != 0
				&& relay_out_mode == OutputMode.SIREN) {
			type = 'siren';
			target = 'Siren (relay)';
			icon = '<i class="icon-bullhorn"></i>';
		} else if(general_conf.general.bell_relay == relay.toString() && general_conf.general.bell_enabled != 0 
			&& relay_out_mode == OutputMode.BELL){
			type = 'bell';
			target = "Ring Bell (relay)";
			icon = '<i class="icon-bell"></i>';
		}
		else if (relay_out_mode == OutputMode.NORMAL_ACCESS || relay_out_mode == OutputMode.ONLY_REJECTED) {
			type = 'door';
			if (primeiraPorta !== null) {
				relays[primeiraPorta].target = 'Open relay ' + relays[primeiraPorta].relay;
				target = 'Open relay ' + relay;
			}
			else {
				target = 'Open relay';
				primeiraPorta = index;
			}
			icon = '<img style="padding-right:10px	" src="/images/icon-door.png" />';
		}
		relays.push({
			active: general_conf.general['relay' + relay + '_enabled'] !== "0" && target !== '',
			target: target,
			type: type,
			icon: icon,
			relay: relay
		});
	});

	if(Main.secbox_mode()){
		relays.push({
			active: true,
			target: 'Open Door',
			type: 'sec_box',
			icon: '<img src="/images/secbox.png" width="20" style=" margin-right: 16px" />',
			id: 65793
		});
	}

    if (Main.iDBlockNext_mode()) {
        if(Main.isiDBlockNextPrimary()){
            relays.push({
            active: true,
            target: "Clockwise",
            type: 'catra',
            allow: 'clockwise'
            });
            relays.push({
            active: true,
            target: "Anticlockwise",
            type: 'catra',
            allow: 'anticlockwise'
            });
            relays.push({
            active: true,
            target: "Both",
            type: 'catra',
            allow: 'both'
            });
        }
    }

}

function drawRelaysTitleMenu(name) {
    $("<li class=\"pointer\" id=\menu_relay\">" +
      "<a class=\"pointer\">" +
        "<i class=\"icon-refresh\"></i>" +
        "<span class=\"title\">" + name + "</span>" +
        "<span class=\"arrow\"></span>" +
      "</a>" +
      "<ul id=\"sub_menu_relay\" class=\"sub-menu\"></ul>" +
    "</li>").insertBefore("#conf");
  }

function drawRelaysMenu() {
    var hasSubMenus = false;
    var name = "";

    if(Main.iDBlockNext_mode() && Main.isiDBlockNextPrimary()){
        hasSubMenus = true;
        name = "Turn release";  
    }

	updateRelaysData();
    if (hasSubMenus) {
        drawRelaysTitleMenu(name);
    }
	$.each(relays, function (code, relay) {
		$("#menu_relay" + code).remove();
		if(!Main.isServer()) {
			if (relay.active) {
                if (hasSubMenus) {
                $("#sub_menu_relay").append("<li class=\"pointer\" id=\"menu_relay" + code + "\"><a>" + relay.target + "</a></li>");
                } else {
                $("<li class=\"pointer\" id=\"menu_relay" + code + "\"><a>" + relay.icon + ' ' + relay.target + "</a></li>").insertBefore("#conf");
                }
				$("#menu_relay" + code).mousedown(function () {
					var post_data;
					if(relay.type == 'siren'){
						post_data = { actions: [ { action: "siren_play", parameters: "" } ]};
					}else if (relay.type == 'bell'){
						post_data = { actions: [ { action: "bell_ding_dong", parameters: ""} ]};
					}else if (relay.type == 'sec_box'){
						post_data = { actions: [ { action: "sec_box", parameters: ("id=" + relay.id + ", reason=3")  } ]};
                    }else if (relay.type == 'catra'){
						post_data = { actions: [ { action: "catra", parameters: ("allow=" + relay.allow + ", reason=3")  } ]};
                    }else{
						post_data = { actions: [ { action: "door", parameters: ("door=" + relay.relay + ", reason=3")  } ]};
					}
					var response = MessengerUtil.send('execute_actions', post_data, null, true);
					let status_denied = false;
					for (let key in response.actions) {
						if (response.actions[key].status === "denied") {
							status_denied = true;
							break;
						}
					}
					if (status_denied) {
						var modalResponse = new Modal();
						modalResponse.setTitle('Remote Interlocking');
						modalResponse.setContent('Close open door to continue');
						modalResponse.show();
						setTimeout(function() { modalResponse.hide(); }, 2000);
					}
				});
				$("#menu_relay" + code).mouseup(function () {
					var post_data;
					if (relay.type == 'siren'){
						post_data = { actions: [ { action: "siren_stop", parameters: ""} ]};
						MessengerUtil.sendAsync('execute_actions', post_data, null, true);
					}else if (relay.type == 'bell'){
						post_data = { actions: [ { action: "bell_dong", parameters: ""} ]};
						MessengerUtil.sendAsync('execute_actions', post_data, null, true);
					}
				});
			}
		}
	});
}

var $userTypesCode = [];

function drawUserTypesMenu() {
	if (!Main.isIdAccess() && !Main.isIdFlex()) {
		//Remove tipos de usuários existentes
		$.each($userTypesCode, function (key, val) {
			$("#menu_usertype" + val).remove();
		})
		$userTypesCode = [];
		//Procura por tipos de usuário (apenas nome)
		var result = MessengerUtil.send('load_objects', {
					'object': 'user_types',
					'join': 'LEFT',
					'fields': ['id', { 'object': 'custom_tables', 'field': 'name' }],
					'order': [{ 'object': 'custom_tables', 'field': 'name'}]
				}, null, true);

		$.each(result.user_types, function (key, val) {
			$("<li class=\"pointer\" id=\"menu_usertype" + val.id
				+ "\"><a href=\"customusers.html?type=" + val.id + "\">"
				+ val['custom_tables.name'] + "</a></li>").insertBefore("#visits");
			$userTypesCode.push(val.id);
		});
	}
}

var $CustomItensMenu = [drawRelaysMenu, drawUserTypesMenu];


/*
http://stackoverflow.com/questions/990904/javascript-remove-accents-diacritics-in-strings
Função para substituir acentos por letras e remover qualquer caractere exceto letras e números
*/
var _defaultDiacritics = [
        {'base':'A', 'letters':'\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F'},
        {'base':'AA','letters':'\uA732'},
        {'base':'AE','letters':'\u00C6\u01FC\u01E2'},
        {'base':'AO','letters':'\uA734'},
        {'base':'AU','letters':'\uA736'},
        {'base':'AV','letters':'\uA738\uA73A'},
        {'base':'AY','letters':'\uA73C'},
        {'base':'B', 'letters':'\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181'},
        {'base':'C', 'letters':'\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E'},
        {'base':'D', 'letters':'\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779'},
        {'base':'DZ','letters':'\u01F1\u01C4'},
        {'base':'Dz','letters':'\u01F2\u01C5'},
        {'base':'E', 'letters':'\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E'},
        {'base':'F', 'letters':'\u0046\u24BB\uFF26\u1E1E\u0191\uA77B'},
        {'base':'G', 'letters':'\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E'},
        {'base':'H', 'letters':'\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D'},
        {'base':'I', 'letters':'\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197'},
        {'base':'J', 'letters':'\u004A\u24BF\uFF2A\u0134\u0248'},
        {'base':'K', 'letters':'\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2'},
        {'base':'L', 'letters':'\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780'},
        {'base':'LJ','letters':'\u01C7'},
        {'base':'Lj','letters':'\u01C8'},
        {'base':'M', 'letters':'\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C'},
        {'base':'N', 'letters':'\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4'},
        {'base':'NJ','letters':'\u01CA'},
        {'base':'Nj','letters':'\u01CB'},
        {'base':'O', 'letters':'\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C'},
        {'base':'OI','letters':'\u01A2'},
        {'base':'OO','letters':'\uA74E'},
        {'base':'OU','letters':'\u0222'},
        {'base':'OE','letters':'\u008C\u0152'},
        {'base':'oe','letters':'\u009C\u0153'},
        {'base':'P', 'letters':'\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754'},
        {'base':'Q', 'letters':'\u0051\u24C6\uFF31\uA756\uA758\u024A'},
        {'base':'R', 'letters':'\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782'},
        {'base':'S', 'letters':'\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784'},
        {'base':'T', 'letters':'\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786'},
        {'base':'TZ','letters':'\uA728'},
        {'base':'U', 'letters':'\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244'},
        {'base':'V', 'letters':'\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245'},
        {'base':'VY','letters':'\uA760'},
        {'base':'W', 'letters':'\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72'},
        {'base':'X', 'letters':'\u0058\u24CD\uFF38\u1E8A\u1E8C'},
        {'base':'Y', 'letters':'\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE'},
        {'base':'Z', 'letters':'\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762'},
        {'base':'a', 'letters':'\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250'},
        {'base':'aa','letters':'\uA733'},
        {'base':'ae','letters':'\u00E6\u01FD\u01E3'},
        {'base':'ao','letters':'\uA735'},
        {'base':'au','letters':'\uA737'},
        {'base':'av','letters':'\uA739\uA73B'},
        {'base':'ay','letters':'\uA73D'},
        {'base':'b', 'letters':'\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253'},
        {'base':'c', 'letters':'\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184'},
        {'base':'d', 'letters':'\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A'},
        {'base':'dz','letters':'\u01F3\u01C6'},
        {'base':'e', 'letters':'\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD'},
        {'base':'f', 'letters':'\u0066\u24D5\uFF46\u1E1F\u0192\uA77C'},
        {'base':'g', 'letters':'\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F'},
        {'base':'h', 'letters':'\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265'},
        {'base':'hv','letters':'\u0195'},
        {'base':'i', 'letters':'\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131'},
        {'base':'j', 'letters':'\u006A\u24D9\uFF4A\u0135\u01F0\u0249'},
        {'base':'k', 'letters':'\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3'},
        {'base':'l', 'letters':'\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747'},
        {'base':'lj','letters':'\u01C9'},
        {'base':'m', 'letters':'\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F'},
        {'base':'n', 'letters':'\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5'},
        {'base':'nj','letters':'\u01CC'},
        {'base':'o', 'letters':'\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275'},
        {'base':'oi','letters':'\u01A3'},
        {'base':'ou','letters':'\u0223'},
        {'base':'oo','letters':'\uA74F'},
        {'base':'p','letters':'\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755'},
        {'base':'q','letters':'\u0071\u24E0\uFF51\u024B\uA757\uA759'},
        {'base':'r','letters':'\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783'},
        {'base':'s','letters':'\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B'},
        {'base':'t','letters':'\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787'},
        {'base':'tz','letters':'\uA729'},
        {'base':'u','letters': '\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289'},
        {'base':'v','letters':'\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C'},
        {'base':'vy','letters':'\uA761'},
        {'base':'w','letters':'\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73'},
        {'base':'x','letters':'\u0078\u24E7\uFF58\u1E8B\u1E8D'},
        {'base':'y','letters':'\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF'},
        {'base':'z','letters':'\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763'}
    ];

var diacriticsMap = {};
for (var i=0; i < _defaultDiacritics.length; i++){
    var letters = _defaultDiacritics[i].letters;
    for (var j=0; j < letters.length ; j++){
        diacriticsMap[letters[j]] = _defaultDiacritics[i].base;
    }
}

// "what?" version ... http://jsperf.com/diacritics/12
function replaceAccents (str) {
    return str.replace(/[^\u0000-\u007E]/g, function(a){
       return diacriticsMap[a] || a;
    });
}

function removeSpecialCharacters(str) {
	return str.replace(/[ ]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}
