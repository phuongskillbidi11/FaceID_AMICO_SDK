function initConfigurationsPage(){
	//VERIFICO SE O BEEP ESTÁ OU NÃO ATIVADO E COLOCO O TEXTO ADEQUADO	NO BOTÃO

	// if(Main.isIdAccess())
	// 	$('#lstButtons .idaccess').show();
	// else
	// 	$('#lstButtons .idaccess').hide();

	// if (Main.isServer()){
	// 	$('#lstButtons .server').show();
	// }
	// else{
	// 	$('#lstButtons .server').hide();
	// 	if(Main.isOnline())
	// 		$('#lstButtons .offline').hide();
	// 	else
	// 		$('#lstButtons .offline').show();
	// }

	var data = MessengerUtil.send('get_configuration', {general: ['beep_enabled'], identifier: ['log_type', 'multi_factor_authentication']});
	if(data.general.beep_enabled == '1'){
		$('#btnADBeep').addClass('volume_up').find('label').html("Beep Active");
	}
	else{
		$('#btnADBeep').addClass('mute').find('label').html("Beep Inactive");
	}
	if(data.identifier.log_type == '1'){
		$('#btnADLogType').addClass('ok').find('label').html("Register Status Active");
	}
	else{
		$('#btnADLogType').addClass('remove').find('label').html("Register Status Active");
	}
	if (Main.isHID() && !Main.iDBlockNext_mode()) {
		$('#btnAD1to1').addClass('nameplate_alt').find('label').html("Identification Mode");
	}
	else {
		if(data.identifier.multi_factor_authentication == '1'){
			$('#btnAD1to1').addClass('nameplate_alt').find('label').html("1:1 verification");
		}
		else{
			$('#btnAD1to1').addClass('nameplate').find('label').html("1:N Identification");
		}
	}
}
var btFoto = null;
var btFotoSip = null;
var btFotoStreaming = null;
var lDefChange = true;
var canvas;
var canvas_sip;
var canvas_streaming;
LoadPage(function(){
	initConfigurationsPage();
});

function changeLogType(){
	if($('#btnADLogType').hasClass('remove')){
		MessengerUtil.send('set_configuration', {
				identifier: {log_type: '1'}
			});
		//altero o texto do botão
		$('#btnADLogType').removeClass('remove').addClass('ok').find('label').html("Register Status Active");
	}
	else{
		MessengerUtil.send('set_configuration', {
				identifier: {log_type: '0'}
		});
		$('#btnADLogType').removeClass('ok').addClass('remove').find('label').html("Register Status Active");
	}
}

function changeBeep(){
	if($('#btnADBeep').find('label').html().search("Active") == -1){
		MessengerUtil.send('set_configuration', {
				general: {beep_enabled: '1'}
			});
		$('#btnADBeep').removeClass('mute').addClass('volume_up').find('label').html("Beep Ativo");
	}
	else{
		MessengerUtil.send('set_configuration', {
			general: {beep_enabled: '0'}
		});
		$('#btnADBeep').removeClass('volume_up').addClass('mute').find('label').html("Beep Inactive");
	}
}

function changeIdentificationMode(){
	var warning_modal = new Modal();
	warning_modal.setTitle('Identification');
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else if (Main.isHID() && !Main.iDBlockNext_mode()) {
		openIdentificationModeModal();
	} else {
		if($('#btnAD1to1').hasClass('nameplate')){
			MessengerUtil.send('set_configuration', {
				identifier: {multi_factor_authentication: '1'}
			});
			$('#btnAD1to1').removeClass('nameplate').addClass('nameplate_alt').find('label').html("Identificação 1:1");
		} else{
			MessengerUtil.send('set_configuration', {
				identifier: {multi_factor_authentication: '0'}
			});
			$('#btnAD1to1').removeClass('nameplate_alt').addClass('nameplate').find('label').html("Identificação 1:N");
		}
	}
}

function openInterlockDoorModal() {
	var md = new Modal();
	md.setTitle('Door Interlock Configuration')

	md.setHTMLContent($('#modal_doorInterlock'));
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show(function(){
		var confs = MessengerUtil.send('get_configuration',
			{ general: [ 'door1_interlock', 'door2_interlock', 'door3_interlock', 'door4_interlock']}
		)

		resetInterlockConfigs()

		var doorInterlockConfig = [
			confs.general.door1_interlock,
			confs.general.door2_interlock,
			confs.general.door3_interlock,
			confs.general.door4_interlock
		]

		for(var i = 0; i < doorInterlockConfig.length; i++){
			if(doorInterlockConfig[i] != ""){
				var doors = doorInterlockConfig[i].split(",")
				for(var j = 0; j < doors.length; j++){
					setInterlockConfig(i+1, doors[j])
				}
			}
		}
	});

	function save(returnMessage){
		saveDoorInterlockConfig(1)
		saveDoorInterlockConfig(2)
		saveDoorInterlockConfig(3)
		saveDoorInterlockConfig(4)

		MessengerUtil.send('set_configuration',
			{
				'general': {
					'door1_interlock' : door1_interlock,
					'door2_interlock' : door2_interlock,
					'door3_interlock' : door3_interlock,
					'door4_interlock' : door4_interlock
				}
			}
		)
		returnMessage(null);
	}
}

function saveDoorInterlockConfig(doorId){
	var selectedDoors = ""
	$('.portal' + doorId + '.active').each(function(index, element){
		selectedDoors += (element.value)
	})
	//Remove elementos repetidos
	selectedDoors = selectedDoors.slice(0, selectedDoors.length/2)

	newInterlockedDoors = ""
	for(var i = 0; i < selectedDoors.length; i++){
		if(newInterlockedDoors != ""){
			newInterlockedDoors += ","
		}
		newInterlockedDoors += selectedDoors[i]
	}
	switch(doorId){
		case 1:
			door1_interlock = newInterlockedDoors;
			break;
		case 2:
			door2_interlock = newInterlockedDoors;
			break;
		case 3:
			door3_interlock = newInterlockedDoors;
			break;
		case 4:
			door4_interlock = newInterlockedDoors;
			break;
	}
}

function toggleInterlockConfig(doorId, interlockConfig) {
	if($('.portal'+doorId+'[value='+interlockConfig+']').hasClass("active")==true){
		$('.portal'+doorId+'[value='+interlockConfig+']').removeClass("active")
	}else{
		$('.portal'+doorId+'[value='+interlockConfig+']').addClass("active")
	}
}

function setInterlockConfig(doorId, interlockConfig) {
	$('.portal'+doorId+'[value='+interlockConfig+']').addClass("active")
}

function resetInterlockConfigs() {
	for(var door = 1; door <= 4; door++){
		$('.portal'+door).removeClass("active")
	}
}

function openSimilarityThresholdModal() {
	var md = new Modal();
	md.setTitle('Fingerprint Threshold Setup');
	md.setHTMLContent($('#modal_similarityThreshold'));
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	var isAuto = true;

	md.show(function() {

		var data = MessengerUtil.send(
			'get_configuration',
			{
				'bio_id': ['similarity_threshold_1ton']
			}
		);

		var thresholdValue = data.bio_id.similarity_threshold_1ton;
		isAuto = (thresholdValue === '0');
		md.getContent().find('#chkButtonThreshold').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonThreshold').parent().bootstrapSwitch('setState', isAuto);
		md.getContent().find('#chkButtonThreshold').parent().parent().on('switch-change', function (e, data) {
			isAuto = !isAuto;
			verifyShow();
		});
		verifyShow();
		function verifyShow() {
			if (!md.getContent().find('#chkButtonThreshold').parent().bootstrapSwitch('status')) {
				if(thresholdValue != '0')
					md.getContent().find('#inputSimilarityThresHold')[0].value = thresholdValue;
				md.getContent().find('#defineThreshold').show('slow');
			} else {
				md.getContent().find('#defineThreshold').hide('slow');
			}
		}
	});

	function save(returnMessage) {
		var value;
		if (!isAuto)
			value = md.getContent().find('#inputSimilarityThresHold')[0].value;
		else
			value = "0";
		if (value) {
			console.log("value: " + value);
			MessengerUtil.send('set_configuration',
				{
					'bio_id': { 'similarity_threshold_1ton': value }
				}
			);
			returnMessage(true);
		}
		else {
			var data = { error : "Invalid Input!"};
			returnMessage(data);
		}
	}

}

function openTimeoutModal() {
	var md = new Modal();
	md.setTitle('Timing configuration iDBlock');
	md.setHTMLContent($('#modal_timeoutEdit'));
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	var isAuto = true;

	md.show(function() {

		var data = MessengerUtil.send(
			'get_configuration',
			{
				'general': ['catra_timeout'],
				'catra': ['relay_timeout']
			}
		);

		var relay_timeout = data.catra.relay_timeout;
		var catra_timeout = data.general.catra_timeout;

		md.getContent().find('#inputRelayTimeout')[0].value = relay_timeout;
		md.getContent().find('#inputCatraTimeout')[0].value = catra_timeout;
	});

	function save(returnMessage) {
		var relay_timeout = md.getContent().find('#inputRelayTimeout')[0].value;
		var catra_timeout = md.getContent().find('#inputCatraTimeout')[0].value;

		if (relay_timeout && catra_timeout) {
			MessengerUtil.send('set_configuration',
				{
					'general': {'catra_timeout': catra_timeout},
					'catra': {'relay_timeout': relay_timeout}
				}
			);
			returnMessage(true);
		}
		else {
			var data = { error : "Provide a valid value!"};
			returnMessage(data);
		}
	}
}

function twoPassEquals(pass1, pass2){
	if(pass1 === pass2)
		return true;
	return false;
}

function openChangeUsrPassModal(){
	var md = new Modal();
	md.setTitle('Change Web Password');
	md.setHTMLContent($('#modal_changePasswd'));
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show();

	function save(returnMessage){
		var data;
		if(twoPassEquals(md.getContent().find("#input_web_passwd1").val(), md.getContent().find("#input_web_passwd2").val())) {
			data = MessengerUtil.send('change_login', {
				login: md.getContent().find('#input_usr').val(),
				password: md.getContent().find('#input_web_passwd1').val()
			});
		}
		else{
			data = "Provided passwords do not match!";
		}
		returnMessage(data);
	}
}

var modal_facialConfigurations = $('#modal_facialConfigurations').clone().end().remove();
function openFacialConfigurationsModal(){
	var md = new Modal();
	var max_facial_biometrics;
	var initial_mask_detection_enabled;
	var initial_keep_user_image;
	var initial_zoom;
	var initial_vertical_crop;
	md.setTitle('Facial Settings');
	md.setHTMLContent(modal_facialConfigurations);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);
	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function() {
			var data = MessengerUtil.send(
				'get_configuration',
				{
					general: [ 'keep_user_image' ],
					enroller: [ 'face_enroll_mode' ],
					face_id: [
						'min_detect_bounds_width',
						'liveness_mode',
						'max_identified_duration',
						'vehicle_mode',
						'limit_identification_to_display_region'
					],
					led_white: ['brightness'],
					face_module: ['light_threshold_led_activation'],
					camera_overlay: [
						'zoom',
						'vertical_crop'
					],
					monitor: ['enable_photo_upload']
				}
			)
			var data_system = MessengerUtil.send('system_information', null, null, false);
			max_facial_biometrics = parseInt(data_system.biometrics.max_num_records);

			md.getContent().find('#inputIdentificationDistance')[0].value = Math.round(11.6/data.face_id.min_detect_bounds_width);
			md.getContent().find('#inputLedsBrightness')[0].value = data.led_white.brightness;
			md.getContent().find('#inputMaxIdentifiedDuration')[0].value = Math.round(data.face_id.max_identified_duration/1000);
			md.getContent().find('#chkLivenessMode').parent().bootstrapSwitch();
			md.getContent().find('#chkLivenessMode').parent().bootstrapSwitch('setState', data.face_id.liveness_mode === "0");
			md.getContent().find('#chkFaceEnrollMode').parent().bootstrapSwitch();
			md.getContent().find('#chkFaceEnrollMode').parent().bootstrapSwitch('setState', data.enroller.face_enroll_mode === "0");
			md.getContent().find('#chkVehicleMode').parent().bootstrapSwitch();
			md.getContent().find('#chkVehicleMode').parent().bootstrapSwitch('setState', data.face_id.vehicle_mode === "0");
			md.getContent().find('#identificationRegion').parent().bootstrapSwitch();
			md.getContent().find('#identificationRegion').parent().bootstrapSwitch('setState', data.face_id.limit_identification_to_display_region === "1");
			md.getContent().find('#chkMonitorPhoto').parent().bootstrapSwitch();
			md.getContent().find('#chkMonitorPhoto').parent().bootstrapSwitch('setState', data.monitor.enable_photo_upload === '1');
			md.getContent().find('#zoom_camera_facial')[0].value = parseFloat(4*(data.camera_overlay.zoom-1)+1);
			md.getContent().find('#var_zoom_camera_facial')[0].value = md.getContent().find('#zoom_camera_facial')[0].value;
			md.getContent().find('#vertical_crop')[0].value = parseInt(data.camera_overlay.vertical_crop * 100);
			md.getContent().find('#var_vertical_crop')[0].value = md.getContent().find('#vertical_crop')[0].value;
			setZoom(md.getContent().find('#var_zoom_camera_facial')[0].value);

			initial_zoom = md.getContent().find('#zoom_camera_facial')[0].value;
			initial_vertical_crop = md.getContent().find('#vertical_crop')[0].value;

			if (max_facial_biometrics < 20000) {
				// Pro 20k+ not enabled!
				md.getContent().find("#chkKeepUserImage").parent().bootstrapSwitch();
				md.getContent().find("#chkKeepUserImage").parent().bootstrapSwitch('setState', data.general.keep_user_image === '1');
			} else {
				// Pro 20k+ enabled!
				md.getContent().find("#chkKeepUserImage").parent().bootstrapSwitch();
				md.getContent().find("#chkKeepUserImage").parent().bootstrapSwitch('setState', false);
				md.getContent().find("#chkKeepUserImage").parent().parent().on('switch-change', function() {
					md.getContent().find("#chkKeepUserImage").parent().bootstrapSwitch('setState', false);
				});
				initial_keep_user_image = data.general.keep_user_image;
			}

			if (data.face_module.light_threshold_led_activation == "55") {
				md.getContent().find('#threshold-low').attr('checked','checked');
			}
			else if (data.face_module.light_threshold_led_activation == "280") {
				md.getContent().find('#threshold-medium').attr('checked','checked');
			}
			else if (data.face_module.light_threshold_led_activation == "1500") {
				md.getContent().find('#threshold-high').attr('checked','checked');
			}
			else if (data.face_module.light_threshold_led_activation == "1000000") {
				md.getContent().find('#threshold-always').attr('checked','checked');
			}

			md.getContent().find("#var_zoom_camera_facial").parent().on('change', function () {
				setZoom(md.getContent().find("#var_zoom_camera_facial")[0].value);
			});
		});
	}

	function saveInterestRegion() {
		var zoom = 1 + (md.getContent().find("#var_zoom_camera_facial")[0].value - 1) * 0.25;
		var verticalCrop = md.getContent().find("#var_vertical_crop")[0].value / 100.0;
		var data = MessengerUtil.send(
			'set_configuration',
			{
				camera_overlay: {
					zoom: zoom.toString(),
					vertical_crop: verticalCrop.toString()
				}
			}
		)
		return data;
	}

	function save(returnMessage) {
		var inputDistance = parseInt(md.getContent().find('#inputIdentificationDistance')[0].value);
		var min_detect_bounds_width = (11.6/inputDistance).toString();
		var brightness = md.getContent().find('#inputLedsBrightness')[0].value;
		var maxIdentifiedDuration = (1000*parseInt(md.getContent().find('#inputMaxIdentifiedDuration')[0].value)).toString();
		var liveness_mode = md.getContent().find('#chkLivenessMode').parent().hasClass('switch-on') ? '0' : '1';
		var face_enroll_mode = md.getContent().find('#chkFaceEnrollMode').parent().hasClass('switch-on') ? '0' : '1';
		var vehicle_mode = md.getContent().find('#chkVehicleMode').parent().hasClass('switch-on') ? '0' : '1';
		var limitIdentificationToDisplayRegion =	md.getContent().find("#identificationRegion").is(':checked') ? '1' : '0';
		var enable_photo_upload = md.getContent().find("#chkMonitorPhoto").is(':checked') ? '1' : '0';

		var keep_user_image;
		if (max_facial_biometrics < 20000) {
			// Pro 20k+ not enabled!
			keep_user_image = md.getContent().find("#chkKeepUserImage").is(':checked') ? '1' : '0';
		} else {
			// Pro 20k+ enabled!
			// We must keep the current configuration
			keep_user_image = initial_keep_user_image;
		}

		var threshold_leds = "55";
		if (md.getContent().find('#threshold-low').is(':checked')) {
			threshold_leds = "55";
		} else if (md.getContent().find('#threshold-medium').is(':checked')) {
			threshold_leds = "280";
		} else if (md.getContent().find('#threshold-high').is(':checked')) {
			threshold_leds = "1500";
		} else if (md.getContent().find('#threshold-always').is(':checked')) {
			threshold_leds = "1000000";
		}

		if (inputDistance < 30 || inputDistance > 250) {
			return returnMessage("Identification distance should be between 30 cm and 250 cm");
		}
		if (parseInt(brightness) < 0 || parseInt(brightness) > 100) {
			return returnMessage("LEDs brightness should be between 0 and 100");
		}
		if (liveness_mode === '1' && vehicle_mode === '1') {
			return returnMessage("Vehicle detection mode is only available for Normal liveness mode");
		}

		var data = MessengerUtil.send(
			'set_configuration',
			{
				general: {
					keep_user_image: keep_user_image
				},
				face_id: {
					min_detect_bounds_width: min_detect_bounds_width,
					liveness_mode: liveness_mode,
					max_identified_duration: maxIdentifiedDuration,
					vehicle_mode: vehicle_mode,
					limit_identification_to_display_region: limitIdentificationToDisplayRegion
				},
				led_white: {
					brightness: brightness
				},
				face_module: {
					light_threshold_led_activation: threshold_leds
				},
				enroller: {
					face_enroll_mode: face_enroll_mode
				},
				monitor: {
					enable_photo_upload: enable_photo_upload
				}
			}
		)

		var new_zoom = md.getContent().find('#zoom_camera_facial')[0].value;
		var new_vertical_crop = md.getContent().find('#vertical_crop')[0].value;
		if (new_zoom != initial_zoom || new_vertical_crop != initial_vertical_crop) {
			var ret = saveInterestRegion();
			if (ret.error != undefined) {
				if (data.error) {
					data.error += "<br/>" + ret.error;
				}
				else {
					data.error = ret.error;
				}
			}
		}

		return returnMessage(data.error != undefined ? data.error : null);
	}

	const maxZoomCrop = [
		[1.00, 0.05],
		[1.25, 0.11],
		[1.50, 0.16],
		[1.75, 0.20],
		[2.00, 0.23],
		[2.25, 0.25],
		[2.50, 0.28],
		[2.75, 0.29],
		[3.00, 0.30],
		[3.25, 0.32],
		[1000, 0.32]
	];

	function setZoom(zoom) {
		let maxCrop = 0.0;

		for (let i=0; i<maxZoomCrop.length; i++) {
			if (maxZoomCrop[i][0] >= ((zoom - 1) * 0.25 + 1)) {
				maxCrop = maxZoomCrop[i][1];
				break;
			}
		}

		md.getContent().find('#vertical_crop').attr('min', parseInt(-maxCrop*100));
		md.getContent().find('#vertical_crop').attr('max', parseInt(maxCrop*100));

		if (md.getContent().find("#var_vertical_crop")[0].value > maxCrop*100) {
			md.getContent().find("#var_vertical_crop")[0].value = parseInt(maxCrop*100);
		}
		if (md.getContent().find("#var_vertical_crop")[0].value < -maxCrop*100) {
			md.getContent().find("#var_vertical_crop")[0].value = parseInt(-maxCrop*100);
		}
	}
}

function toggleVisibilityPasswordSIP() {
	var eyeIcon = document.getElementById("password_SIP-eye");
	var passwordInput = document.getElementById("password_SIP");

	if (passwordInput.type === "password") {
		passwordInput.type = "text";
		eyeIcon.classList.remove("icon-eye-open");
		eyeIcon.classList.add("icon-eye-close");
	} else {
		passwordInput.type = "password";
		eyeIcon.classList.remove("icon-eye-close");
		eyeIcon.classList.add("icon-eye-open");
	}
}

function toggleVisibilityPasswordDTMF() {
	var eyeIcon = document.getElementById("password_DTMF-eye");
	var passwordInput = document.getElementById("password_DTMF");

	if (passwordInput.type === "password") {
		passwordInput.type = "text";
		eyeIcon.classList.remove("icon-eye-open");
		eyeIcon.classList.add("icon-eye-close");
	} else {
		passwordInput.type = "password";
		eyeIcon.classList.remove("icon-eye-close");
		eyeIcon.classList.add("icon-eye-open");
	}
}

function MakeSIPCall(target) {
	var response = MessengerUtil.send(
		'make_sip_call',
		{
			target: target
		}
	)
	if (response.error !== undefined ) {
		if (response.error.indexOf("ontain digits") !== -1 || response.error.indexOf("ield is empty") !== -1) {
			window.alert("Invalid dialling number (must contain only digits, +, * or #)");
		}
		else {
			if (response.error.indexOf("ontain an ip") !== -1) {
				window.alert("Invalid dialing number (must contain an ip address)");
			}
			else {
				window.alert(response.error);
			}
		}
	}
}

function FinalizeSIPCall() {
	var response = MessengerUtil.send(
		'finalize_sip_call',
		{

		}
	)
	if (response.error !== undefined) {
		window.alert("There was an error trying to hang up the call");
	}
}

async function downloadPjsipAudioFile()
{
	var fileName = 'custom_pjsip_call_audio.wav';
	var data = await receiveAsBinaryData('get_pjsip_audio_message');

	saveAudioAsFile(fileName, data.result);
}

var modal_SIPEdit = $('#modal_SIPEdit').clone().end().remove();
function openSIPConfigurationsModal() {
	var md = new Modal();
	md.setTitle('Intercom Settings');
	md.setHTMLContent(modal_SIPEdit);
	md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel'
		}
	]);

	function getByteArray(dataStr) {
		var array = new Uint8Array(dataStr.length);
		for (var i = 0; i < dataStr.length; i++) {
			array[i] = dataStr.charCodeAt(i);
		}
		return array;
	}

	function sendPjsipAudio(audio) {
		var array = getByteArray(audio);
		var isWAV = array[0] === 82 && array[1] === 73 && array[2] === 70 && array[3] === 70 &&
			array[8] === 87 && array[9] === 65 && array[10] === 86 && array[11] === 69;
		if (!isWAV) {
			return false;
		}

		MessengerUtil.sendFile('set_pjsip_audio_message', array);
		return true;
	}

	function hasCustomPjsipAudio() {
		var data = MessengerUtil.send('has_pjsip_audio_message');
		return data.file_exists;
	}

	function onOpModeChanges(p2pEnabled) {
		if (p2pEnabled) {
			md.getContent().find('#server_ip_SIP').prop("disabled", true);
			md.getContent().find('#branch_SIP').prop("disabled", true);
			md.getContent().find('#login_SIP').prop("disabled", true);
			md.getContent().find('#password_SIP').prop("disabled", true);
		} else {
			md.getContent().find('#server_ip_SIP').prop("disabled", false);
			md.getContent().find('#branch_SIP').prop("disabled", false);
			md.getContent().find('#login_SIP').prop("disabled", false);
			md.getContent().find('#password_SIP').prop("disabled", false);
		}
	}

	async function askReboot() {
		var response = false;
		await new Promise(function (resolve, reject) {
			var warning = new Modal();
			warning.setTitle('Reboot is needed');
			warning.setContent('It is necessary to restart the device after applying the configurations. Do you want to proceed?');
			warning.addButton([
				{
					'type': 'ok',
					'callback': function () {
						response = true;
						warning.close();
						resolve();
					}
				},
				{
					'type': 'cancel',
					'callback': function () {
						response = false;
						warning.close();
						resolve();
					}
				}
			]);
			warning.show();
		});
		return response;
	}

	if (hasCustomPjsipAudio()) {
		md.getContent().find('#btn_download_audio_psjip').show();
	}

	var warning_modal = new Modal();
	warning_modal.setTitle('Intercom Settings');
	warning_modal.setContent('Feature available only for devices in PRO mode');
	warning_modal.addButton([
		{
			'type': 'ok'
		}
	]);
	md.show(function () {
		var data = MessengerUtil.send(
			'get_configuration',
			{
				pjsip: ['enabled', 'server_ip', 'server_port', 'branch', 'login', 'password', 'peer_to_peer_enabled',
					'auto_answer_enabled', 'auto_answer_delay', 'auto_call_target', 'server_reg_timeout',
					'server_retry_interval', 'mic_volume', 'speaker_volume', 'max_call_time', 'reg_status_query_period',
					'pjsip_custom_audio_enabled', 'open_door_enabled','open_door_wiegand_code','open_door_wiegand_code_en', 'open_door_command', 'server_outbound_port',
					'server_outbound_port_range', 'rex_enabled', 'custom_audio_volume_gain', 'auto_call_button_enabled',
					'custom_identifier_auto_call', 'dialing_display_mode', 'numeric_branch_enabled', 'facial_id_during_call_enabled',
					'custom_phone_icon', 'video_enabled', 'protocol', 'auto_call_with_unknow_user_enabled', 'unknow_user_auto_call_in'
				]
			}
		)
		md.getContent().find('#enabled_SIP').parent().bootstrapSwitch();
		md.getContent().find('#enabled_SIP').parent().bootstrapSwitch('setState', data.pjsip.enabled === "1");
		md.getContent().find('#operation_mode_SIP').parent().bootstrapSwitch();
		md.getContent().find('#operation_mode_SIP').parent().bootstrapSwitch('setState', data.pjsip.peer_to_peer_enabled === "1");
		md.getContent().find('#server_ip_SIP')[0].value = data.pjsip.server_ip;
		md.getContent().find('#server_port_SIP')[0].value = data.pjsip.server_port;
		md.getContent().find('#numeric_branch_enabled_SIP').parent().bootstrapSwitch();
		md.getContent().find('#numeric_branch_enabled_SIP').parent().bootstrapSwitch('setState', data.pjsip.numeric_branch_enabled === "1");
		md.getContent().find('#branch_SIP')[0].value = data.pjsip.branch;
		md.getContent().find('#login_SIP')[0].value = data.pjsip.login;
		md.getContent().find('#password_SIP')[0].value = data.pjsip.password;
		md.getContent().find('#outbound_server_port_SIP')[0].value = data.pjsip.server_outbound_port;
		md.getContent().find('#final_outbound_server_port_SIP')[0].value = (parseInt(data.pjsip.server_outbound_port_range) + parseInt(data.pjsip.server_outbound_port));
		md.getContent().find('#protocol_SIP').parent().bootstrapSwitch();
		md.getContent().find('#protocol_SIP').parent().bootstrapSwitch('setState', data.pjsip.protocol === "udp");

		md.getContent().find('#auto_answer_enabled_SIP').parent().bootstrapSwitch();
		md.getContent().find('#auto_answer_enabled_SIP').parent().bootstrapSwitch('setState', data.pjsip.auto_answer_enabled === "1");
		md.getContent().find('#auto_answer_delay_SIP')[0].value = data.pjsip.auto_answer_delay;
		md.getContent().find('#rex_enabled_SIP').parent().bootstrapSwitch();
		md.getContent().find('#rex_enabled_SIP').parent().bootstrapSwitch('setState', data.pjsip.rex_enabled === "1");
		md.getContent().find('#auto_call_target_SIP')[0].value = data.pjsip.auto_call_target;
		md.getContent().find('#auto_call_label_name')[0].value = data.pjsip.custom_identifier_auto_call;
		md.getContent().find('#auto_call_button_enabled_SIP').parent().bootstrapSwitch();
		md.getContent().find('#auto_call_button_enabled_SIP').parent().bootstrapSwitch('setState', data.pjsip.auto_call_button_enabled === "1");
		md.getContent().find('#check_facial_id_during_call').parent().bootstrapSwitch();
		md.getContent().find('#check_facial_id_during_call').parent().bootstrapSwitch('setState', data.pjsip.facial_id_during_call_enabled === "1");

		md.getContent().find('#enabled_custom_icon').parent().bootstrapSwitch();
		md.getContent().find('#enabled_custom_icon').parent().bootstrapSwitch('setState', data.pjsip.custom_phone_icon === "1");
		md.getContent().find('#video_enabled').parent().bootstrapSwitch();
		md.getContent().find('#video_enabled').parent().bootstrapSwitch('setState', data.pjsip.video_enabled === "1");

		/* Inicia o canvas para upload da imagem */
		canvas_sip = document.querySelector('#canvas_sip');
		ctx_sip = canvas_sip.getContext('2d');
		// Desenha caso tenha imagem

		var image = new Image;
		image.onload = function () {
			canvas_sip.width = image.width;
			canvas_sip.height = image.height;
			ctx_sip.drawImage(image, 0, 0, image.width, image.height);
			var img_sip = canvas_sip.toDataURL("image/png", 0.5);
			GeraBytesFotosSip(img_sip);
		}
		image.onerror = function () {
			canvas_sip.height = 100;
			canvas_sip.width = 200;
			ctx_sip.font = "20px Georgia";
			ctx_sip.fillText("No image", 50, 70);
		}
		image.src = '/get_phone_icon.fcgi' + `?_=${new Date().getTime()}`;
		var has_custom_audio = hasCustomPjsipAudio();
		if (has_custom_audio) {
			md.getContent().find('#label_no_file_uploaded').hide();
			md.getContent().find('#label_update_file').show();
		} else {
			md.getContent().find('#label_no_file_uploaded').show();
			md.getContent().find('#label_update_file').hide();
		}

		if (data.pjsip.dialing_display_mode == "0") {
			md.getContent().find('#automatic_dial').attr('checked', 'checked');
		}
		else if (data.pjsip.dialing_display_mode == "1") {
			md.getContent().find('#dial_from_contacts').attr('checked', 'checked');
		}
		else if (data.pjsip.dialing_display_mode == "2") {
			md.getContent().find('#dial_from_contacts_numbers').attr('checked', 'checked');
		}

		md.getContent().find('#check_custom_audio_SIP').parent().bootstrapSwitch();
		if (data.pjsip.pjsip_custom_audio_enabled === "1") {
			md.getContent().find('#check_custom_audio_SIP').parent().bootstrapSwitch('setState', true);
			md.getContent().find('#uploadSIPcustomAudio').show();
		} else {
			md.getContent().find('#check_custom_audio_SIP').parent().bootstrapSwitch('setState', false);
			md.getContent().find('#uploadSIPcustomAudio').hide();
		}
		md.getContent().find('#check_custom_audio_SIP').change(function () {
			if (md.getContent().find('#check_custom_audio_SIP').is(':checked')) {
				md.getContent().find('#uploadSIPcustomAudio').show();
			} else {
				md.getContent().find('#uploadSIPcustomAudio').hide();
			}
		});

		md.getContent().find('#register_time')[0].value = data.pjsip.reg_status_query_period;
		md.getContent().find('#keepAlive')[0].value = data.pjsip.server_retry_interval;
		md.getContent().find('#maxCalltime')[0].value = data.pjsip.max_call_time;

		md.getContent().find('#enabled_DTMF').parent().bootstrapSwitch();
		md.getContent().find('#enabled_DTMF').parent().bootstrapSwitch('setState', data.pjsip.open_door_enabled === "1");
		md.getContent().find('#password_DTMF')[0].value = data.pjsip.open_door_command;

		md.getContent().find('#enabled_wiegand_code').parent().bootstrapSwitch();
		md.getContent().find('#enabled_wiegand_code').parent().bootstrapSwitch('setState', data.pjsip.open_door_wiegand_code_en === "1");
		md.getContent().find('#wiegand_code')[0].value = data.pjsip.open_door_wiegand_code;

		md.getContent().find('#enable_auto_call_with_unknow').parent().bootstrapSwitch();
		md.getContent().find('#enable_auto_call_with_unknow').parent().bootstrapSwitch('setState', data.pjsip.auto_call_with_unknow_user_enabled === "1");

		md.getContent().find('#unknow_user_auto_call_time')[0].value = data.pjsip.unknow_user_auto_call_in;

		md.getContent().find('#mic_volume_SIP')[0].value = data.pjsip.mic_volume;
		md.getContent().find('#var_mic_volume_SIP')[0].value = data.pjsip.mic_volume;
		md.getContent().find('#speaker_volume_SIP')[0].value = data.pjsip.speaker_volume;
		md.getContent().find('#var_speaker_volume_SIP')[0].value = data.pjsip.speaker_volume;

		md.getContent().find('#call_target_test_SIP')[0].value = data.pjsip.auto_call_target;

		switch (data.pjsip.custom_audio_volume_gain) {
			case "1":
				md.getContent().find('#pjsip_volume_gain_normal').attr('checked', 'checked');
				break;
			case "2":
				md.getContent().find('#pjsip_volume_gain_medium').attr('checked', 'checked');
				break;
			case "3":
				md.getContent().find('#pjsip_volume_gain_high').attr('checked', 'checked');
				break;
		}

		md.getContent().find("#rex_enabled_SIP").parent().parent().on('switch-change', function (e, data) {
			if (!data.value) {
				md.getContent().find('#auto_call_button_enabled_SIP').parent().bootstrapSwitch('setState', true);
			}
		});

		md.getContent().find("#auto_call_button_enabled_SIP").parent().parent().on('switch-change', function (e, data) {
			if (!data.value) {
				md.getContent().find('#rex_enabled_SIP').parent().bootstrapSwitch('setState', true);
			}
		});

		onOpModeChanges(md.getContent().find('#operation_mode_SIP').parent().hasClass('switch-on'));
		md.getContent().find("#operation_mode_SIP").parent().parent().on('switch-change', function (e, data) {
			onOpModeChanges(data.value);
		});
		new Validate($(md.getContent()), validateInputs);

		setTimeout(function refreshSIPStatus() {
			var response = MessengerUtil.send(
				'get_sip_status',
				{}
			)

			if (!(document.getElementById("get_sip_status_bar") && document.getElementById("get_sip_status_label"))) {
				return;
			}

			document.getElementById("get_sip_status_bar").classList.remove("grey", "blue", "red", "green");

			if (response.error !== undefined) {
				document.getElementById("get_sip_status_bar").classList.add("grey");
				document.getElementById("get_sip_status_label").textContent = "Unable to get SIP status";
				setTimeout(refreshSIPStatus, 5000);
				return;
			}
			if (response.in_call) {
				document.getElementById("get_sip_status_bar").classList.add("blue");
				document.getElementById("get_sip_status_label").textContent = "There is a call in progress";
			} else {
				switch (response.status) {
					case 0:
						document.getElementById("get_sip_status_bar").classList.add("grey");
						document.getElementById("get_sip_status_label").textContent = "Unable to get SIP status";
						break;
					case 100:
						document.getElementById("get_sip_status_bar").classList.add("blue");
						document.getElementById("get_sip_status_label").textContent = "Trying to connect...";
						break;
					case 200:
						document.getElementById("get_sip_status_bar").classList.add("green");
						document.getElementById("get_sip_status_label").textContent = "Connected";
						break;
					case 401:
					case 403:
						document.getElementById("get_sip_status_bar").classList.add("red");
						document.getElementById("get_sip_status_label").textContent = "Authentication failed. Check extension, username, and password";
						break;
					case 408:
						document.getElementById("get_sip_status_bar").classList.add("red");
						document.getElementById("get_sip_status_label").textContent = "Failed to connect to server. Check the IP address and port";
						break;
					case 503:
						document.getElementById("get_sip_status_bar").classList.add("red");
						document.getElementById("get_sip_status_label").textContent = "Network connection failure. Check your connection status";
						break;
					default:
						document.getElementById("get_sip_status_bar").classList.add("red");
						document.getElementById("get_sip_status_label").textContent = "Connection failed. Status: " + response.status;
						break;
				}
			}
			setTimeout(refreshSIPStatus, 1000);
		}, 0);
	});

	async function save(returnMessage) {
		var enabled = md.getContent().find('#enabled_SIP').parent().hasClass('switch-on') ? '1' : '0';
		var p2p_enabled = md.getContent().find('#operation_mode_SIP').parent().hasClass('switch-on') ? '1' : '0';
		var server_ip = md.getContent().find('#server_ip_SIP')[0].value;
		var server_port = md.getContent().find('#server_port_SIP')[0].value;
		var numeric_branch_enabled = md.getContent().find('#numeric_branch_enabled_SIP').parent().hasClass('switch-on') ? '1' : '0';
		var branch = md.getContent().find('#branch_SIP')[0].value;
		var login = md.getContent().find('#login_SIP')[0].value;
		var password = md.getContent().find('#password_SIP')[0].value;
		var outbound_server_port = md.getContent().find('#outbound_server_port_SIP')[0].value;
		var final_outboud_server_port = md.getContent().find('#final_outbound_server_port_SIP')[0].value;

		var auto_answer_enabled = md.getContent().find('#auto_answer_enabled_SIP').parent().hasClass('switch-on') ? '1' : '0';
		var auto_answer_delay = md.getContent().find('#auto_answer_delay_SIP')[0].value;
		var auto_call_target = md.getContent().find('#auto_call_target_SIP')[0].value;
		var custom_audio_enabled = md.getContent().find('#check_custom_audio_SIP').parent().hasClass('switch-on') ? '1' : '0';
		var auto_call_button_enabled_sip = md.getContent().find('#auto_call_button_enabled_SIP').parent().hasClass('switch-on') ? '1' : '0';
		var custom_identifier_auto_call = md.getContent().find('#auto_call_label_name')[0].value;
		var rex_enabled = md.getContent().find('#rex_enabled_SIP').parent().hasClass('switch-on') ? '1' : '0';
		var facial_id_during_call_enabled = md.getContent().find('#check_facial_id_during_call').parent().hasClass('switch-on') ? '1' : '0';
		var video_enabled = md.getContent().find('#video_enabled').parent().hasClass('switch-on') ? '1' : '0';
		const protocol = md.getContent().find('#protocol_SIP').parent().hasClass('switch-on') ? 'udp' : 'tcp';

		var reboot = await askReboot();
		if ($('#inputSIPCustomAudio')[0].files.length > 0) {
			if (!reboot) {
				return returnMessage("Configuration cancelled");
			}

			var file = $('#inputSIPCustomAudio')[0].files[0];
			var result = await uploadFileByChunks('set_pjsip_audio_message', file);
			if (result.error) {
				return returnMessage(result.error);
			}
		}
		if (custom_audio_enabled == '1') {
			var has_custom_audio = hasCustomPjsipAudio();
			if (!has_custom_audio) {
				return returnMessage('Choose a valid audio file');
			}
		}

		var openDoorEnabled = md.getContent().find('#enabled_DTMF').parent().hasClass('switch-on') ? '1' : '0';
		var open_door_pass = md.getContent().find('#password_DTMF')[0].value;

		var openDoorWiegandEnabled = md.getContent().find('#enabled_wiegand_code').parent().hasClass('switch-on') ? '1' : '0';
		var open_door_wiegand_code = md.getContent().find('#wiegand_code')[0].value;

		var autoCallWithUnknowUserEnabled = md.getContent().find('#enable_auto_call_with_unknow').parent().hasClass('switch-on') ? '1' : '0';
		var auto_call_time = md.getContent().find('#unknow_user_auto_call_time')[0].value;

		var custom_phone_icon = md.getContent().find('#enabled_custom_icon').parent().hasClass('switch-on') ? '1' : '0';
		var register_time = md.getContent().find('#register_time')[0].value;
		var keepAlive = md.getContent().find('#keepAlive')[0].value;
		var maxCalltime = md.getContent().find('#maxCalltime')[0].value;

		var mic_volume = md.getContent().find('#mic_volume_SIP')[0].value;
		var speaker_volume = md.getContent().find('#speaker_volume_SIP')[0].value;

		var dialing_mode = "0";
		if (md.getContent().find('#automatic_dial').is(':checked')) {
			dialing_mode = "0";
		} else if (md.getContent().find('#dial_from_contacts').is(':checked')) {
			dialing_mode = "1";
		} else if (md.getContent().find('#dial_from_contacts_numbers').is(':checked')) {
			dialing_mode = "2";
		}
		var custom_audio_volume_gain;
		if (md.getContent().find('#pjsip_volume_gain_normal').is(':checked')) {
			custom_audio_volume_gain = "1";
		} else if (md.getContent().find('#pjsip_volume_gain_medium').is(':checked')) {
			custom_audio_volume_gain = "2";
		} else if (md.getContent().find('#pjsip_volume_gain_high').is(':checked')) {
			custom_audio_volume_gain = "3";
		}

		var result = validateInputs({
			server_address: server_ip,
			port: server_port,
			branch: branch,
			login: login,
			password: password,
			num_delay: auto_answer_delay,
			num_target: auto_call_target,
			num_register: register_time,
			num_keep: keepAlive,
			num_calltime: maxCalltime,
			num_password_DTMF: open_door_pass,
			num_wiegand_code: open_door_wiegand_code,
			final_outbound_port: final_outboud_server_port,
			outbound_port: outbound_server_port,
			auto_call_time: auto_call_time
		});

		if (result.length) {
			returnMessage('Invalid input data<br>' + result);
			return;
		}

		var data = MessengerUtil.send(
			'set_configuration',
			{
				pjsip: {
					enabled: enabled,
					server_ip: server_ip,
					server_port: server_port,
					branch: branch,
					login: login,
					password: password,
					peer_to_peer_enabled: p2p_enabled,
					auto_answer_enabled: auto_answer_enabled,
					auto_answer_delay: auto_answer_delay,
					auto_call_target: auto_call_target,
					server_reg_timeout: register_time,
					server_retry_interval: keepAlive,
					mic_volume: mic_volume,
					speaker_volume: speaker_volume,
					max_call_time: maxCalltime,
					open_door_enabled: openDoorEnabled,
					open_door_wiegand_code_en: openDoorWiegandEnabled,
					open_door_wiegand_code: open_door_wiegand_code,
					open_door_command: open_door_pass,
					reg_status_query_period: register_time,
					pjsip_custom_audio_enabled: custom_audio_enabled,
					server_outbound_port: outbound_server_port,
					server_outbound_port_range: (final_outboud_server_port - outbound_server_port).toString(),
					custom_audio_volume_gain: custom_audio_volume_gain,
					auto_call_button_enabled: auto_call_button_enabled_sip,
					custom_identifier_auto_call: custom_identifier_auto_call,
					dialing_display_mode: dialing_mode,
					rex_enabled: rex_enabled,
					numeric_branch_enabled: numeric_branch_enabled,
					facial_id_during_call_enabled: facial_id_during_call_enabled,
					custom_phone_icon: custom_phone_icon,
					video_enabled: video_enabled,
					protocol: protocol,
					auto_call_with_unknow_user_enabled: autoCallWithUnknowUserEnabled,
					unknow_user_auto_call_in: auto_call_time
				}
			}
		)

		if (btFotoSip == null || btFotoSip.length == 1 && btFotoSip[0] == 1)
			MessengerUtil.send('remove_phone_icon');
		else
			MessengerUtil.sendFile('set_phone_icon', btFotoSip);

		if (reboot) {
			var rebootAlert = new Modal();
			rebootAlert.setTitle('Intercom Settings');
			rebootAlert.setContent('Rebooting device');
			rebootAlert.show();
			setTimeout(function () {
				var time = 60;
				MessengerUtil.sendAsync('reboot', null, null, false);
				Main.sessionFail({ error: 'customError' }, function () {
					setInterval(function () {
						time--;
						if (time == 0)
							window.location = 'login.html';
						$('#countReboot').html(('00' + time).slice(-2));
					}, 1000);

				}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
			}, 10000);
		}

		return returnMessage(data.error !== undefined ? data.error : null);
	}

	function validateInputs(data) {
		var result = [];
		var regex = new RegExp(/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/);
		if ('ip' in data) {
			if (!regex.test(data.ip) || data.ip.includes(' ')) {
				result.push('Please enter a valid value');
			}
		}

		if ('num_password_DTMF' in data) {
			for (let char of data.num_password_DTMF) {
				if (char.match(/[a-zA-Z]/i) || char === ' ') {
					result.push("Invalid dialling number (must contain only digits, +, * or #)")
				}
			}
		}

		if ('server_address' in data) {
			if (data.server_address.length === 0) {
				result.push('Please enter a valid value');
			}
		}

		if ('port' in data) {
			if (data.port.length === 0 || isNaN(data.port) || data.port.includes(' ') ||
				parseInt(data.port) <= 0 || parseInt(data.port) === 22 || parseInt(data.port) > 65535) {
				result.push('Please enter a valid value');
			}
			if (data.port.length !== 0) {
				var verifier = MessengerUtil.send(
					'check_port_availability',
					{
						initial_port: parseInt(data.port),
						final_port: parseInt(data.port)
					}
				);
				if (verifier.status && verifier.status != "OK" && verifier.status != "SIP") {
					result.push("Port already used: " + verifier.status);
				}
			}
		}

		if ('branch' in data) {
			if (data.branch.length === 0 || data.branch.includes(' ')) {
				result.push('Please enter a valid value');
			}
			if (md.getContent().find('#numeric_branch_enabled_SIP').is(':checked')) {
				if (isNaN(data.branch) || data.branch.includes(' ')) {
					result.push('Please enter a valid numeric value');
				}
			}
		}

		if ('login' in data) {
			if (data.login.length === 0) {
				result.push('Please enter a valid value');
			}
		}

		if ('password' in data) {
			if (data.password.length === 0) {
				result.push('Please enter a valid value');
			}
		}

		if ('num_delay' in data) {
			if (data.num_delay.includes(' ') ||
				data.num_delay.length === 0 || isNaN(data.num_delay) || parseInt(data.num_delay) < 0) {
				result.push('Please enter a valid value');
			}
		}

		if ('num_target' in data) {
			if (data.num_target.includes(' ') || data.num_target.length === 0) {
				result.push('Please enter a valid value');
			}
		}

		if ('num_register' in data) {
			if (data.num_register.includes(' ') ||
				data.num_register.length === 0 || isNaN(data.num_register) || parseInt(data.num_register) < 0) {
				result.push('Please enter a valid value');
			}
		}

		if ('num_keep' in data) {
			if (data.num_keep.includes(' ') ||
				data.num_keep.length === 0 || isNaN(data.num_keep) || parseInt(data.num_keep) < 0) {
				result.push('Please enter a valid value');
			}
		}

		if ('num_calltime' in data) {
			if (data.num_calltime.includes(' ') ||
				data.num_calltime.length === 0 || isNaN(data.num_calltime) || parseInt(data.num_calltime) < 0) {
				result.push('Please enter a valid value');
			}
		}

		if ('outbound_port' in data) {
			if (data.outbound_port.includes(' ') ||
				data.outbound_port.length === 0 || isNaN(data.outbound_port) ||
				parseInt(data.outbound_port) < 0 || parseInt(data.outbound_port) === 22 ||
				parseInt(data.outbound_port) > 65535) {
				result.push('Please enter a valid value');
			}
		}

		if ('final_outbound_port' in data) {
			if (data.final_outbound_port.includes(' ') ||
				data.final_outbound_port.length === 0 || isNaN(data.final_outbound_port) ||
				parseInt(data.final_outbound_port) === 22 || parseInt(data.final_outbound_port) > 65535) {
				result.push('Please enter a valid value');
			}
			if ('outbound_port' in data) {
				if (parseInt(data.final_outbound_port) < parseInt(data.outbound_port)) {
					result.push('Please enter a valid value');
				}
			}
		}

		if (('outbound_port' in data) && ('final_outbound_port' in data)) {
			if ((data.outbound_port.length != 0) && (data.final_outbound_port.length != 0) &&
				(parseInt(data.outbound_port) != 0) || (parseInt(data.final_outbound_port) != 0)) {
				var verifier = MessengerUtil.send(
					'check_port_availability',
					{
						initial_port: parseInt(data.outbound_port),
						final_port: parseInt(data.final_outbound_port)
					}
				);
				if (verifier.status && verifier.status != "OK" && verifier.status != "SIP Outbound") {
					result.push("Outbound port range already being used: " + verifier.status);
				}
			}
		}

		if ('auto_call_time' in data){
			if(data.auto_call_time.length === 0 || isNaN(data.auto_call_time) || parseInt(data.auto_call_time) <= 0){
				result.push("Please enter a valid value: " + verifier.status);
			}
		}

		return result;
	}
}

async function sendAsBinaryData(command, data, params, isPost) {
	var url = '/' + command + '.fcgi';
	var method = isPost === false ? 'GET' : 'POST';
	if(params != null)
		url += '?' + params;
	var dataOut = null;

	await new Promise(function(resolve, reject) {
		var xhr = new XMLHttpRequest();
		xhr.open(method, url, true);
		xhr.setRequestHeader("Content-Type", 'application/octet-stream');
		xhr.addEventListener('load', function() {
			dataOut = {
				status: xhr.status,
				result: this.response
			};
			resolve();
		});
		xhr.addEventListener('error', reject);
		xhr.send(data);
	});
	return dataOut;
}

async function receiveAsBinaryData(command, data, params, isPost) {
	var url = '/' + command + '.fcgi';
	var method = isPost === false ? 'GET' : 'POST';
	if(params != null)
		url += '?' + params;
	var dataOut = null;

	await new Promise(function(resolve, reject) {
		var xhr = new XMLHttpRequest();
		xhr.open(method, url, true);
		xhr.setRequestHeader("Content-Type", 'application/json');
		xhr.responseType = 'arraybuffer';
		xhr.addEventListener('load', function() {
			dataOut = {
				status: xhr.status,
				result: this.response
			};
			resolve();
		});
		xhr.addEventListener('error', reject);
		xhr.send(JSON.stringify(data));
	});
	return dataOut;
}

async function uploadFileByChunks(command, file, params) {
	var limit = 2097152;
	var start = 0;
	var current = 0;

	var total = Math.ceil(file.size / limit);

	while (start < file.size) {
		var end = Math.min(start + limit, file.size)
		const data = file.slice(start, end);
		current++;
		start = end

		const ret = await sendAsBinaryData(command, data, (params ? params + '&' : '') + 'current='+current+'&total='+total);
		const result = JSON.parse(ret.result);
		if (result.error) {
			return result;
		}
	}
	return {};
}

function saveAudioAsFile(file_name, dataToWrite)
{
	var audioFileAsBlob = new Blob([dataToWrite], {type: 'audio/x-wav'});

	var downloadLink = document.createElement("a");
	downloadLink.download = file_name;
	downloadLink.innerHTML = "Download File";
	if (window.webkitURL != null)
	{
		// Chrome allows the link to be clicked
		// without actually adding it to the DOM.
		downloadLink.href = window.webkitURL.createObjectURL(audioFileAsBlob);
	}
	else
	{
		// Firefox requires the link to be added to the DOM
		// before it can be clicked.
		downloadLink.href = window.URL.createObjectURL(audioFileAsBlob);
		downloadLink.onclick = destroyClickedElement;
		downloadLink.style.display = "none";
		document.body.appendChild(downloadLink);
	}

	downloadLink.click();
}

async function downloadAudioAccessMessageFile(event_name)
{
	var fileName = 'custom_' + event_name + ".wav";
	var data = await receiveAsBinaryData(
		'get_audio_access_message',
		{
			event: event_name
		}
	);

	saveAudioAsFile(fileName, data.result);
}

var modal_AudioAccessMessages = $('#modal_AudioAccessMessages').clone().end().remove();
function openAudioAccessMessagesModal() {
	var md = new Modal();
	md.setTitle("Audio access messages");
	md.setHTMLContent(modal_AudioAccessMessages);
	md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel'
		}
	]);

	var hasAudioFile = {};

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function() {
			const data = MessengerUtil.send(
				'get_configuration',
				{
					buzzer: [
						'audio_message_not_identified',
						'audio_message_authorized',
						'audio_message_not_authorized',
						'audio_message_use_mask',
						'audio_message_volume_gain'
					]
				}
			);

			switch (data.buzzer.audio_message_not_identified) {
				case "custom":
					md.getContent().find('#custom_not_identified').attr('checked','checked');
					md.getContent().find('#frmaudio_not_identified').show();
					break;
				case "default":
					md.getContent().find('#default_not_identified').attr('checked','checked');
					break;
				default:
					md.getContent().find('#disabled_not_identified').attr('checked','checked');
			}

			switch (data.buzzer.audio_message_authorized) {
				case "custom":
					md.getContent().find('#custom_authorized').attr('checked','checked');
					md.getContent().find('#frmaudio_authorized').show();
					break;
				case "default":
					md.getContent().find('#default_authorized').attr('checked','checked');
					break;
				default:
					md.getContent().find('#disabled_authorized').attr('checked','checked');
			}

			switch (data.buzzer.audio_message_not_authorized) {
				case "custom":
					md.getContent().find('#custom_not_authorized').attr('checked','checked');
					md.getContent().find('#frmaudio_not_authorized').show();
					break;
				case "default":
					md.getContent().find('#default_not_authorized').attr('checked','checked');
					break;
				default:
					md.getContent().find('#disabled_not_authorized').attr('checked','checked');
			}

			switch (data.buzzer.audio_message_use_mask) {
				case "custom":
					md.getContent().find('#custom_use_mask').attr('checked','checked');
					md.getContent().find('#frmaudio_use_mask').show();
					break;
				case "default":
					md.getContent().find('#default_use_mask').attr('checked','checked');
					break;
				default:
					md.getContent().find('#disabled_use_mask').attr('checked','checked');
			}

			switch (data.buzzer.audio_message_volume_gain) {
				case "1":
					md.getContent().find('#volume_gain_normal').attr('checked','checked');
					break;
				case "2":
					md.getContent().find('#volume_gain_medium').attr('checked','checked');
					break;
				case "3":
					md.getContent().find('#volume_gain_high').attr('checked','checked');
			}

			hasAudioFile = MessengerUtil.send('has_audio_access_messages');
			if (hasAudioFile.error) {
				return returnMessage(hasAudioFile.error);
			}

			if (hasAudioFile.not_identified) {
				md.getContent().find('#btn_download_audio_not_identified').show();
			} else {
				md.getContent().find('#no_file_uploaded_not_identified').show();
			}

			if (hasAudioFile.authorized) {
				md.getContent().find('#btn_download_audio_authorized').show();
			} else {
				md.getContent().find('#no_file_uploaded_authorized').show();
			}

			if (hasAudioFile.not_authorized) {
				md.getContent().find('#btn_download_audio_not_authorized').show();
			} else {
				md.getContent().find('#no_file_uploaded_not_authorized').show();
			}

			if (hasAudioFile.use_mask) {
				md.getContent().find('#btn_download_audio_use_mask').show();
			} else {
				md.getContent().find('#no_file_uploaded_use_mask').show();
			}

			md.getContent().find('#disabled_not_identified').click(function() {
				md.getContent().find('#frmaudio_not_identified').hide();
			});
			md.getContent().find('#default_not_identified').click(function() {
				md.getContent().find('#frmaudio_not_identified').hide();
			});
			md.getContent().find('#custom_not_identified').click(function() {
				md.getContent().find('#frmaudio_not_identified').show();
			});

			md.getContent().find('#disabled_authorized').click(function() {
				md.getContent().find('#frmaudio_authorized').hide();
			});
			md.getContent().find('#default_authorized').click(function() {
				md.getContent().find('#frmaudio_authorized').hide();
			});
			md.getContent().find('#custom_authorized').click(function() {
				md.getContent().find('#frmaudio_authorized').show();
			});

			md.getContent().find('#disabled_not_authorized').click(function() {
				md.getContent().find('#frmaudio_not_authorized').hide();
			});
			md.getContent().find('#default_not_authorized').click(function() {
				md.getContent().find('#frmaudio_not_authorized').hide();
			});
			md.getContent().find('#custom_not_authorized').click(function() {
				md.getContent().find('#frmaudio_not_authorized').show();
			});

			md.getContent().find('#disabled_use_mask').click(function() {
				md.getContent().find('#frmaudio_use_mask').hide();
			});
			md.getContent().find('#default_use_mask').click(function() {
				md.getContent().find('#frmaudio_use_mask').hide();
			});
			md.getContent().find('#custom_use_mask').click(function() {
				md.getContent().find('#frmaudio_use_mask').show();
			});
		});
	}

	async function save(returnMessage) {
		var audioMessageNotIdentified = "disabled";
		var audioMessageAuthorized = "disabled";
		var audioMessageNotAuthorized = "disabled";
		var audioMessageUseMask = "disabled";

		if (md.getContent().find('#disabled_not_identified').is(':checked')) {
			audioMessageNotIdentified = "disabled";
		} else if (md.getContent().find('#default_not_identified').is(':checked')) {
			audioMessageNotIdentified = "default";
		} else if (md.getContent().find('#custom_not_identified').is(':checked')) {
			audioMessageNotIdentified = "custom";
			if (!hasAudioFile.not_identified && $("#inputImportAudioFile_not_identified")[0].files.length == 0) {
				return returnMessage("Select an audio file (.wav) for the event \"Not identified\"");
			}
		}

		if (md.getContent().find('#disabled_authorized').is(':checked')) {
			audioMessageAuthorized = "disabled";
		} else if (md.getContent().find('#default_authorized').is(':checked')) {
			audioMessageAuthorized = "default";
		} else if (md.getContent().find('#custom_authorized').is(':checked')) {
			audioMessageAuthorized = "custom";
			if (!hasAudioFile.authorized && $("#inputImportAudioFile_authorized")[0].files.length == 0) {
				return returnMessage("Select an audio file (.wav) for the event \"Authorized\"");
			}
		}

		if (md.getContent().find('#disabled_not_authorized').is(':checked')) {
			audioMessageNotAuthorized = "disabled";
		} else if (md.getContent().find('#default_not_authorized').is(':checked')) {
			audioMessageNotAuthorized = "default";
		} else if (md.getContent().find('#custom_not_authorized').is(':checked')) {
			audioMessageNotAuthorized = "custom";
			if (!hasAudioFile.not_authorized && $("#inputImportAudioFile_not_authorized")[0].files.length == 0) {
				return returnMessage("Select an audio file (.wav) for the event \"Non Authorized\"");
			}
		}

		if (md.getContent().find('#disabled_use_mask').is(':checked')) {
			audioMessageUseMask = "disabled";
		} else if (md.getContent().find('#default_use_mask').is(':checked')) {
			audioMessageUseMask = "default";
		} else if (md.getContent().find('#custom_use_mask').is(':checked')) {
			audioMessageUseMask = "custom";
			if (!hasAudioFile.use_mask && $("#inputImportAudioFile_use_mask")[0].files.length == 0) {
				return returnMessage("Select an audio file (.wav) for the event \"Wear a mask\"");
			}
		}

		if (md.getContent().find('#volume_gain_normal').is(':checked')) {
			audioMessageVolumeGain = "1";
		} else if (md.getContent().find('#volume_gain_medium').is(':checked')) {
			audioMessageVolumeGain = "2";
		} else if (md.getContent().find('#volume_gain_high').is(':checked')) {
			audioMessageVolumeGain = "3";
		}

		const data = MessengerUtil.send(
			'set_configuration',
			{
				buzzer: {
					audio_message_not_identified: audioMessageNotIdentified,
					audio_message_authorized: audioMessageAuthorized,
					audio_message_not_authorized: audioMessageNotAuthorized,
					audio_message_use_mask: audioMessageUseMask,
					audio_message_volume_gain: audioMessageVolumeGain
				}
			}
		);
		if (data.error) {
			return returnMessage(ret1.error);
		}

		if ($("#inputImportAudioFile_not_identified")[0].files.length > 0) {
			var file = $("#inputImportAudioFile_not_identified")[0].files[0];
			var ret = await uploadFileByChunks('set_audio_access_message', file, "event=not_identified");
			if (ret.error) {
				return returnMessage(ret.error);
			}
		}
		if ($("#inputImportAudioFile_authorized")[0].files.length > 0) {
			var file = $("#inputImportAudioFile_authorized")[0].files[0];
			var ret = await uploadFileByChunks('set_audio_access_message', file, "event=authorized");
			if (ret.error) {
				return returnMessage(ret.error);
			}
		}
		if ($("#inputImportAudioFile_not_authorized")[0].files.length > 0) {
			var file = $("#inputImportAudioFile_not_authorized")[0].files[0];
			var ret = await uploadFileByChunks('set_audio_access_message', file, "event=not_authorized");
			if (ret.error) {
				return returnMessage(ret.error);
			}
		}
		if ($("#inputImportAudioFile_use_mask")[0].files.length > 0) {
			var file = $("#inputImportAudioFile_use_mask")[0].files[0];
			var ret = await uploadFileByChunks('set_audio_access_message', file, "event=use_mask");
			if (ret.error) {
				return returnMessage(ret.error);
			}
		}

		return returnMessage(null);
	}
}

var modal_CustomAccessMessages = $('#modal_CustomAccessMessages').clone().end().remove();
function openCustomAccessMessagesModal() {
	var md = new Modal();
	md.setTitle("Custom Access Messages");
	md.setHTMLContent(modal_CustomAccessMessages);
	md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel'
		}
	]);
	md.show(function () {
		const data = MessengerUtil.send(
			'get_configuration',
			{
				identifier: [
					'enable_custom_auth_message',
					'enable_custom_deny_message',
					'enable_custom_mask_message',
					'enable_custom_not_identified_message',
					'custom_auth_message',
					'custom_deny_message',
					'custom_mask_message',
					'custom_not_identified_message',
					'show_registration_on_identification'
				]
			}
		).identifier;

		md.getContent().find('#chkEnableNotId').parent().bootstrapSwitch();
		md.getContent().find('#chkEnableNotId').parent().bootstrapSwitch('setState', data.enable_custom_not_identified_message === "1");
		md.getContent().find('#chkEnableAuth').parent().bootstrapSwitch();
		md.getContent().find('#chkEnableAuth').parent().bootstrapSwitch('setState', data.enable_custom_auth_message === "1");
		md.getContent().find('#chkEnableDeny').parent().bootstrapSwitch();
		md.getContent().find('#chkEnableDeny').parent().bootstrapSwitch('setState', data.enable_custom_deny_message === "1");
		md.getContent().find('#chkEnableMask').parent().bootstrapSwitch();
		md.getContent().find('#chkEnableMask').parent().bootstrapSwitch('setState', data.enable_custom_mask_message === "1");
		md.getContent().find('#chkShowRegistration').parent().bootstrapSwitch();
		md.getContent().find('#chkShowRegistration').parent().bootstrapSwitch('setState', data.show_registration_on_identification === "1");

		md.getContent().find('#customNotIdMsg')[0].value = data.custom_not_identified_message;
		md.getContent().find('#customAuthMsg')[0].value = data.custom_auth_message;
		md.getContent().find('#customDenyMsg')[0].value = data.custom_deny_message;
		md.getContent().find('#customMaskMsg')[0].value = data.custom_mask_message;

		if (md.getContent().find('#chkEnableNotId').parent().hasClass('switch-on')) {
			md.getContent().find('#customNotIdMsg').prop('disabled', false);
		} else {
			md.getContent().find('#customNotIdMsg').prop('disabled', true);
		}
		if (md.getContent().find('#chkEnableAuth').parent().hasClass('switch-on')) {
			md.getContent().find('#customAuthMsg').prop('disabled', false);
		} else {
			md.getContent().find('#customAuthMsg').prop('disabled', true);
		}
		if (md.getContent().find('#chkEnableDeny').parent().hasClass('switch-on')) {
			md.getContent().find('#customDenyMsg').prop('disabled', false);
		} else {
			md.getContent().find('#customDenyMsg').prop('disabled', true);
		}
		if (md.getContent().find('#chkEnableMask').parent().hasClass('switch-on')) {
			md.getContent().find('#customMaskMsg').prop('disabled', false);
		} else {
			md.getContent().find('#customMaskMsg').prop('disabled', true);
		}
		md.getContent().find("#chkEnableNotId").parent().parent().on('switch-change', function (e, data) {
			if (data.value) {
				md.getContent().find('#customNotIdMsg').prop('disabled', false);
			} else {
				md.getContent().find('#customNotIdMsg').prop('disabled', true);
			}
		});
		md.getContent().find("#chkEnableAuth").parent().parent().on('switch-change', function (e, data) {
			if (data.value) {
				md.getContent().find('#customAuthMsg').prop('disabled', false);
			} else {
				md.getContent().find('#customAuthMsg').prop('disabled', true);
			}
		});
		md.getContent().find("#chkEnableDeny").parent().parent().on('switch-change', function (e, data) {
			if (data.value) {
				md.getContent().find('#customDenyMsg').prop('disabled', false);
			} else {
				md.getContent().find('#customDenyMsg').prop('disabled', true);
			}
		});
		md.getContent().find("#chkEnableMask").parent().parent().on('switch-change', function (e, data) {
			if (data.value) {
				md.getContent().find('#customMaskMsg').prop('disabled', false);
			} else {
				md.getContent().find('#customMaskMsg').prop('disabled', true);
			}
		});
		new Validate($(md.getContent()), validateMessages);
	});

	function validateMessages(data) {
		let result = [];

		if ('message' in data) {
			if (data.message.length > 40 || /['"\t\n\r]/.test(data.message))
				result.push('Please enter a valid value');
		}
		return result;
	}

	async function save(returnMessage) {
		let enable_custom_auth_message = "0";
		let enable_custom_deny_message = "0";
		let enable_custom_mask_message = "0";
		let enable_custom_not_identified_message = "0";
		let show_registration_on_identification = "0";
		let custom_auth_message = "";
		let custom_deny_message = "";
		let custom_mask_message = "";
		let custom_not_identified_message = ""

		enable_custom_auth_message = md.getContent().find('#chkEnableAuth').parent().hasClass('switch-on') ? "1" : "0";
		enable_custom_deny_message = md.getContent().find('#chkEnableDeny').parent().hasClass('switch-on') ? "1" : "0";
		enable_custom_mask_message = md.getContent().find('#chkEnableMask').parent().hasClass('switch-on') ? "1" : "0";
		enable_custom_not_identified_message = md.getContent().find('#chkEnableNotId').parent().hasClass('switch-on') ? "1" : "0";
		show_registration_on_identification = md.getContent().find('#chkShowRegistration').parent().hasClass('switch-on') ? "1" : "0";
		custom_auth_message = md.getContent().find('#customAuthMsg')[0].value; 
		custom_deny_message = md.getContent().find('#customDenyMsg')[0].value;
		custom_mask_message = md.getContent().find('#customMaskMsg')[0].value;
		custom_not_identified_message = md.getContent().find('#customNotIdMsg')[0].value;

		if (validateMessages({
			message: custom_auth_message, message: custom_deny_message,
			message: custom_mask_message, message: custom_not_identified_message
		}).length) {
			returnMessage('Poorly formatted custom messages!');
			return;
		}

		let dataSend = MessengerUtil.send(
			'set_configuration',
			{
				'identifier': {
					'enable_custom_auth_message': enable_custom_auth_message,
					'enable_custom_deny_message': enable_custom_deny_message,
					'enable_custom_mask_message': enable_custom_mask_message,
					'enable_custom_not_identified_message': enable_custom_not_identified_message,
					'show_registration_on_identification': show_registration_on_identification,
					'custom_auth_message': custom_auth_message,
					'custom_deny_message': custom_deny_message,
					'custom_mask_message': custom_mask_message,
					'custom_not_identified_message': custom_not_identified_message
				}
			}
		);
		returnMessage(dataSend);
	}
}

var modal_Language = $('#modal_Language').clone().end().remove();
var languageOption = null;
function openLanguageModal() {
	var md = new Modal();
	md.setTitle("Language");
	md.setHTMLContent(modal_Language);
	md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel'
		}
	]);

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function() {
			const data = MessengerUtil.send(
				'get_configuration',
				{
					general: [
						'language'
					]
				}
			);

			languageOption = data.general.language

			$('#pt_br_language').on('click', function () {
				languageOption = "pt_BR";
				document.getElementById('pt_br_language').classList.add('active');
				document.getElementById('en_us_language').classList.remove('active');
				document.getElementById('spa_spa_language').classList.remove('active');
			});
			$('#en_us_language').on('click', function () {
				languageOption = "en_US";
				document.getElementById('pt_br_language').classList.remove('active');
				document.getElementById('en_us_language').classList.add('active');
				document.getElementById('spa_spa_language').classList.remove('active');
			});
			$('#spa_spa_language').on('click', function () {
				languageOption = "spa_SPA";
				document.getElementById('pt_br_language').classList.remove('active');
				document.getElementById('en_us_language').classList.remove('active');
				document.getElementById('spa_spa_language').classList.add('active');
			});

			switch (data.general.language) {
				case "pt_BR":
					document.getElementById('pt_br_language').classList.add('active');
					break;
				case "en_US":
					document.getElementById('en_us_language').classList.add('active');
					break;
				case "spa_SPA":
					document.getElementById('spa_spa_language').classList.add('active');
					break;
				default:
					document.getElementById('pt_br_language').classList.add('active');
			}
		});
	}

	async function save(returnMessage) {
		const data = MessengerUtil.send(
			'set_configuration',
			{
				general: {
					language: languageOption
				}
			}
		);

		if (data.error) {
			return returnMessage(data.error);
		}

		if (languageOption === "pt_BR") {
			window.location = "../../pt_BR/html/configurations.html";
		} else if (languageOption === "en_US") {
			window.location = "../../en_US/html/configurations.html";
		} else if (languageOption === "spa_SPA") {
			window.location = "../../spa_SPA/html/configurations.html";
		}
		return returnMessage(null);
	}
}

function toggleVisibilityPasswordRTSP() {
	var eyeIcon = document.getElementById("password_RTSP-eye");
	var passwordInput = document.getElementById("password_RTSP");

	if (passwordInput.type === "password") {
		passwordInput.type = "text";
		eyeIcon.classList.remove("icon-eye-open");
		eyeIcon.classList.add("icon-eye-close");
	} else {
		passwordInput.type = "password";
		eyeIcon.classList.remove("icon-eye-close");
		eyeIcon.classList.add("icon-eye-open");
	}
}

var modal_StreamingEdit = $('#modal_StreamingEdit').clone().end().remove();
function openStreamingModal() {
	var md = new Modal();
	md.setTitle('Video Streaming');
	md.setHTMLContent(modal_StreamingEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	function alertMessage(message, duration) {
		var modal = new Modal();
		modal.setTitle('Video Streaming');
		modal.setContent(message);
		modal.addButton([
			{
				'type' : 'ok',
				'callback': function() {
					modal.close();
				}
			}
		]);
		modal.show(function() {
			setTimeout(function() {
				modal.close();
			}, duration);
		});
	}

	md.show(function() {
		var data = MessengerUtil.send(
			'get_configuration',
			{
				onvif: ['rtsp_enabled', 'rtsp_rgb', 'rtsp_username', 'rtsp_password', 'rtsp_port', 'rtsp_codec',
						'rtsp_video_width', 'rtsp_video_height', 'rtsp_flipped', 'onvif_enabled', 'onvif_port'],
				video_stream: ['audio_enabled', 'rtsp_watermark', 'rtsp_watermark_logo_enabled', 'rtsp_watermark_custom_logo_enabled',
					 		   'rtsp_zoom', 'rtsp_yadjust', 'max_bitrate']
			}
		);

		md.getContent().find("#streaming_disabled").attr("disabled", false);
		md.getContent().find("#streaming_rtsp").attr("disabled", false);
		md.getContent().find("#streaming_onvif").attr("disabled", false);

		if (data.onvif.onvif_enabled === '1') {
			md.getContent().find('#streaming_onvif').attr('checked','checked');
			md.getContent().find('#streaming-tabs').show();
			md.getContent().find('#tab2_camera_settings_nav').show();
			md.getContent().find('#tab3_streaming_parameters_nav').show();
			md.getContent().find('#rtsp_fields').hide();
			md.getContent().find('#onvif_fields').show();
		} else if (data.onvif.rtsp_enabled === '1') {
			md.getContent().find('#streaming_rtsp').attr('checked','checked');
			md.getContent().find('#streaming-tabs').show();
			md.getContent().find('#common_fields').show();
			md.getContent().find('#rtsp_fields').show();
			md.getContent().find('#tab2_camera_settings_nav').show();
			md.getContent().find('#tab3_streaming_parameters_nav').show();
			md.getContent().find('#onvif_fields').hide();
		} else {
			md.getContent().find('#streaming_disabled').attr('checked','checked');
			md.getContent().find('#streaming-tabs').hide();
			md.getContent().find('#tab2_camera_settings_nav').show();
			md.getContent().find('#tab3_streaming_parameters_nav').show();
			md.getContent().find('#rtsp_fields').hide();
			md.getContent().find('#onvif_fields').hide();
			md.getContent().find('#tab2_camera_settings_nav').hide();
			md.getContent().find('#tab3_streaming_parameters_nav').hide();
		}

		md.getContent().on('change', 'input[name=streaming_status]', function() {
			if (md.getContent().find('#streaming_onvif').is(':checked')) {
				md.getContent().find('#streaming-tabs').show();
				md.getContent().find('#tab2_camera_settings_nav').show();
				md.getContent().find('#tab3_streaming_parameters_nav').show();
				md.getContent().find('#rtsp_fields').hide();
				md.getContent().find('#onvif_fields').show();
			} else if (md.getContent().find('#streaming_rtsp').is(':checked')) {
				md.getContent().find('#tab2_camera_settings_nav').show();
				md.getContent().find('#tab3_streaming_parameters_nav').show();
				md.getContent().find('#streaming-tabs').show();
				md.getContent().find('#common_fields').show();
				md.getContent().find('#rtsp_fields').show();
				md.getContent().find('#onvif_fields').hide();
			} else {
				md.getContent().find('#tab2_camera_settings_nav').hide();
				md.getContent().find('#tab3_streaming_parameters_nav').hide();
				md.getContent().find('#common_fields').hide();
				md.getContent().find('#rtsp_fields').hide();
				md.getContent().find('#onvif_fields').hide();
				md.getContent().find('#streaming-tabs').hide();
			}
		});

		var landscapeOptions = [
			{width: 640,  height:360 },
			{width: 1280, height:720 },
			{width: 1920, height:1080},

		]
		var portraitOptions = [
			{width: 360,  height:640},
			{width: 720,  height:1280},
			{width: 1080, height:1920}
		]
		function updateResolutions(){
			var videoRes = md.getContent().find('#video_res');
			videoRes.empty()
			if (md.getContent().find('#orientationPortrait').is(':checked')){
				$.each(portraitOptions, function(index, option) {
					videoRes.append($('<option>', {value: option.width + 'x' + option.height, text: option.width + 'x' + option.height}));
				});
			}else{
				$.each(landscapeOptions, function(index, option) {
					videoRes.append($('<option>', {value: option.width + 'x' + option.height, text: option.width + 'x' + option.height}));
				});
			}
		}

		function updateFigure(){
			const svgElement = document.getElementById('rtspZoomRepresentation');
			const monitorBorder = document.getElementById('rtspFigureMonitorBorder');
			const monitorStand = document.getElementById('rtspFigureMonitorStand');
			const frameRect = document.getElementById('rtspFigureFrameRect');
			const imageRect = document.getElementById('rtspFigureImageRect');
			const intersectionRect = document.getElementById('rtspFigureIntersectionRect');


			let rect = svgElement.viewBox.baseVal;
			const svgWidth = rect.width;
			const svgHeight = rect.height;

			var zoom = md.getContent().find('#streaming_zoom')[0].value;
			var vertical_adjust = md.getContent().find('#streaming_yadjust')[0].value;
			var [videoWidth, videoHeight] = md.getContent().find('#video_res option:selected').val().split('x');
			videoWidth = parseFloat(videoWidth);
			videoHeight = parseFloat(videoHeight);

			if (videoWidth > videoHeight){
				var frameHeight = 64;
				var frameWidth = frameHeight * videoWidth / videoHeight;
			}else{
				var frameWidth = 64;
				var frameHeight = frameWidth * videoHeight / videoWidth;
			}
			var frameX = svgWidth / 2 - frameWidth / 2;
			var frameY = svgHeight / 2 - frameHeight / 2;

			var monitorBorderX = frameX - 5;
			var monitorBorderY = frameY - 5;
			var monitorBorderWidth = frameWidth + 10;
			var monitorBorderHeight = frameHeight + 20;

			var monitorStandX = monitorBorderX + monitorBorderWidth/2;
			var monitorStandY = monitorBorderY + monitorBorderHeight - 1;

			var originalImageHeight = frameHeight;
			var originalImageWidth = frameHeight / 1.77777;
			var imageHeight = originalImageHeight * zoom;
			var imageWidth = originalImageWidth * zoom;
			var imageX = svgWidth / 2 - imageWidth / 2;
			var imageY = frameY - (imageHeight - originalImageHeight) * vertical_adjust / 100.0;

			var intersectionXStart = Math.max(imageX, frameX);
			var intersectionXEnd = Math.min(imageX + imageWidth, frameX + frameWidth);
			var intersectionYStart = Math.max(imageY, frameY);
			var intersectionYEnd = Math.min(imageY + imageHeight, frameY + frameHeight);


			monitorBorder.setAttribute('x', monitorBorderX);
			monitorBorder.setAttribute('y', monitorBorderY);
			monitorBorder.setAttribute('width', monitorBorderWidth);
			monitorBorder.setAttribute('height', monitorBorderHeight);

			monitorStand.setAttribute('transform', 'translate(' + monitorStandX + ',' + monitorStandY + ')');

			frameRect.setAttribute('x', frameX);
			frameRect.setAttribute('y', frameY);
			frameRect.setAttribute('width', frameWidth); 
			frameRect.setAttribute('height', frameHeight);

			imageRect.setAttribute('x', imageX);
			imageRect.setAttribute('y', imageY);
			imageRect.setAttribute('width', imageWidth); 
			imageRect.setAttribute('height', imageHeight);

			intersectionRect.setAttribute('x', intersectionXStart);
			intersectionRect.setAttribute('y', intersectionYStart);
			intersectionRect.setAttribute('width', intersectionXEnd - intersectionXStart);
			intersectionRect.setAttribute('height', intersectionYEnd - intersectionYStart);
		}

		var landscapeOptions = [
			{width: 640,  height:360, extra:"(16:9)"},
			{width: 640,  height:480, extra:"(4:3)"},
			{width: 800,  height:600, extra:"(4:3)"},
			{width: 1024, height:768, extra:"(4:3)"},
			{width: 1280, height:720, extra:"(16:9)"},
			{width: 1280, height:960, extra:"(4:3)"},
			{width: 1920, height:1080, extra:"(16:9)"},

		]
		var portraitOptions = [
			{width: 360,  height:640, extra:"(9:16)"},
			{width: 720,  height:1280, extra:"(9:16)"},
			{width: 1080, height:1920, extra:"(9:16)"}
		]

		function updateResolutions(){
			var videoRes = md.getContent().find('#video_res');
			videoRes.empty()
			var options;
			if (md.getContent().find('#orientationPortrait').is(':checked')){
				options = portraitOptions;
			}else{
				options = landscapeOptions;
			}

			$.each(options, function(index, option) {
				videoRes.append($('<option>', {value: option.width + 'x' + option.height, text: option.width + 'x' + option.height + option.extra}));
			});
			md.getContent().find('#video_res').val(options[0].width + 'x' + options[0].height);
			$.each(options, function(index, option) {
				if (option.width == parseInt(data.onvif.rtsp_video_width) && option.height == parseInt(data.onvif.rtsp_video_height)) {
					md.getContent().find('#video_res').val(option.width + 'x' + option.height);
				}
			});
			updateFigure();
		}

		md.getContent().find('#orientationPortrait').parent().bootstrapSwitch();
		md.getContent().find('#orientationPortrait').parent().bootstrapSwitch('setState', parseInt(data.onvif.rtsp_video_height) > parseInt(data.onvif.rtsp_video_width));
		md.getContent().find('#orientationPortrait').on('change', updateResolutions);
		md.getContent().find('#port_RTSP')[0].value = data.onvif.rtsp_port;
		md.getContent().find('#login_RTSP')[0].value = data.onvif.rtsp_username;
		md.getContent().find('#password_RTSP')[0].value = data.onvif.rtsp_password;
		md.getContent().find('#video_codec').parent().bootstrapSwitch();
		md.getContent().find('#video_codec').parent().bootstrapSwitch('setState', data.onvif.rtsp_codec === "mjpeg");
		md.getContent().find('#enabled_RGB').val(data.onvif.rtsp_rgb);
		md.getContent().find('#flipped_image').parent().bootstrapSwitch();
		md.getContent().find('#flipped_image').parent().bootstrapSwitch('setState', data.onvif.rtsp_flipped === "1");
		md.getContent().find('#watermark_enabled').parent().bootstrapSwitch();
		md.getContent().find('#watermark_enabled').parent().bootstrapSwitch('setState', data.video_stream.rtsp_watermark === "1");
		md.getContent().find('#watermark_logo_enabled').parent().bootstrapSwitch();
		md.getContent().find('#watermark_logo_enabled').parent().bootstrapSwitch('setState', data.video_stream.rtsp_watermark_logo_enabled === "1");
		md.getContent().find('#watermark_custom_logo_enabled').parent().bootstrapSwitch();
		md.getContent().find('#watermark_custom_logo_enabled').parent().bootstrapSwitch('setState', data.video_stream.rtsp_watermark_custom_logo_enabled === "1");
		md.getContent().find('#audio_enabled').parent().bootstrapSwitch();
		md.getContent().find('#audio_enabled').parent().bootstrapSwitch('setState', data.video_stream.audio_enabled === "1");
		md.getContent().find('#port_ONVIF')[0].value = data.onvif.onvif_port;
		md.getContent().find('#streaming_zoom')[0].value = data.video_stream.rtsp_zoom;
		md.getContent().find('#streaming_zoom').on('input', updateFigure);
		md.getContent().find('#var_streaming_zoom')[0].value = data.video_stream.rtsp_zoom;
		md.getContent().find('#streaming_yadjust')[0].value = data.video_stream.rtsp_yadjust;
		md.getContent().find('#streaming_yadjust').on('input', updateFigure);
		md.getContent().find('#var_streaming_yadjust')[0].value = data.video_stream.rtsp_yadjust;
		md.getContent().find('#video_res').on('change', updateFigure);
		
		/* Inicia o canvas para upload da imagem */
		canvas_streaming = document.querySelector('#canvas_streaming');
		ctx_streaming = canvas_streaming.getContext('2d');
		
		var image = new Image;
		image.onload = function () {
			canvas_streaming.width = image.width;
			canvas_streaming.height = image.height;
			ctx_streaming.drawImage(image, 0, 0, image.width, image.height);
			var img_streaming = canvas_streaming.toDataURL("image/png", 0.5);
			GeraBytesFotosStreaming(img_streaming);
		}
		image.onerror = function () {
			canvas_streaming.height = 100;
			canvas_streaming.width = 200;
			ctx_streaming.font = "20px Georgia";
			ctx_streaming.fillText("No image", 50, 70);
		}
		image.src = '/get_streaming_logo.fcgi' + `?_=${new Date().getTime()}`;
		md.getContent().find('#bitrateValue')[0].value = data.video_stream.max_bitrate;

		updateResolutions();
		updateFigure();

		new Validate($(md.getContent()), validateInputs);
		});

	function save(returnMessage) {
		const rtspEnabled = md.getContent().find('#streaming_rtsp').is(':checked') ? '1' : '0';
		const enabledRgb = md.getContent().find('#enabled_RGB option:selected').val();
		const rtspPort = md.getContent().find('#port_RTSP')[0].value;
		const login = md.getContent().find('#login_RTSP')[0].value;
		const password = md.getContent().find('#password_RTSP')[0].value;
		const codec = md.getContent().find('#video_codec').parent().hasClass('switch-on') ? 'mjpeg' : 'h264';
		const flipped = md.getContent().find('#flipped_image').parent().hasClass('switch-on') ? '1' : '0';
		const audioEnabled = md.getContent().find('#audio_enabled').parent().hasClass('switch-on') ? '1' : '0';
		const watermarkEnabled = md.getContent().find('#watermark_enabled').parent().hasClass('switch-on') ? '1' : '0';
		const watermarkLogoEnabled = md.getContent().find('#watermark_logo_enabled').parent().hasClass('switch-on') ? '1' : '0';
		const watermarkCustomLogoEnabled = md.getContent().find('#watermark_custom_logo_enabled').parent().hasClass('switch-on') ? '1' : '0';
		const onvifEnabled = md.getContent().find('#streaming_onvif').is(':checked') ? '1' : '0';
		const onvifPort = md.getContent().find('#port_ONVIF')[0].value;
		const zoom = md.getContent().find('#streaming_zoom')[0].value;
		const vertical_adjust = md.getContent().find('#streaming_yadjust')[0].value;
		const [videoWidth, videoHeight] = md.getContent().find('#video_res option:selected').val().split('x');
		const bitrate = md.getContent().find('#bitrateValue')[0].value;

		if (validateInputs({port_rtsp: rtspPort, login: login, password: password, port_onvif: onvifPort,
								 bitrate: bitrate}).length) {
			returnMessage('Invalid input data');
			return;
		}

		var data = MessengerUtil.send(
			'set_configuration',
			{
				onvif: {
					rtsp_enabled: rtspEnabled,
					rtsp_rgb: enabledRgb,
					rtsp_username: login,
					rtsp_password: password,
					rtsp_port: rtspPort,
					rtsp_codec: codec,
					rtsp_video_width: videoWidth,
					rtsp_video_height: videoHeight,
					rtsp_flipped: flipped,
					onvif_enabled: onvifEnabled,
					onvif_port: onvifPort
				},
				video_stream: {
					audio_enabled : audioEnabled,
					rtsp_watermark: watermarkEnabled,
					rtsp_watermark_logo_enabled : watermarkLogoEnabled,
					rtsp_watermark_custom_logo_enabled: watermarkCustomLogoEnabled,
					rtsp_zoom: zoom,
					rtsp_yadjust: vertical_adjust,
					max_bitrate: bitrate
				}
			}
		)
		
		if (btFotoStreaming == null || btFotoStreaming.length == 1 && btFotoStreaming[0] == 1)
			MessengerUtil.send('remove_streaming_logo');
		else
			MessengerUtil.sendFile('set_streaming_logo', btFotoStreaming);
		
		if (data.error) {
			return returnMessage(data.error);
		}
		return returnMessage(null);
	}

	function validateInputs (data) {
		var result = [];
		var regex = new RegExp(/^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/);

		log();

		console.log(data)

		if ('port_rtsp' in data) {
			if (data.port_rtsp.length === 0 || isNaN(data.port_rtsp) ||
				parseInt(data.port_rtsp) <= 0 || parseInt(data.port_rtsp) === 22 || parseInt(data.port_rtsp) > 65535) {
					result.push('Please enter a valid value');
			}
			if (data.port_rtsp.length !== 0) {
				const verifier = MessengerUtil.send(
					'check_port_availability',
					{
						initial_port: parseInt(data.port_rtsp),
						final_port: parseInt(data.port_rtsp)
					}
				);
				if (verifier.status && verifier.status !== "OK" && verifier.status !== "RTSP") {
					result.push("Port already used: " + verifier.status);
				}
			}
		}

		if ('port_onvif' in data) {
			if (data.port_onvif.length === 0 || isNaN(data.port_onvif) ||
				parseInt(data.port_onvif) <= 0 || parseInt(data.port_onvif) === 22 || parseInt(data.port_onvif) > 65535) {
				result.push('Please enter a valid value');
			}
			if (data.port_onvif.length !== 0) {
				const verifier = MessengerUtil.send(
					'check_port_availability',
					{
						initial_port: parseInt(data.port_onvif),
						final_port: parseInt(data.port_onvif)
					}
				);
				if (verifier.status && verifier.status !== "OK" && verifier.status !== "ONVIF") {
					result.push("Port already used: " + verifier.status);
				}
			}
		}

		if ('login' in data) {
			if (!(data.login.length === 0)) {
				if (('password' in data) && (data.password.length === 0)) {
					result.push('Please enter a valid value');
				}
			}
		}

		if ('password' in data) {
			if (!(data.password.length === 0)) {
				if (('login' in data) && (data.login.length === 0)) {
					result.push('Please enter a valid value');
				}
			}
		}

		if ('bitrate' in data) {
			if (!(data.bitrate.length === 0)) {
				if (isNaN(data.bitrate) || parseInt(data.bitrate) < 600 || parseInt(data.bitrate) > 6000) {
					result.push('Bitrate must be between 600 and 6000 Kb/s');
				}
			}
		}

		return result;
	}

	function log(){
		var log;
		var data = MessengerUtil.send('system_information', null, null, false);
		var ip = data.network.ip;
		var username = md.getContent().find('#login_RTSP')[0].value;
		var password = md.getContent().find('#password_RTSP')[0].value;
		var port = md.getContent().find('#port_RTSP')[0].value;
		var text = 'To access the RTSP stream, use the following URL in some Stream RTSP compatible software such as VLC media player: ';
		if (username.length == 0 || password.length == 0) {
			var url = 'rtsp://' + ip + ':' + port + '/main_stream';
		} else {
			var url = 'rtsp://' + username + ':' + password + '@' + ip + ':' + port + '/main_stream';
		}
		log = text + url;
		md.getContent().find('#log1').html(text);
		md.getContent().find('#log2').html(url);
	 }

}

var modal_OperationModeEdit = $('#modal_OperationModeEdit').clone().end().remove();
function openOperationModeModal(){
	var md = new Modal();
	var previousRole;
	var serverId;
	var serverExist;

	var previousIpOnline;
	var previousPortOnline;
	var subpath;

	var previousIpMonitor;
	var previousPortMonitor;
	var previousTimeoutMonitor;
	var previousPathMonitor;

	md.setTitle('Operation Mode');
	md.setHTMLContent(modal_OperationModeEdit);
	md.addButton([
		{
			'type' : 'ok',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show(function(){
		var data = MessengerUtil.send(
			'get_configuration',
			{
				'general': ['online'],
				'online_client': ['server_id'],
				'monitor': ['hostname', 'port', 'path', 'request_timeout'],
			}
		);

		serverId = parseInt(data.online_client.server_id, 10);
		var data_objects = !isNaN(serverId) ?
			MessengerUtil.send('load_objects', { object: 'devices', where: [{object: 'devices', field: 'id', value: serverId}] }) :
			{ devices: [] };

		if (data_objects.devices.length === 1) {
			serverExist = true;
			var data_addr = data_objects.devices[0].ip;
			var match = data_addr.match(/^((?:https?:\/\/)?[^\s:\/]+(?:\.[^\s:\/]+)*):(\d{1,5})(\/[^\s]*)?$/);

			if (match) {
				subpath = match[3] || "";
				previousIpOnline = match[1] + subpath;
				previousPortOnline = match[2];
				md.getContent().find('#ipOnlineMode')[0].value = previousIpOnline;
				md.getContent().find('#portOnlineMode')[0].value = previousPortOnline;
			}

			md.getContent().find('#server_addr').html("Server configured with IP:");
			document.getElementById("server_addr").classList.remove("red");

		} else if (data_objects.devices.length === 0) {
			serverExist = false;
			md.getContent().find('#server_addr').html("Server not configured.");
			document.getElementById("server_addr").classList.add("red");

		} else {	// should not reach here, as device ids are unique
			md.getContent().find('#server_addr').html("**");
		}

		if (data.monitor.hostname !== "") {
			md.getContent().find('#hostname').html("Monitor configured with parameters:");
			previousIpMonitor = data.monitor.hostname;
			md.getContent().find('#ipHostname')[0].value = previousIpMonitor;
			document.getElementById("hostname").classList.remove("red");
		} else {
			md.getContent().find('#hostname').html("Monitor not configured.");
			document.getElementById("hostname").classList.add("red");
		}

		if (data.monitor.port !== "") {
			previousPortMonitor = data.monitor.port;
			md.getContent().find('#portHostname')[0].value = previousPortMonitor;
		}

		if (data.monitor.path !== "") {
			previousPathMonitor = data.monitor.path;
			md.getContent().find('#pathMonitor')[0].value = previousPathMonitor;
		} else {
			md.getContent().find('#pathMonitor')[0].value = "api/notifications";
		}

		if (data.monitor.request_timeout !== "") {
			previousTimeoutMonitor = data.monitor.request_timeout;
			md.getContent().find('#requestTimeout')[0].value = previousTimeoutMonitor;
		}

		md.getContent().find('#chkButtonOperationModeStatus').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonOperationModeStatus').parent().bootstrapSwitch('setState', data.general.online === '1');
		md.getContent().find('#chkButtonOperationModeStatus').parent().parent().on('switch-change', function (e, data) {
			verifyShow();
		});

		verifyShow();
		function verifyShow(){
			var onlineMode = md.getContent().find('#chkButtonOperationModeStatus').parent().bootstrapSwitch('status');

			if (onlineMode) {
				md.getContent().find('#editServerFields').show('slow');
			} else {
				md.getContent().find('#editServerFields').hide('slow');
			}

			if (onlineMode) {
				md.getContent().find('#server_info_1').show('slow');
				md.getContent().find('#server_info_2').show('slow');
			} else {
				md.getContent().find('#server_info_1').hide('slow');
				md.getContent().find('#server_info_2').hide('slow');
			}

			md.getContent().find('#online_area').show('slow');
		}
	});

	function save (returnMessage) {
		var onlineMode = '0';

		var warningInvalidInput = new Modal();
		warningInvalidInput.setTitle('Invalid parameters');
		warningInvalidInput.setContent('Warning! Some configured parameter presents an error!');
		warningInvalidInput.addButton([
			{
				'type' : 'ok',
				'callback': function(){
					warningInvalidInput.close();
					returnMessage(true);
				}
			}
		]);

		if (md.getContent().find('#chkButtonOperationModeStatus').parent().bootstrapSwitch('status')) {
			onlineMode = '1';
		} else {
			onlineMode = '0';
		}


		var full_input = md.getContent().find('#ipOnlineMode')[0].value;
		var match = full_input.match(/^((?:https?:\/\/)?(?:(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:\d{1,3}\.){3}\d{1,3}))(\/[^\s]*)?$/);
		var ip_config = match ? match[1] : "";
		var subpath_config = match ? match[2] || "" : "";
		var port_config = md.getContent().find('#portOnlineMode')[0].value;
		var addr_empty = (ip_config === "" || port_config === "");
		var editOnline = (ip_config + subpath_config !== previousIpOnline || port_config !== previousPortOnline);
		if (editOnline && !addr_empty) {
			var result = validateInputs({
				ip: ip_config + subpath_config,
				port: port_config
			});
	
			if (result.length) {
				warningInvalidInput.show();
				returnMessage(false);
				return;
			}
		}

		var hostname_monitor = md.getContent().find('#ipHostname')[0].value;
		var port_monitor = md.getContent().find('#portHostname')[0].value;
		var timeout_monitor = md.getContent().find('#requestTimeout')[0].value;
		var path_monitor = md.getContent().find('#pathMonitor')[0].value;
		var param_empty = (hostname_monitor === "" || port_monitor === "" ||
						   timeout_monitor === "" || path_monitor === "");

		if(hostname_monitor === "") hostname_monitor = "";
		if(port_monitor === "") port_monitor = 0;
		if(timeout_monitor === "") timeout_monitor = 10000;
		if(path_monitor === "") path_monitor = "api/notifications";

		var editMonitor = (hostname_monitor !== previousIpMonitor || port_monitor !== previousPortMonitor ||
						   timeout_monitor !== previousTimeoutMonitor || path_monitor !== previousPathMonitor);

		if (editMonitor && !param_empty) {
			var result = validateInputs({
				ipMonitor: hostname_monitor,
				portMonitor: port_monitor,
				timeout: timeout_monitor,
				path: path_monitor
			});
	
			if (result.length) {
				warningInvalidInput.show();
				returnMessage('Invalid input data<br>' + result);
				return;
			}
		}

		MessengerUtil.send(
			'set_configuration',
			{
				'general': {'online': onlineMode},
			}
		);

		if (onlineMode && editOnline) {
			if (serverExist && !addr_empty) {
				MessengerUtil.send('modify_objects', {
					"object": "devices",
					"where": {
						'devices': {
							'id': serverId
						}
					},
					"values": {
						"ip": ip_config + ":" + port_config + subpath_config
					}
				});
			} else if (!serverExist && !addr_empty) {
				MessengerUtil.send('create_objects', {
					object: 'devices',
					values: [{
						id: 1,
						ip: ip_config + ":" + port_config + subpath_config,
						name: '',
						public_key: ''
					}]
				});

				MessengerUtil.send('set_configuration', {
						"online_client": {
							"server_id": "1"
						}
				});
			} else if (serverExist && addr_empty) {
				MessengerUtil.send('destroy_objects', {
					"object": "devices",
					"where": {
						'devices': {
							'id': serverId
						}
					}
				});
			}
		}

		if (editMonitor) {
			MessengerUtil.send(
				'set_configuration',
				{
					'monitor': {
						'request_timeout': timeout_monitor,
						'hostname': hostname_monitor,
						'port': port_monitor,
						'path': path_monitor
					}
				}
			);
		}

		location.reload();
		returnMessage(true);
	}

	function validateInputs(data) {
		var result = [];

		var regex = new RegExp(/^(?:(?:https?:\/\/)?(?:(?:\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))(?:\/[^\s]*)?$/);
		if ('ip' in data) {
			if (!regex.test(data.ip) || data.ip.includes(' ')) {
				result.push('Please enter a valid value');
			}
		}

		if ('port' in data) {
			if (data.port.length === 0 || isNaN(data.port) || data.port.includes(' ') ||
				parseInt(data.port) <= 0 || parseInt(data.port) === 22 || parseInt(data.port) > 65535) {
				result.push('Please enter a valid value');
			}
		}

		if ('ipMonitor' in data) {
			if (!regex.test(data.ipMonitor) || data.ipMonitor.includes(' ')) {
				result.push('Please enter a valid value');
			}
		}

		if ('portMonitor' in data) {
			if (data.portMonitor.length === 0 || isNaN(data.portMonitor) || data.portMonitor.includes(' ') ||
				parseInt(data.portMonitor) <= 0 || parseInt(data.portMonitor) === 22 || parseInt(data.portMonitor) > 65535) {
				result.push('Please enter a valid value');
			}
		}

		if ('timeout' in data) {
			if (data.timeout.length === 0 || isNaN(data.timeout) || parseInt(data.timeout) < 0) {
				result.push('Please enter a valid value');
			}
		}

		if ('path' in data) {
			if (data.path.length === 0) {
				result.push('Please enter a valid value');
			}
		}

		return result;
	}
}

var modal_pushEdit = $('#modal_pushEdit').clone().end().remove();
function openPushModal(){
	var md = new Modal();
	md.setTitle('Push Configuration');
	md.setHTMLContent(modal_pushEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	function save(returnMessage){
		var address = md.getContent().find('#inputAddress')[0].value;
		var period = md.getContent().find('#pushPeriod')[0].value;

		if (validatePush({ address: address , period : period }).length){
			returnMessage("Invalid address or period");
			return;
		}

		var data = MessengerUtil.send('set_configuration',{
			push_server: 
				{ 
					push_remote_address: address,
					push_request_period: period
				}
		});

		return returnMessage(data.error != undefined ? data.error : null);
	}

	md.show(function(){
		var data = MessengerUtil.send(
			'get_configuration',
			{
				'push_server': ['push_remote_address', 'push_request_period']
			}
		).push_server;

		md.getContent().find('#inputAddress')[0].value = data.push_remote_address;
		md.getContent().find('#pushPeriod')[0].value = data.push_request_period;
		new Validate($(md.getContent()), validatePush);
	});

	function validatePush(data){
		var result = [];

		if('address' in data){
			// currently there are no restrictions to the push server address; empty just means disabled
			// result.push('Enter a valid value');
		}

		if('period' in data){
			if(ValidateUtil.isEmpty(data['period']) || ! ValidateUtil.isNumber(data['period']) || ! Number.isInteger(parseFloat(data['period']))|| data['period'] < 0){
				result.push("Inform a valid time");
			}
		}

		return result;
	}
}

var modal_Qrcode = $('#modal_Qrcode').clone().end().remove();
function openQrcodeModal(){
	var md = new Modal();
	md.setTitle('Configure QR Code');
	md.setHTMLContent(modal_Qrcode);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);
	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function() {
			const data = MessengerUtil.send(
				'get_configuration',
				{
					face_id: [
						'qrcode_legacy_mode_enabled',
						'qrcode_overflow_mode',
						'qrcode_prefix_mode',
						'qrcode_prefix',
						'qrcode_suffix'
					],
					general: [
						'totp_enabled', 'totp_single_use', 'totp_tz_offset', 'totp_window_size', 'totp_window_num'
					],
					wiegand: [
						'wiegand_format_size'
					]
				}
			);
			md.getContent().find('#chkButtonStatusQr').val(data.face_id.qrcode_legacy_mode_enabled);
			md.getContent().find('#inputQrcodePrefix')[0].value = data.face_id.qrcode_prefix || '';
			md.getContent().find('#inputQrcodeSuffix')[0].value = data.face_id.qrcode_suffix || '';
			md.getContent().find('#inputTzOffset')[0].value = data.general.totp_tz_offset;
			md.getContent().find('#inputWindowTime')[0].value = data.general.totp_window_size;
			md.getContent().find('#inputNumberOfWindows')[0].value = data.general.totp_window_num;

			md.getContent().find('#chkPrefixMode').parent().bootstrapSwitch();
			md.getContent().find('#chkPrefixMode').parent().bootstrapSwitch('setState', data.face_id.qrcode_prefix_mode === '1');			
			md.getContent().find('#chkDynamicQR').parent().bootstrapSwitch();
			md.getContent().find('#chkDynamicQR').parent().bootstrapSwitch('setState', data.general.totp_enabled === '1');
			md.getContent().find('#chkSingleUse').parent().bootstrapSwitch();
			md.getContent().find('#chkSingleUse').parent().bootstrapSwitch('setState', data.general.totp_single_use === '1');

			const qr_wiegand_size_mappings = {
				"custom": "#qr_manual_size",
				"26": "#qr_w26_size",
				"32": "#qr_w32_size",
				"34": "#qr_w34_size",
				"35": "#qr_w35_size",
				"37(H10302)": "#qr_w37_10302_size",
				"37(H10304)": "#qr_w37_10304_size",
				"40": "#qr_w40_size",
				"42": "#qr_w42_size",
				"48": "#qr_w48_size",
				"56": "#qr_w56_size",
				"64": "#qr_w64_size",
				"66": "#qr_w66_size"
			};
			let qr_wiegand_format = qr_wiegand_size_mappings[data.wiegand.wiegand_format_size];
			md.getContent().find(qr_wiegand_format || '#qr_w26_size').attr('checked', 'checked');

			const qr_overflow_mappings = {
				"0": "#qr_overflow_trim_msb",
				"1": "#qr_overflow_trim_lsb",
				"2": "#qr_overflow_zero",
				"3": "#qr_overflow_ones"
			};
			let qr_overflow = qr_overflow_mappings[data.face_id.qrcode_overflow_mode];
			md.getContent().find(qr_overflow || '#qr_overflow_trim_msb').attr('checked', 'checked');
		});
	}

	function save(returnMessage) {

		let qrcode_mode = md.getContent().find('#chkButtonStatusQr').val();
		let qrcode_prefix_mode = md.getContent().find('#chkPrefixMode').parent().hasClass('switch-on') ? '1' : '0';
		let qrcode_prefix = md.getContent().find('#inputQrcodePrefix')[0].value;
		let qrcode_suffix = md.getContent().find('#inputQrcodeSuffix')[0].value;
		let totp_tz = md.getContent().find('#inputTzOffset')[0].value.trim();
		let totp_win_size = md.getContent().find('#inputWindowTime')[0].value.trim();
		let totp_num_win = md.getContent().find('#inputNumberOfWindows')[0].value.trim();
		let totp_en = md.getContent().find('#chkDynamicQR').parent().hasClass('switch-on') ? '1' : '0';
		let totp_single = md.getContent().find('#chkSingleUse').parent().hasClass('switch-on') ? '1' : '0';
		let qr_wiegand_format = md.getContent().find('input[name="qr-wiegandsize"]:checked').val() || '26';
		let qr_overflow_mode = md.getContent().find('input[name="qr-overflow-mode"]:checked').val() || '0';

		const data = MessengerUtil.send(
			'set_configuration',
			{
				face_id: {
					qrcode_legacy_mode_enabled: qrcode_mode,
					qrcode_overflow_mode: qr_overflow_mode,
					qrcode_prefix_mode: qrcode_prefix_mode,
					qrcode_prefix: qrcode_prefix,
					qrcode_suffix: qrcode_suffix
				},
				general: {
					totp_enabled: totp_en,
					totp_single_use: totp_single,
					totp_tz_offset: totp_tz,
					totp_window_size: totp_win_size,
					totp_window_num: totp_num_win
				},
				sec_box: {
					wiegand_out_size: qr_wiegand_format
				},
				osdp: {
					wiegand_size: qr_wiegand_format
				},
				wiegand: {
					wiegand_format_size: qr_wiegand_format
				}
			}
		);
		return returnMessage(data.error !== undefined ? data.error : null);
	}
}

function openUpgradeBiometricsModal() {
	var md = new Modal();
	var data = MessengerUtil.send('system_information', null, null, false);
	var max_biometrics = parseInt(data.biometrics.max_num_records);

	md.setTitle("Max Fingerprint Records");
	//md.setHTMLContent($('#modal_upgradeBiometrics'));
	if (max_biometrics < 10000) {
		md.addButton([
			{
				'type': 'save',
				'callback': save
			}
		]);
	}
	md.addButton([
		{
			'type': 'cancel'
		}
	]);
	md.show(function(){
		md.getContent().find('#textMaxBiometrics').html("Current maximum")
		md.getContent().find("#inputMaxBiometrics").val(max_biometrics);
		md.getContent().find('#inputMaxBiometrics')[0].readOnly = true;
		if (max_biometrics < 10000) {
			md.getContent().find('#sectionUpgradePassword').show();
		}
	});
	function save (returnMessage) {
		var password = md.getContent().find('#inputUpgradePassword')[0].value;
		var data = MessengerUtil.send('upgrade_ten_thousand_templates', { password: password });
		if (!data) {
			returnMessage("Error while upgrading maximum number of fingerprint records");
			return;
		}
		if (data.error)
			returnMessage("Invalid password");
		else {
			returnMessage({'success': 'Upgrade successful', 'callback': openUpgradeBiometricsModal});
		}
	}
}

var modal_oemCode_content = $('#modal_oemCode').clone().end().remove();
function openOEMCodeModal() {
	var md = new Modal();
	md.setTitle("OEM Code");
	md.setHTMLContent(modal_oemCode_content);

	md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel'
		}
	]);

	md.show(function () {
		// Initial state
		updateMessage(md, '', false);

		try {
			// Check if OEM code exists
			const data = MessengerUtil.send('get_oem_code', null, null, false);

			if (data.error) {
				updateMessage(md, 'No OEM code configured. Enter a new code and license.', true);
			} else {
				md.getContent().find('#inputOemCode').val(data.oem_code || '');
				md.getContent().find('#inputLicense').val(data.license || '');
				updateMessage(md, 'OEM code already set. You can change it above.', true);
			}
		} catch (error) {
			showErrorModal('Error loading OEM settings', error.message);
		}
	});

	function save(returnMessage) {
		const oemCode = md.getContent().find('#inputOemCode').val().trim();
		const license = md.getContent().find('#inputLicense').val().trim();

		// Input validation
		if (!oemCode || !license) {
			returnMessage('Please fill in both fields: OEM Code and License.');
			return;
		}

		try {
			// Send data to server
			const result = MessengerUtil.send('set_oem_code', {
				oem_code: oemCode,
				license: license
			});

			if (result.error) {
				returnMessage('Configuration failed.');
				return;
			} else {
				returnMessage(true);
				updateMessage(md, 'OEM code updated successfully!', true);
				return;
			}
		} catch (error) {
			returnMessage('System error');
			return;
		}
	}

	// Helper function to update message
	function updateMessage(modal, text, show) {
		const messageElement = modal.getContent().find('#oemCodeMessageText');
		messageElement.text(text);
		messageElement.css('font-weight', show ? 'bold' : 'normal');
	}

	// Helper function to show error modal
	function showErrorModal(title, message) {
		var errorModal = new Modal();
		errorModal.setTitle(title);
		errorModal.setContent(message);
		errorModal.addButton([{ 'type': 'ok' }]);
		errorModal.show();
	}
}

var modal_upgradeBiometrics_content = $('#modal_upgradeBiometrics').clone().end().remove();
function openUpgradeFaceBiometricsModal() {
	var md = new Modal();
	var data = MessengerUtil.send('system_information', null, null, false);
	var max_possible_facial_biometrics = parseInt(data.biometrics.max_possible_num_records, 10);
	var max_current_facial_biometrics = parseInt(data.biometrics.max_num_records, 10);
	var serial_equip = data.serial;

	var message_already_acquired = " (already done)";

	md.setTitle("License Mode");
	md.setHTMLContent(modal_upgradeBiometrics_content);
	md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel'
		}
	]);
	if (max_possible_facial_biometrics < 50000) {
		md.getContent().find('#warning_pro_selection_mode').addClass('hide');
	}
	md.show(function(){
		// Tab 1: Upgrade
		md.getContent().find("#inputMaxBiometrics").val(max_possible_facial_biometrics);
		md.getContent().find('#inputMaxBiometrics')[0].readOnly = true;
		md.getContent().find("#inputCurrentMaxBiometrics").val(max_current_facial_biometrics);
		md.getContent().find('#inputCurrentMaxBiometrics')[0].readOnly = true;
		md.getContent().find('#outputSerial').html(serial_equip);

		var initial_state_pro_50k = false;
		var initial_state_pro_100k = false;
		if (max_possible_facial_biometrics < 50000) {
			initial_state_pro_50k = true;
			md.getContent().find('#upgrade_pro_50k').attr('checked','checked');
		} else if (max_possible_facial_biometrics < 100000) {
			initial_state_pro_100k = true;
			md.getContent().find('#upgrade_pro_100k').attr('checked','checked');
		} else {
			// nothing to upgrade
			md.getContent().find('#sectionUpgradePassword').addClass('hide');
			md.getContent().find('#upgrade_pro_options').addClass('hide');
		}

		function addMessageToText (text_elem_id, message) {
			md.getContent().find(text_elem_id).html(md.getContent().find(text_elem_id).text() + message);
		}

		if (initial_state_pro_50k) { // Pro 50k and 100k available to upgrade
			md.getContent().find('#upgrade_pro_50k').prop('disabled', false);
			md.getContent().find('#upgrade_pro_100k').prop('disabled', false);
		} else if (initial_state_pro_100k) { // Only Pro 100k available to upgrade
			md.getContent().find('#upgrade_pro_50k').prop('disabled', true);
			addMessageToText("#upgrade_pro_50k_txt", message_already_acquired);
			md.getContent().find('#upgrade_pro_100k').prop('disabled', false);
		}

		// Tab 2: Configure
		switch (data.biometrics.max_possible_num_records) {
			case 50000:
				md.getContent().find('#pro_operation-100k').prop('disabled', true);
				break;
			case 10000:
				md.getContent().find('#pro_operation-100k').prop('disabled', true);
				md.getContent().find('#pro_operation-50k').prop('disabled', true);
				break;
		}

		switch (data.biometrics.max_num_records) {
			case 100000:
				md.getContent().find('#pro_operation-100k').attr('checked','checked');
				break;
			case 50000:
				if (data.biometrics.max_possible_num_records < 100000) {
					md.getContent().find('#pro_operation_label-100k').html('<b>(requires 100k License Mode!)</b>');
				}
				md.getContent().find('#pro_operation-50k').attr('checked','checked');
				break;
			case 10000:
				md.getContent().find('#pro_operation_label-100k').html('<b>(requires Pro license!)</b>');
				md.getContent().find('#pro_operation_label-50k').html('<b>(requires Pro license!)</b>');
		}
	});

	function upgrade (returnMessage) {
		var password = md.getContent().find('#inputUpgradePassword')[0].value;
		var data = null;

		if (md.getContent().find('#upgrade_pro_50k').is(':checked')) {
			data = MessengerUtil.send('upgrade_fifty_thousand_face_templates', { password: password });
		} else if (md.getContent().find('#upgrade_pro_100k').is(':checked')) {
			data = MessengerUtil.send('upgrade_hundred_thousand_face_templates', { password: password });
		}

		if (!data) {
			returnMessage("Error while upgrading");
			return;
		}
		if (data.error)
			returnMessage("Invalid password");
		else {
			var warning = new Modal();
			warning.setTitle('Reboot is needed');
			warning.setContent('The settings will only be updated after restarting the device. Restart the device now ?');
			warning.addButton([
				{
					'type' : 'ok',
					'callback': function(){
						var time = 60;
						Main.sessionFail({error : 'customError'}, function(){
							setInterval(function(){
								time--;
								if(time == 0)
									window.location = 'login.html';
								$('#countReboot').html(('00' + time).slice(-2));
							}, 1000);

						}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
						MessengerUtil.sendAsync('reboot', null, null, false);
						warning.close();
						return returnMessage({'success': 'Upgrade successful', 'callback': openUpgradeFaceBiometricsModal});
					}
				},
				{
					'type' : 'cancel',
					'callback': function(){
						warning.close();
						return returnMessage({'success': 'Upgrade successful', 'callback': openUpgradeFaceBiometricsModal});
					}
				}
			]);
			warning.show();
		}
	}

	function configure (returnMessage) {
		var proModeSelected;

		if (md.getContent().find('#pro_operation-100k').is(':checked')) {
			proModeSelected = "100k";
		} else if (md.getContent().find('#pro_operation-50k').is(':checked')) {
			proModeSelected = "50k";
		} else if (md.getContent().find('#pro_operation-20k').is(':checked')) {
			proModeSelected = "20k";
		}

		const data = MessengerUtil.send(
			'set_pro_operation_mode_and_reboot',
			{
				pro_operation_mode: proModeSelected
			}
		);

		if (data.error) {
			switch (data.error) {
				case "Expected 20k, 50k or 100k for pro_operation_mode":
					return returnMessage("Selected License Mode is not a valid option!");
				case "Unable to configure operation of Pro Mode due to license":
					return returnMessage("Unable to configure operation of new license mode due to current license!");
				case "Operation of Pro Mode already set":
					return returnMessage("License Mode already set!");
				case "Unknown error setting operation of Pro Mode":
					return returnMessage("Unknown error setting License Mode!");
				default:
					return returnMessage(data.error);
			}
		}

		var rebootAlert = new Modal();
		rebootAlert.setTitle('License Mode');
		rebootAlert.setContent('Rebooting device...');
		rebootAlert.show();
		setTimeout(function() {
			var time = 60;
			MessengerUtil.sendAsync('reboot', null, null, false);
			Main.sessionFail({error : 'customError'}, function(){
				setInterval(function(){
					time--;
					if(time == 0)
						window.location = 'login.html';
					$('#countReboot').html(('00' + time).slice(-2));
				}, 1000);

			}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
		}, 10000);

		return returnMessage(null);
	}
	function save (returnMessage) {
		if (md.getContent().find('#tab1_ProMode').hasClass('active')) {
			return upgrade(returnMessage);
		}
		return configure(returnMessage);
	}
}

var identificationMethodsModal = $('#modal_identificationMethods').clone().end().remove();
function openIdentificationMethodsModal(){
	var md = new Modal();
	md.setTitle('Identification Methods');
	md.setHTMLContent(identificationMethodsModal);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);
	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function() {
			var data = MessengerUtil.send(
				'get_configuration',
				{
					'identifier': [
						'face_identification_enabled',
						'card_identification_enabled',
						'qrcode_identification_enabled',
						'pin_identification_enabled'
					]
				}
			).identifier;
			md.getContent().find('#chkFacialEnabled').parent().bootstrapSwitch()
			md.getContent().find('#chkFacialEnabled').parent().bootstrapSwitch('setState', data.face_identification_enabled === "1");
			md.getContent().find('#chkCardEnabled').parent().bootstrapSwitch();
			md.getContent().find('#chkCardEnabled').parent().bootstrapSwitch('setState', data.card_identification_enabled === "1");
			md.getContent().find('#chkQRCodeEnabled').parent().bootstrapSwitch();
			md.getContent().find('#chkQRCodeEnabled').parent().bootstrapSwitch('setState', data.qrcode_identification_enabled === "1");

		// PIN and ID + Password are mutually exclusive
		md.getContent().find('#chkIdAndPasswordEnabled').parent().bootstrapSwitch();
		md.getContent().find('#chkIdAndPasswordEnabled').parent().bootstrapSwitch('setState', data.pin_identification_enabled === "2");
		md.getContent().find("#chkIdAndPasswordEnabled").parent().parent().on('switch-change', function(e, data) {
			// If enabling ID/Password and PIN is already enabled, show warning dialog
			if (data.value && md.getContent().find('#chkPINEnabled').parent().hasClass('switch-on')) {
				var warning_modal = new Modal();
				warning_modal.setTitle('Identification Methods');
				warning_modal.setContent('You can not enable PIN and ID/Password simulataneously. Do you wish to disable PIN??');
				warning_modal.addButton([
					{
						'type': 'ok',
						'text': 'Yes',
						'callback': function() {
							md.getContent().find('#chkPINEnabled').parent().bootstrapSwitch('setState', false);
							warning_modal.close();
						}
					},
					{
						'type': 'cancel',
						'text': 'No',
						'callback': function() {
							md.getContent().find('#chkIdAndPasswordEnabled').parent().bootstrapSwitch('setState', false);
							warning_modal.close();
						}
					}
				]);
				warning_modal.show();
			}
		});
		md.getContent().find('#chkPINEnabled').parent().bootstrapSwitch();
		md.getContent().find('#chkPINEnabled').parent().bootstrapSwitch('setState', data.pin_identification_enabled === "1");
		md.getContent().find("#chkPINEnabled").parent().parent().on('switch-change', function(e, data) {
			// If enabling PIN and ID/Password is already enabled, show warning dialog
			if (data.value && md.getContent().find('#chkIdAndPasswordEnabled').parent().hasClass('switch-on')) {
				var warning_modal = new Modal();
				warning_modal.setTitle('Identification Methods');
				warning_modal.setContent('You can not enable PIN and ID/Password simulataneously. Do you wish to disable ID/Password??');
				warning_modal.addButton([
					{
						'type': 'ok',
						'text': 'Yes',
						'callback': function() {
							md.getContent().find('#chkIdAndPasswordEnabled').parent().bootstrapSwitch('setState', false);
							warning_modal.close();
						}
					},
					{
						'type': 'cancel',
						'text': 'No',
						'callback': function() {
							md.getContent().find('#chkPINEnabled').parent().bootstrapSwitch('setState', false);
							warning_modal.close();
						}
					}
				]);
				warning_modal.show();
			}
		});
		});
	}

	function save(returnMessage) {

		var facialEnabled = md.getContent().find('#chkFacialEnabled').parent().hasClass('switch-on') ? '1' : '0';
		var cardEnabled = md.getContent().find('#chkCardEnabled').parent().hasClass('switch-on') ? '1' : '0';
		var qrCodeEnabled = md.getContent().find('#chkQRCodeEnabled').parent().hasClass('switch-on') ? '1' : '0';
		var pinEnabled = md.getContent().find('#chkPINEnabled').parent().hasClass('switch-on') ? '1' : (md.getContent().find('#chkIdAndPasswordEnabled').parent().hasClass('switch-on') ? '2' : '0');

		var data = MessengerUtil.send(
			'set_configuration',
			{
				identifier: {
					face_identification_enabled: facialEnabled,
					card_identification_enabled: cardEnabled,
					qrcode_identification_enabled: qrCodeEnabled,
					pin_identification_enabled: pinEnabled
				}
			}
		)
		return returnMessage(data.error != undefined ? data.error : null);
	}
}

var identificationModeModal = $('#modal_identificationMode').clone().end().remove();
function openIdentificationModeModal() {
	var md = new Modal();
	md.setTitle('Identification Mode');
	md.setHTMLContent(identificationModeModal);
	md.addButton([
		{
		'type': 'save',
		'callback': save
		},
		{
		'type': 'cancel'
		}
	]);
	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	var identificationMode = null;
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function() {
			var data = MessengerUtil.send(
			'get_configuration',
			{
				'identifier': ['multi_factor_authentication'],
				'general': ['waiting_face_message']
			}
			);

			md.getContent().find('#waiting_face_message').val(data.general.waiting_face_message);

			switch(data.identifier.multi_factor_authentication) {
			case "2":
				identificationMode = "2";
				md.getContent().find('#btnTemplateOncard').addClass('active');
				md.getContent().find('#waiting_face_message').closest('.control-group').show();
				break
			case "1":
				identificationMode = "1";
				md.getContent().find('#btn1to1').addClass('active');
				md.getContent().find('#waiting_face_message').closest('.control-group').show();
				break
			case "0":
			default:
				identificationMode = "0";
				md.getContent().find('#btn1toN').addClass('active');
				md.getContent().find('#waiting_face_message').closest('.control-group').hide();
				break
			}

			md.getContent().find('#btn1toN').on('click', function() {
				identificationMode = "0";
				md.getContent().find('#btn1toN').addClass('active');
				md.getContent().find('#btn1to1').removeClass('active');
				md.getContent().find('#btnTemplateOncard').removeClass('active');
				md.getContent().find('#waiting_face_message').closest('.control-group').hide();
			});
			md.getContent().find('#btn1to1').on('click', function() {
				identificationMode = "1";
				md.getContent().find('#btn1toN').removeClass('active');
				md.getContent().find('#btn1to1').addClass('active');
				md.getContent().find('#btnTemplateOncard').removeClass('active');
				md.getContent().find('#waiting_face_message').closest('.control-group').show();
			});
			md.getContent().find('#btnTemplateOncard').on('click', function() {
				identificationMode = "2";
				md.getContent().find('#btn1toN').removeClass('active');
				md.getContent().find('#btn1to1').removeClass('active');
				md.getContent().find('#btnTemplateOncard').addClass('active');
				md.getContent().find('#waiting_face_message').closest('.control-group').show();
			});
		});
	}

	function save(returnMessage) {
		var waitingFaceMessage = md.getContent().find('#waiting_face_message').val();

		const data = MessengerUtil.send(
			'set_configuration',
			{
				identifier: {
					multi_factor_authentication: identificationMode
				},
				general: {
					waiting_face_message: waitingFaceMessage
				}
			}
		);
		if (data.error) {
			return returnMessage(ret1.error);
		}
		return returnMessage(null);
	}
}

var licenseModal = $('#modal_license').clone().end().remove();
function openLicenseModal(){
	var md = new Modal();
	md.setTitle('License');
	md.setHTMLContent(licenseModal);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);
	var license;
	md.show(function(){
		md.getContent().find('#inputMode')[0].readOnly = true;
		md.getContent().find('#inputMaxUsers')[0].readOnly = true;
		md.getContent().find('#inputMaxDevices')[0].readOnly = true;

		// TODO: Utilizar Main.getInfo()
		var data = MessengerUtil.send('system_information', null, null, false);
		var mode;
		if(data.license.type === 1)
			mode = "Server";
		else
			mode = "Client";
		md.getContent().find("#inputMode").val(mode);
		md.getContent().find("#inputMaxUsers").val(parseInt(data.license.users));
		md.getContent().find("#inputMaxDevices").val(parseInt(data.license.device));
		md.getContent().find("#inputLicenseFile").on('change', function () {
			var file = $('#inputLicenseFile')[0].files[0];
			if (!file) {
				license = null;
				return;
			}

			if ((file.size ? file.size : file.fileSize) > 60) {
				license = { error: "Invalid license file" }
				return;
			}

			var reader = new FileReader();
			reader.onloadend = function (e) {
				license = { license: e.target.result };
			}
			reader.readAsText(file, "UTF-8");
		});
	});
	function save (returnMessage) {
		if (!license || !license.license || license.error) {
			returnMessage(
					license && license.error ?
					license.error :
					"Choose a valid license file");
			return;
		}

		var data = MessengerUtil.send('license_change', { license: license.license });
		if (data.error)
				returnMessage("Invalid license file");
		else
				returnMessage({'success' : 'License altered successfully', 'callback' : openLicenseModal});
	}
}


function openMasterModal() {
	var md = new Modal();
	md.setTitle('Change Master Password');
	md.setHTMLContent($('#modal_changeMaster'));
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show(function(){
		new Validate($(md.getContent()), validatePassword);
	});

	function save(returnMessage) {
		var data;
		var pass = md.getContent().find("#input_master_passwd1").val();
		var pass2 = md.getContent().find("#input_master_passwd2").val();

		if(!twoPassEquals(pass, pass2)) {
			returnMessage('Provided passwords do not match!');
			return;
		}
		if (validatePassword({master_password: pass}).length) {
			returnMessage('Invalid input data');
			return;
		}

		data = MessengerUtil.send('master_password', {'password' : pass });

		if (!data.error) {
			data.success = "Data saved successfully! Warning: this value can be overwritten by the integrator software!"
		}
		returnMessage(data);
	}

	function validatePassword(data){
		var result = [];

		if('master_password' in data){
			if(data.master_password.length > 0 && isNaN(data.master_password)) {
				result.push('Password must be numeric');
			}
		}
		return result;
	}
}

var fotoRemoved = false
var fotoUploaded = false
var logo_content = $('#modal_changeLogo').clone().end().remove();
function openLogoModal() {
	var md = new Modal();
	md.setTitle('Company Logo');
	md.setHTMLContent(logo_content);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
		var previousTabId = $(e.relatedTarget).attr('href').match(/\d+$/)[0];
		if (fotoUploaded) {
			MessengerUtil.sendFile('logo_change', btFoto, 'id=' + previousTabId);
		} else if (fotoRemoved){
			MessengerUtil.send('logo_destroy', {}, 'id=' + previousTabId);
		} 

		fotoUploaded = false
		fotoRemoved = false
	});

	function save(returnMessage) {
		var show_logo = 0;
		var activeTabIndex = -1;

		for (var i = 1; i <= 8; i++) {
			if (md.getContent().find('#enabled_logo' + i).parent().hasClass('switch-on')) {
				show_logo = i;
				break;
			}
		}

		md.getContent().find('.tab-pane').each(function(index) {
			if ($(this).hasClass('active')) {
				activeTabIndex = index+1;
				return false;
			}
		});
		MessengerUtil.send(
			'set_configuration',
			{
				general: {
					show_logo: show_logo.toString()
				}
			}
		)
		if (fotoUploaded) {
			MessengerUtil.sendFile('logo_change', btFoto, 'id=' + activeTabIndex);
		} else if (fotoRemoved){
			MessengerUtil.send('logo_destroy', {}, 'id=' + activeTabIndex);
		} 

		fotoUploaded = false
		fotoRemoved = false
		returnMessage(null);
	}

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		var data = MessengerUtil.send(
			'get_configuration',
			{
				general: ['show_logo']
			}
		);
		if (data.general.show_logo !== -1) {
			for (var i = 1; i <= 8; i++) {
				md.getContent().find('#enabled_logo' + i).parent().bootstrapSwitch();
				md.getContent().find('#enabled_logo' + i).parent().bootstrapSwitch('setState', i === parseInt(data.general.show_logo));
			}
		} else {
			for (var i = 1; i <= 8; i++) {
				md.getContent().find('#enabled_logo' + i).parent().bootstrapSwitch();
				md.getContent().find('#enabled_logo' + i).parent().bootstrapSwitch('setState', false);
			}
		}
	
	
		function initCanvas(tabIndex) {
			canvas = document.getElementById('canvas' + tabIndex);
			ctx = canvas.getContext('2d');
	
			var image = new Image;
			image.onload = function () {
				canvas.width = image.width;
				canvas.height = image.height;
				ctx.drawImage(image, 0, 0, image.width, image.height);
			};
			image.onerror = function () {
				canvas.height = 100;
				canvas.width = 200;
				ctx.font = "20px Georgia";
				ctx.fillText("No image", 50, 70);
			};
			image.src = ('/logo.fcgi?id=' + (tabIndex));
		}
	
		md.show(function() {
	
			md.getContent().find('.nav-tabs a').on('shown.bs.tab', function(e) {
				var activeTab = $(e.target).attr('href');
				var tabIndex = activeTab.replace('#tab', '').replace('_logo', ''); 
				initCanvas(tabIndex);
			});
	
			initCanvas(1);
		});
	
		function disableOtherSliders(activeIndex) {
			for (let j = 1; j <= 8; j++) {
				if (j !== activeIndex) {
					md.getContent().find('#enabled_logo' + j).parent().bootstrapSwitch('setState', false);
				}
			}
		}

		$(document).ready(function() {
			for (let i = 1; i <= 8; i++) {
				$('#enabled_logo' + i).on('change', function() {
					if ($(this).is(':checked')) {
						disableOtherSliders(i);
					}
				});
			}
		});
	}
}

var remoteDiag = $('#modal_remoteDiagnosticsEdit').clone().end().remove();
function openRemoteDiagnostics(){
	var md = new Modal();
	md.setTitle('Remote Diagnostics Tools');
	md.setHTMLContent(remoteDiag);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	md.show(function(){

		var data = MessengerUtil.send(
			'get_configuration',
			{
				'general': ['ssh_enabled', 'url_reboot_enabled'],
				'snmp_agent': ['snmp_enabled', 'snmp_trap_manager_ip', 'snmp_trap_community']
			}
		);
		md.getContent().find('#chkButtonSSH').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonSSH').parent().bootstrapSwitch('setState', data.general.ssh_enabled === '1');
		md.getContent().find('#chkButtonURLReboot').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonURLReboot').parent().bootstrapSwitch('setState', data.general.url_reboot_enabled === '1');
		md.getContent().find('#chkButtonSNMP').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonSNMP').parent().bootstrapSwitch('setState', data.snmp_agent.snmp_enabled === '1');
		md.getContent().find('#txtSNMPManagerIP').val(data.snmp_agent.snmp_trap_manager_ip || '');
		md.getContent().find('#txtSNMPCommunity').val(data.snmp_agent.snmp_trap_community || '');
	});

	function save (returnMessage) {
		let ssh_enabled = md.getContent().find('#chkButtonSSH').parent().bootstrapSwitch('status')? "1" : "0";
		let url_reboot_enabled = md.getContent().find('#chkButtonURLReboot').parent().bootstrapSwitch('status')? "1" : "0";
		let snmp_enabled = md.getContent().find('#chkButtonSNMP').parent().bootstrapSwitch('status')? "1" : "0";
		let snmp_trap_manager_ip = md.getContent().find('#txtSNMPManagerIP').val();
		let snmp_trap_community = md.getContent().find('#txtSNMPCommunity').val();
		
		let data = MessengerUtil.send(
			'set_configuration',
			{
				'general':
				{
					'ssh_enabled': ssh_enabled,
					'url_reboot_enabled' : url_reboot_enabled
				},
				'snmp_agent':
				{
					'snmp_enabled' : snmp_enabled,
					'snmp_trap_manager_ip': snmp_trap_manager_ip,
					'snmp_trap_community': snmp_trap_community
				}
			}
		);
		returnMessage(data);
	}
}

function openHideNameModal(){
	var md = new Modal();
	md.setTitle('Hide Name on Access');
	md.setHTMLContent($('#modal_hideNameEdit'));
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);

	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function(){
			var data = MessengerUtil.send(
				'get_configuration',
				{
					'general': ['hide_name_on_identification']
				}
			);
			md.getContent().find('#chkButtonHideName').parent().bootstrapSwitch();
			md.getContent().find('#chkButtonHideName').parent().bootstrapSwitch('setState', data.general.hide_name_on_identification == '1');
		});
	}

	function save (returnMessage) {
		let hide_name = md.getContent().find('#chkButtonHideName').parent().bootstrapSwitch('status')? "1" : "0";
		let data = MessengerUtil.send(
			'set_configuration',
			{
				'general': {'hide_name_on_identification': hide_name}
			}
		);
		returnMessage(data);
	}
}

function openScramblePadModal(){
	var md = new Modal();
	md.setTitle('Scramble Pad');
	md.setHTMLContent($('#modal_scramblePadEdit'));
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function(){

		var data = MessengerUtil.send(
			'get_configuration',
			{
				'general': ['scramble_pad']
			}
		);
		md.getContent().find('#chkButtonScramblePad').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonScramblePad').parent().bootstrapSwitch('setState', data.general.scramble_pad == '1');
		});
	}

	function save (returnMessage) {
		let hide_name = md.getContent().find('#chkButtonScramblePad').parent().bootstrapSwitch('status')? "1" : "0";
		let data = MessengerUtil.send(
			'set_configuration',
			{
				'general': {'scramble_pad': hide_name}
			}
		);
		returnMessage(data);
	}
}



var modal_pushiDCloud = $('#modal_PushiDCloud').clone().end().remove();
function openPushiDCloud(){
	async function warningnoAddressScreen() {
		var response = false;
		await new Promise(function(resolve, reject) {
			var warning = new Modal();
			warning.setTitle('Atenção!');
			warning.setContent('Because you do not have any server address, iDCloud will be disabled. Would you like to proceed?');
			warning.addButton([
				{
					'type' : 'ok',
					'callback': function(){
						response = true;
						warning.close();
						resolve();
					}
				},
				{
					'type' : 'cancel',
					'callback': function(){
						response = false;
						warning.close();
						resolve();
					}
				}
			]);
			warning.show();
		});
		return response;
	}

	var md = new Modal();
	var data = MessengerUtil.send('system_information', null, null, false);
	var iDCloud_code = data.iDCloud_code;
	var serial_number = data.serial;
	md.setTitle('iDCloud');
	md.setHTMLContent(modal_pushiDCloud);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'ok',
			'text' : 'Change iDCloud Code',
			'callback': changeiDCloudCode
		},
		{
			'type' : 'cancel'
		}
	]);

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function(){
			var data = MessengerUtil.send(
				'get_configuration',
				{
				'push_server': ['push_remote_address', 'push_request_period']
				}
			).push_server;

			if (data.push_remote_address.indexOf('.idsecure.com.br') !== -1 ||
					data.push_remote_address.indexOf('.controlid.com.br') !== -1 ||
					data.push_remote_address.indexOf('.rhid.com.br') !== -1) {
				md.getContent().find('#pushIdcloudMode').attr('checked', 'checked');
				md.getContent().find('#nav_tab2_iDCloud').show();
				oniDCloudChanges('idcloud');
			} else if (data.push_remote_address === '') {
				md.getContent().find('#pushDeactivated').attr('checked', 'checked');
				md.getContent().find('#nav_tab2_iDCloud').hide();
				oniDCloudChanges('deactivated');
			} else {
				md.getContent().find('#pushCustomMode').attr('checked', 'checked');
				md.getContent().find('#nav_tab2_iDCloud').show();
				oniDCloudChanges('custom');
			}

			md.getContent().find('#iDCloud_code_value').html(iDCloud_code);
			md.getContent().find('#iDCloud_serial_value').html(serial_number);

			md.getContent().on('change', 'input[name=push_mode]', function() {
				if (md.getContent().find('#pushDeactivated').is(':checked')) {
					oniDCloudChanges('deactivated');
				} else if (md.getContent().find('#pushIdcloudMode').is(':checked')) {
					oniDCloudChanges('idcloud');
				} else if (md.getContent().find('#pushCustomMode').is(':checked')) {
					oniDCloudChanges('custom');
				}
			});

			md.getContent().find('#inputPushAddress')[0].value = data.push_remote_address;
			md.getContent().find('#inputPushPeriod')[0].value = data.push_request_period;
			new Validate($(md.getContent()), validatePush);
		});

		function oniDCloudChanges (pushMode) {
			var data = MessengerUtil.send(
				'get_configuration',
				{
				'push_server': ['push_remote_address', 'push_request_period']
				}
			).push_server;
			const iDCloudAddress = 'https://push.idsecure.com.br/api'
			const pushAddress = data.push_remote_address;
			const pushPeriod = data.push_request_period;

			if (pushMode === 'idcloud') {
				md.getContent().find('#inputPushAddress')[0].value = iDCloudAddress;
				md.getContent().find('#inputPushAddress').prop('disabled', true);
				md.getContent().find('#inputPushPeriod')[0].value = pushPeriod;
				md.getContent().find('#nav_tab2_iDCloud').show();
			} if (pushMode === 'custom') {
				md.getContent().find('#inputPushAddress')[0].value = pushAddress;
				md.getContent().find('#inputPushAddress').prop('disabled', false);
				md.getContent().find('#inputPushPeriod')[0].value = pushPeriod;
				md.getContent().find('#nav_tab2_iDCloud').show();
			} else if (pushMode === 'deactivated') {
				md.getContent().find('#inputPushAddress')[0].value = '';
				md.getContent().find('#nav_tab2_iDCloud').hide();
			}
		}
	}

	function changeiDCloudCode () {
		MessengerUtil.send('change_idcloud_code', null, null, false);
		var data2 = MessengerUtil.send('system_information', null, null, false);
		var iDCloud_code2 = data2.iDCloud_code;
		md.getContent().find('#iDCloud_code_value').html(iDCloud_code2);

		var md2 = new Modal();
		md2.setTitle('iDCloud');
		md2.setContent("iDCloud Code changed successfully!");
		md2.addButton([
			{
				'type' : 'ok',
				'text' : 'Ok'
			}
		]);
		md2.show();
	}

	async function save (returnMessage) {
		var address = md.getContent().find('#inputPushAddress')[0].value;
		var period = md.getContent().find('#inputPushPeriod')[0].value;

		if (validatePush({ address: address , period : period }).length){
			returnMessage('Invalid address or period');
			return;
		}

		if (address === "" && !md.getContent().find('#pushDeactivated').is(':checked')) {
			var keep_no_address = await warningnoAddressScreen();

			if (!keep_no_address) {
				returnMessage('Operation cancelled!');
				return;
			}
		}

		var data = MessengerUtil.send('set_configuration', {
			push_server:	{
				push_remote_address: address,
				'push_request_timeout': "30000",
				push_request_period: period
			}
		});

		return returnMessage(data.error != undefined ? data.error : null);
	}

	function validatePush(data) {
		var result = [];

		if('address' in data){
			// currently there are no restrictions to the push server address; empty just means disabled
			// result.push('Enter a valid value');
		}

		if('period' in data){
			if(ValidateUtil.isEmpty(data['period']) || ! ValidateUtil.isNumber(data['period']) || ! Number.isInteger(parseFloat(data['period']))|| data['period'] < 0){
				result.push('Inform a valid time');
			}
		}

		return result;
	}
}

async function warningAdvancedScreen() {
	var warning = new Modal();
	warning.setTitle('Attention!');
	warning.setContent('Changes to the advanced settings may interfere with the correct functioning of iDCloud. Would you like to proceed?');
	warning.addButton([
		{
			'type' : 'ok',
			'callback': function(){
				warning.close();
			}
		}
	]);
	warning.show();
}

var anti_passbackModal = $('#modal_Antipassback').clone().end().remove();
function antipassbackModal(){
	var md = new Modal();
	md.setTitle('Anti-Passback by Time');
	md.setHTMLContent(anti_passbackModal);

	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	function save(returnMessage) {

		var antiPassbackEnabled = md.getContent().find('#chkButtonAntipassbackStatus').parent().bootstrapSwitch('status') ? "1" : "0"
		var antiPassbackDuration = isNaN(parseInt(md.getContent().find('#activationTime')[0].value)) ? "" : (60*parseInt(md.getContent().find('#activationTime')[0].value)).toString();

		if(antiPassbackDuration === ""){
			return returnMessage({error: "Do not leave the field blank. You must enter the minimum time between accesses!"});
		}

		MessengerUtil.send(
			'set_configuration',
			{
				'identifier': {
					'antipassback_enabled': antiPassbackEnabled,
					'antipassback_mode': 'timed',
					'antipassback_timeout': antiPassbackDuration
				}
			}
		);

		drawRelaysMenu();
		return returnMessage(null);
	}

	md.show(function(){
		var data = MessengerUtil.send(
			'get_configuration',
			{
				'identifier': ['antipassback_enabled', 'antipassback_timeout']
			}
		);
		md.getContent().find('#chkButtonAntipassbackStatus').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonAntipassbackStatus').parent().bootstrapSwitch('setState', data.identifier.antipassback_enabled == '1');
		md.getContent().find('#activationTime')[0].value = Math.round(data.identifier.antipassback_timeout/60);
	});
}

var anti_passbackNextModal = $('#modal_Antipassback_Next').clone().end().remove();
function antipassbackNextModal(){
	var md = new Modal();
	md.setTitle('Anti-Passback');
	md.setHTMLContent(anti_passbackNextModal);

	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	function save(returnMessage) {
		var antiPassbackEnabled = md.getContent().find('#anti_passback_disable').is(':checked') ? "0" : "1";
		var antiPassbackMode = '';
		if (md.getContent().find('#anti_passback_daily').is(':checked')) {
			antiPassbackMode = 'daily_catra';
		}
		else if (md.getContent().find('#anti_passback_timed').is(':checked')) {
			antiPassbackMode = 'timed_catra';
		}
		var antiPassbackDuration = isNaN(parseInt(md.getContent().find('#activationTime_Next')[0].value)) ? "" : (60*parseInt(md.getContent().find('#activationTime_Next')[0].value)).toString();
		var data = MessengerUtil.send(
			'set_configuration',
			{
				'identifier': {
					'antipassback_enabled': antiPassbackEnabled,
					'antipassback_mode': antiPassbackMode,
					'antipassback_timeout': antiPassbackDuration
				}
			}
		)
		return returnMessage(data.error != undefined ? data.error : null);
	}

	md.show(function(){
		var data = MessengerUtil.send(
			'get_configuration',
			{
				'identifier': ['antipassback_enabled', 'antipassback_mode', 'antipassback_timeout']
			}
		);
		if (data.identifier.antipassback_enabled === '1') {
			switch (data.identifier.antipassback_mode) {
				case "daily_catra":
					md.getContent().find('#anti_passback_daily').attr('checked', 'checked');
					break;
				case "timed_catra":
					md.getContent().find('#anti_passback_timed').attr('checked', 'checked');
					break;
				default:
					md.getContent().find('#anti_passback_idefinite').attr('checked', 'checked');
			}
		} else {
			// Anti-passback disabled
			md.getContent().find('#anti_passback_disable').attr('checked', 'checked');
		}
		md.getContent().find('#activationTime_Next')[0].value = Math.round(data.identifier.antipassback_timeout/60);
	});
}

function GeraBytesFotos(img)
{
	img = atob(img.split(",")[1]);
	btFoto = new Uint8Array(img.length);
	for (var i = 0; i < img.length; i++) {
		btFoto[i] = img.charCodeAt(i);
	}
}

function RemoverFoto(btn)
{
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	canvas.height = 100;
	canvas.width = 200;
	ctx.font="20px Georgia";
	ctx.fillText("No image",50,70);
	btFoto = new Array();
	btFoto[0] = 1;
}

function GeraBytesFotosSip(img) {
	img = atob(img.split(",")[1]);
	btFotoSip = new Uint8Array(img.length);
	for (var i = 0; i < img.length; i++) {
		btFotoSip[i] = img.charCodeAt(i);
	}
}

function GeraBytesFotosStreaming(img)
{
	img = atob(img.split(",")[1]);
	btFotoStreaming = new Uint8Array(img.length);
	for (var i = 0; i < img.length; i++) {
		btFotoStreaming[i] = img.charCodeAt(i);
	}
}

function RemoverFotoSip(btn)
{
	ctx_sip.clearRect(0, 0, canvas_sip.width, canvas_sip.height);
	canvas_sip.height = 100;
	canvas_sip.width = 200;
	ctx_sip.font="20px Georgia";
	ctx_sip.fillText("No image",50,70);
	btFotoSip = new Array();
	btFotoSip[0] = 1;
}

function RemoverFotoStreaming(btn)
{
	ctx_streaming.clearRect(0, 0, canvas_streaming.width, canvas_streaming.height);
	canvas_streaming.height = 100;
	canvas_streaming.width = 200;
	ctx_streaming.font="20px Georgia";
	ctx_streaming.fillText("No image",50,70);
	btFotoStreaming = new Array();
	btFotoStreaming[0] = 1;
}

var MAX_WIDTH = 400;
var MAX_HEIGHT = 300;

function UploadFotoSip(btn) {
	$('#uplFotoSip').change(function (e) {
		var file = e.originalEvent.srcElement.files[0];
		//var reader = new FileReader();
		var image = new Image;
		image.onload = function () {
			// usa o canvas para redimensionar a foto

			// Calcula o novo tamanho da imagem (caso ela seja muito grande)
			var alt = image.height;
			var lar = image.width;
			if (lar > MAX_WIDTH || alt > MAX_HEIGHT) {
				if (lar > MAX_WIDTH) {
					lar = MAX_WIDTH;
					alt = parseInt(lar * (image.height / image.width));
				}
				if (alt > MAX_HEIGHT) {
					alt = MAX_HEIGHT;
					lar = parseInt(alt * (image.width / image.height));
				}
			}
			ctx_sip.clearRect(0, 0, canvas_sip.width, canvas_sip.height);
			canvas_sip.width = lar;
			canvas_sip.height = alt;
			ctx_sip.clearRect(0, 0, lar, alt);
			ctx_sip.drawImage(image, 0, 0, lar, alt);
			var img = canvas_sip.toDataURL("image/png", 0.5);
			// grava a foto redimensionada
			GeraBytesFotosSip(img);
		}
		image.src = URL.createObjectURL(file);
	});
	$('#uplFotoSip').click();
}

function UploadFotoStreaming(btn) {
	$('#uplFotoStreaming').off('change').on('change', function (e) {
		var file = e.originalEvent.srcElement.files[0];
		var image = new Image;
		image.onload = function () {
			var alt = image.height;
			var lar = image.width;
			var proportion = lar/alt;
			console.log("Proportion: "+ proportion)
			if(proportion > 5.5 || proportion < 4.5){
				alert('The recommended proportion for logo dimensions is 5: 1');
			}
			if (lar > MAX_WIDTH || alt > MAX_HEIGHT) {
				if (lar > MAX_WIDTH) {
					lar = MAX_WIDTH;
					alt = parseInt(lar * (image.height / image.width));
				}
				if (alt > MAX_HEIGHT) {
					alt = MAX_HEIGHT;
					lar = parseInt(alt * (image.width / image.height));
				}
			}
			console.log("Height : "+ alt + " Width: " + lar)
			ctx_streaming.clearRect(0, 0, canvas_streaming.width, canvas_streaming.height);
			canvas_streaming.width = lar;
			canvas_streaming.height = alt;
			ctx_streaming.clearRect(0, 0, lar, alt);
			ctx_streaming.drawImage(image, 0, 0, lar, alt);
			var img = canvas_streaming.toDataURL("image/png", 0.5);
			// grava a foto redimensionada
			GeraBytesFotosStreaming(img);
		}
		image.src = URL.createObjectURL(file);
	});
	$('#uplFotoStreaming').click();
}

function UploadFoto(btn) {
	var tabIndex = btn.closest('.tab-pane').id.replace('tab_', '').replace('logo', '');
    var fileInput = document.getElementById('uplFoto' + tabIndex);

    $('#uplFoto'+tabIndex).change(function (e) {
        var file = e.originalEvent.srcElement.files[0];

		var image = new Image();
		image.onload = function () {

			var alt = image.height;
			var lar = image.width;
			if (lar > MAX_WIDTH || alt > MAX_HEIGHT) {
				if (lar > MAX_WIDTH) {
					lar = MAX_WIDTH;
					alt = parseInt(lar * (image.height / image.width));
				}
				if (alt > MAX_HEIGHT) {
					alt = MAX_HEIGHT;
					lar = parseInt(alt * (image.width / image.height));
				}
			}
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			canvas.width = lar;
			canvas.height = alt;
			ctx.clearRect(0, 0, lar, alt);
			ctx.drawImage(image, 0, 0, lar, alt);
			var img = canvas.toDataURL("image/png", 0.5);
			GeraBytesFotos(img);
		};
		image.src = URL.createObjectURL(file);
		fotoUploaded = true

    });

    $('#uplFoto'+tabIndex).click();
}

var modal_dateEdit = $('#modal_dateEdit').clone().end().remove();
function openDateModal() {

	var md = new Modal();
	md.setTitle('Data and Time');
	md.setHTMLContent(modal_dateEdit);
	md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel'
		},
		{
			'type': 'ok',
			'text': 'Import date and time from PC',
			'callback': fetchTimePC
		}
	]);

	console.log("openDateModal")

	function save(returnMessage) {
		if (md.getContent().find('#inputNtp1').val() == "") {
			var data = { error : 'NTP server field cannot be empty.'};
			returnMessage(data);
			return ;
		} else if (md.getContent().find('#chkEnableNtp').parent().hasClass('switch-on') &&
			((md.getContent().find("#inputInitSummerTime")[0].value == "" && md.getContent().find("#inputFinalSummerTime")[0].value != "") ||
			(md.getContent().find("#inputInitSummerTime")[0].value != "" && md.getContent().find("#inputFinalSummerTime")[0].value == ""))) {
			var data = { error : 'Start and end required for daylight saving time.'};
			returnMessage(data);
			return ;
		} else {
			MessengerUtil.send('set_configuration', {
				"ntp": {
					"enabled": md.getContent().find('#chkEnableNtp').parent().hasClass('switch-on') ? "1" : "0",
					"timezone": md.getContent().find("#timezoneDropdown").val()
				}
			});
			MessengerUtil.send('set_ntp_server', {
				"server1": md.getContent().find('#inputNtp1').val(),
				"server2": md.getContent().find('#inputNtp2').val()
			});
		}

		var clock12hFormat = md.getContent().find('#chkClock24hFormat').parent().hasClass('switch-off');
		let monthDayYearFormat = false;
		if (md.getContent().find('#chkMonthDayYearFormat').is(':checked')) {
			monthDayYearFormat = true;
		} else if (md.getContent().find('#chkDayMonthYearFormat').is(':checked')) {
			monthDayYearFormat = false;
		}
		const actual_month_day_year_format = MessengerUtil.send('get_configuration', { general: ['month_day_year_format'] }).general.month_day_year_format;
		//DATA E HORA
		if (!dateFormatCorrect(md.getContent().find('#inputDate').val(), actual_month_day_year_format == "1") || !timeFormatCorrect(md.getContent().find('#inputTime').val(), clock12hFormat))
			return { error: "Invalid date or time." }

		if (actual_month_day_year_format == "0") {
			var currDay = parseInt(md.getContent().find('#inputDate').val().substr(0, 2));
			var currMonth = parseInt(md.getContent().find('#inputDate').val().substr(3, 2));
		} else {
			var currDay = parseInt(md.getContent().find('#inputDate').val().substr(3, 2)) ;
			var currMonth = parseInt(md.getContent().find('#inputDate').val().substr(0, 2));
		}
		var currYear = parseInt(md.getContent().find('#inputDate').val().substr(6, 4));
		var currHour = parseInt(md.getContent().find('#inputTime').val().substr(0, 2));
		if (clock12hFormat) {
			currHour %= 12;
			if (md.getContent().find('#inputTime').val().substr(9, 2) == 'PM') {
				currHour += 12;
			}
		}
		var currMin = parseInt(md.getContent().find('#inputTime').val().substr(3, 2));
		var currSec = parseInt(md.getContent().find('#inputTime').val().substr(6, 2));
		////console.debug(currHour + " - " + currMin + " - " + currSec);

		//HORÁRIO DE VERÃO
		var summerTimeInit = parseDateWebToXml(md.getContent().find("#inputInitSummerTime")[0].value);
		var summerTimeFinal = parseDateWebToXml(md.getContent().find("#inputFinalSummerTime")[0].value);

		if (actual_month_day_year_format == "1") {
			summerTimeInit = summerTimeInit.substr(2,2) + summerTimeInit.substr(0,2) + summerTimeInit.substr(4,4);
			summerTimeFinal = summerTimeFinal.substr(2,2) + summerTimeFinal.substr(0,2) + summerTimeFinal.substr(4,4)
		}

		var today = new Date();
		var todayInt = parseInt(today.toISOString().slice(0,10).replace('-', '').replace('-', ''));

		var summerTimeInitInt = parseInt(summerTimeInit.substr(4,4) + summerTimeInit.substr(2,2) + summerTimeInit.substr(0,2));
		var summerTimeFinalInt = parseInt(summerTimeFinal.substr(4,4) + summerTimeFinal.substr(2,2) + summerTimeFinal.substr(0,2));

		if (todayInt > summerTimeFinalInt) {
			returnMessage('End date of daylight saving time is earlier than the current date');
			return;
		}

		var ajaxResponse;
		var data = MessengerUtil.send('set_configuration', {
			general: {
				daylight_savings_time_start: summerTimeInit,
				daylight_savings_time_end: summerTimeFinal,
				clock_12h_format: (clock12hFormat ? "1" : "0"),
				month_day_year_format: (monthDayYearFormat  ? "1" : "0")
			}
		});
		if (data.error != undefined)
			ajaxResponse = data.error;
		else {
			ajaxResponse = true;
		}

		if (ajaxResponse == true) {
			data = MessengerUtil.send('set_system_time', {
				day: currDay,
				month: currMonth,
				year: currYear,
				hour: currHour,
				minute: currMin,
				second: currSec
			});

			if (data.error != undefined)
				ajaxResponse = data.error
			else
				ajaxResponse = null;
		}
		returnMessage(ajaxResponse);
	}

	function fetchTimePC(returnMessage) {
		console.log("fetchTimePC")

		if (md.getContent().find('#chkEnableNtp').parent().hasClass('switch-on')) {
			var modal = new Modal();
			modal.setTitle('Data and Time');
			modal.setContent('Option unavailable with NTP enabled.');
			modal.addButton([
				{
					'type': 'ok'
				}
			]);
			modal.show();
		} else {
			var today = new Date();
			var time = new Timepicker();
			var date = new Datepicker();
			time.showSeconds = true;
			time.clock12hFormat = md.getContent().find('#chkClock24hFormat').parent().hasClass('switch-off');
			time.init(md.getContent().find('#inputTime'));
			time.setPCDate(today);
			date.monthDayYearFormat = md.getContent().find('#chkMonthDayYearFormat').is(':checked');
			date.init(md.getContent().find('#inputDate'));
			date.setDate(today);
		}
	}

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);

	md.show(function () {
		console.log("openDateModal5")
		const ntp_message = MessengerUtil.send('get_configuration', { "ntp": ["enabled", "timezone"] }).ntp;
		const ntp_server_message = MessengerUtil.send('get_ntp_server', {});
		const clock_format_message = MessengerUtil.send('get_configuration', { general: ['clock_12h_format', 'month_day_year_format'] }).general;
		let server1 = ntp_server_message.server1;
		let server2 = "";
		if (ntp_server_message.server2 !== undefined) {
			server2 = ntp_server_message.server2;
		}
		md.getContent().find('#inputNtp1')[0].value = server1;
		md.getContent().find('#inputNtp2')[0].value = server2;
		let timezone = ntp_message.timezone;
		const dropdown = md.getContent().find("#timezoneDropdown");

		for (let i = -12; i <= 12; i++) {
			let offset = i > 0 ? '+' + i : String(i);
			if (i == 0) {
				offset = "";
			}
			const label = 'UTC' + offset;
			const option = $('<option></option>').val(label).text(label);
			if (timezone === label) {
				option.prop("selected", true);
			}
			dropdown.append(option);
		}
		md.getContent().find('#chkEnableNtp').parent().bootstrapSwitch();
		if (ntp_message.enabled == "1") {
			md.getContent().find('#chkEnableNtp').parent().bootstrapSwitch('setState', 1);
			md.getContent().find('#inputDate').prop("disabled", true);
			md.getContent().find('#inputTime').prop("disabled", true);
			md.getContent().find('#inputNtp1').prop("disabled", false);
			md.getContent().find('#inputNtp2').prop("disabled", false);
			md.getContent().find('#timezoneDropdown').prop("disabled", false);
		} else {
			md.getContent().find('#chkEnableNtp').parent().bootstrapSwitch('setState', 0);
			md.getContent().find('#inputDate').prop("disabled", false);
			md.getContent().find('#inputTime').prop("disabled", false);
			md.getContent().find('#inputNtp1').prop("disabled", true);
			md.getContent().find('#inputNtp2').prop("disabled", true);
			md.getContent().find('#timezoneDropdown').prop("disabled", true);
		}
		md.getContent().find('#chkEnableNtp').on('change', function () {
			if (md.getContent().find('#chkEnableNtp').parent().hasClass('switch-on')) {
				md.getContent().find('#inputDate').prop("disabled", true);
				md.getContent().find('#inputTime').prop("disabled", true);
				md.getContent().find('#inputNtp1').prop("disabled", false);
				md.getContent().find('#inputNtp2').prop("disabled", false);
				md.getContent().find('#timezoneDropdown').prop("disabled", false);
			} else {
				md.getContent().find('#inputDate').prop("disabled", false);
				md.getContent().find('#inputTime').prop("disabled", false);
				md.getContent().find('#inputNtp1').prop("disabled", true);
				md.getContent().find('#inputNtp2').prop("disabled", true);
				md.getContent().find('#timezoneDropdown').prop("disabled", true);
			}
		});
		const dataLanguage = MessengerUtil.send(
			'get_configuration',
			{
				general: [
					'language'
				]
			}
		);

		var language;
		switch (dataLanguage.general.language) {
			case "pt_BR":
				language = 'pt-BR';
				break;
			case "en_US":
				language = 'en';
				break;
			case "spa_SPA":
				language = 'es';
				break;
			default:
				language = 'pt-BR';
		}

		console.log(language)

		md.getContent().find('#chkClock24hFormat').parent().bootstrapSwitch();
		md.getContent().find('#chkClock24hFormat').parent().bootstrapSwitch('setState', clock_format_message.clock_12h_format == '0');
		switch(clock_format_message.month_day_year_format) {
			case "1":
				md.getContent().find('#chkMonthDayYearFormat').attr('checked','checked');
				break
			case "0":
			default:
				md.getContent().find('#chkDayMonthYearFormat').attr('checked','checked');
				break
		}
		var dt = Main.getSystemDate();
		var time = new Timepicker();
		var date = new Datepicker();
		var dtEnd = new Datepicker();
		var dtStart = new Datepicker();
		date.language = language;
		dtEnd.language = language;
		dtStart.language = language;

		date.monthDayYearFormat = clock_format_message.month_day_year_format == '1';
		dtStart.monthDayYearFormat = clock_format_message.month_day_year_format == '1';
		dtEnd.monthDayYearFormat = clock_format_message.month_day_year_format == '1';

		time.showSeconds = true;
		time.clock12hFormat = md.getContent().find('#chkClock24hFormat').parent().hasClass('switch-off');
		time.init(md.getContent().find('#inputTime'));
		time.setDate(dt);
		md.getContent().find('#chkClock24hFormat').on('change', function () {
			time.showSeconds = true;
			time.clock12hFormat = md.getContent().find('#chkClock24hFormat').parent().hasClass('switch-off');
			time.init(md.getContent().find('#inputTime'));
			time.setDate(Main.getSystemDate());
		});

		date.init(md.getContent().find('#inputDate'));
		date.setDate(dt);

		dtEnd.init(md.getContent().find('#inputFinalSummerTime'));

		dtStart.setCallbackChange(function () {
			dtEnd.setMinDate(dtStart.getDate());
		});

		dtEnd.setCallbackChange(function () {
			dtStart.setMaxDate(dtEnd.getDate());
		});

		dtStart.init(md.getContent().find('#inputInitSummerTime'));
		var data = MessengerUtil.send('get_configuration', { general: ['daylight_savings_time_start', 'daylight_savings_time_end'] }).general;
		dtStart.setDate(parseDateXmlToWeb(data.daylight_savings_time_start));
		dtEnd.setDate(parseDateXmlToWeb(data.daylight_savings_time_end));

		dtEnd.setMinDate(dt);

		if (ntp_message.enabled == "1") {
			statusTimeout = setTimeout(function refreshNTPStatus() {
				if (!(document.getElementById("ntp_status_bar") && document.getElementById("ntp_status_label"))) {
					return;
				}

				const response = MessengerUtil.send('get_ntp_server_status', null, null, false);
				document.getElementById("ntp_status_bar").classList.remove("grey", "green", "red");

				if (response.error !== undefined) {
					document.getElementById("ntp_status_bar").classList.add("grey");
					document.getElementById("ntp_status_label").textContent = 'Unable to get state from NTP server';
					statusTimeout = setTimeout(refreshNTPStatus, 5000);
					return;
				}
				if (response.server_status) {
					document.getElementById("ntp_status_bar").classList.add("green");
					document.getElementById("ntp_status_label").textContent = 'NTP server connected';
				} else {
					document.getElementById("ntp_status_bar").classList.add("red");
					document.getElementById("ntp_status_label").textContent = 'NTP server disconnected';
				}
				statusTimeout = setTimeout(refreshNTPStatus, 2000);
			}, 0);
			md.getContent().parent().on('hide', function () {
				clearTimeout(statusTimeout);
			});
		} else {
			document.getElementById("ntp_status_bar").classList.remove("grey", "green", "red");
			document.getElementById("ntp_status_bar").classList.add("grey");
			document.getElementById("ntp_status_label").textContent = 'NTP server disabled';
		}
	});

}

function openScreenConfigModal(){
	var md = new Modal();
	md.setTitle('Display Settings');
	md.setHTMLContent($('#modal_screenConfigsEdit'));
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	md.show(function(){

		var data = MessengerUtil.send(
			'get_configuration',
			{
				'general': [
					'screen_always_on',
					'screen_on_timeout',
					'screen_brightness',
					'screen_protect_accidental_touch_on',
					'screen_protect_accidental_touch_hold_time'
				]
			}
		);
		md.getContent().find('#chkButtonScreenAlwaysOn').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonScreenAlwaysOn').parent().bootstrapSwitch('setState', data.general.screen_always_on == '1');
		md.getContent().find('#inputScreenOnTimeout').val(data.general.screen_on_timeout);
		md.getContent().find('#chkButtonMaxBrightness').parent().bootstrapSwitch();
		md.getContent().find('#screen_brightness')[0].value = data.general.screen_brightness;
		md.getContent().find('#var_screen_brightness')[0].value = md.getContent().find('#screen_brightness')[0].value;
		md.getContent().find('#chkButtonAccidentalTouchProtection').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonAccidentalTouchProtection').parent().bootstrapSwitch('setState', data.general.screen_protect_accidental_touch_on == '1');
		md.getContent().find('#inputAccidentalTouchProtectionHoldTime').val(data.general.screen_protect_accidental_touch_hold_time);
	});

	function save (returnMessage) {
		let screen_always_on = md.getContent().find('#chkButtonScreenAlwaysOn').parent().bootstrapSwitch('status') ? "1" : "0";
		let screen_on_timeout = parseInt(md.getContent().find('#inputScreenOnTimeout').val());
		let screen_brightness = md.getContent().find('#var_screen_brightness')[0].value;
		let screen_protect_accidental_touch_on = md.getContent().find('#chkButtonAccidentalTouchProtection').parent().bootstrapSwitch('status') ? "1" : "0";
		let screen_protect_accidental_touch_hold_time = parseInt(md.getContent().find('#inputAccidentalTouchProtectionHoldTime').val());
		if((isNaN(screen_on_timeout) || screen_on_timeout < 0) ||
		   (isNaN(screen_protect_accidental_touch_hold_time) || screen_protect_accidental_touch_hold_time < 0)){
			return returnMessage({error: "Invalid display timeout! (must be greater than 0 s)"});
		}

		let data = MessengerUtil.send(
			'set_configuration',
			{
				'general': {
					'screen_always_on': screen_always_on,
					'screen_on_timeout': screen_on_timeout.toString(),
					'screen_brightness' : screen_brightness,
					'screen_protect_accidental_touch_on': screen_protect_accidental_touch_on,
					'screen_protect_accidental_touch_hold_time': screen_protect_accidental_touch_hold_time.toString()
				}
			}
		);
		returnMessage(data);
	}
}

function openExportModal(){
	var success = $('.button-submit');
		success.click(function(){
			var custom_tables_metadata = MessengerUtil.send('object_metadata', {filter: 'custom'});

			if($('#exportUsers').parent().hasClass('checked'))
				export_users(custom_tables_metadata);
			else if($('#exportBackup').parent().hasClass('checked'))
				export_all(custom_tables_metadata, true);
			else if($('#exportSync').parent().hasClass('checked'))
				export_all(custom_tables_metadata, false);
			else if($('#exportLogs').parent().hasClass('checked'))
				export_logs(custom_tables_metadata);
		});

		$('#form_wizard_1').bootstrapWizard({
			onTabClick: function (tab, navigation, index) {
				return false;
			}
		});

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

async function packUserImages(exportZip, modal) {
	var user_images = exportZip.folder('user_images');
	var userIds = MessengerUtil.send('user_list_images').user_ids;

	var batchSize = 100;
	var start = 0;
	var end = start + batchSize;

	var totalImages = userIds.length;

	while (start < userIds.length) {
		var idsBatch = userIds.slice(start, end);
		var images = MessengerUtil.send('user_get_image_list', {user_ids: idsBatch}).user_images;

		for (const img_data of images) {
			user_images.file(img_data.id + '.jpg', img_data.image, {base64: true});
		}

		start = end;
		end += batchSize;

		var transferredImages = (end < totalImages) ? end : userIds.length;
		var progress = (transferredImages / totalImages) * 50 + 30;
		await modal.updateProgress(progress, "Exporting user images " + "(" + transferredImages + "/" + totalImages + ")");
	}
}

async function exportAndGenerateZip(pkgName, tables_to_export, modal) {
	var data = await export_tables(tables_to_export, modal);
	if (data.error != undefined) {
		console.error(data.error);
		alert('Error while exporting:' + data.error);
		return;
	}

	var zip = new JSZip();
	zip.file(pkgName + '.csv', new Blob([data], { type: 'text/plain' }));

	await modal.updateProgress(30, "Exporting data");
	await packUserImages(zip, modal);

	await modal.updateProgress(90, "Compressing export file");
	zip.generateAsync({type: 'blob'}).then(async function(content) {
		await modal.updateProgress(100, "Finished!");
		saveTextAsFile(pkgName + '.zip', content);
	});
}

function destroyClickedElement(event) {
	document.body.removeChild(event.target);
}

function add_custom_tables_metadata(custom_tables_metadata, objects){
	var obj_keys = Object.keys(custom_tables_metadata);
	obj_keys.forEach(function(curr_key){
		var curr_table = custom_tables_metadata[curr_key];
		if(curr_key === 'special_columns')
			return;
		objects[objects.length] = {
			object: curr_key,
			columns: Object.keys(curr_table['fields'])
		}
	});
}

async function export_face_templates(modal) {
	var data = "face_templates\r\n";
	//Atenção! Corrigir aqui se a tabela mudar!
	data += "id,face_type,template,user_id,length\r\n";

	const result_count = MessengerUtil.send("load_objects",
	{
		object: 'face_templates',
		fields: ["COUNT(*)"]
		}
	);
	const total_templates = parseInt(result_count.face_templates[0]['COUNT(*)']);

	var current_count = 0;
	const limit = 400;
	var last_id = -1;
	var progress = 0;
	const max_progress = 30;
	while (current_count < total_templates) {
		const result = MessengerUtil.send('load_objects',
			{
				object: 'face_templates',
				order: ['ascending', 'id'],
				limit: limit,
				where: {
					'face_templates': { 'id': { '>': last_id } }
				}
			}
		);

		if (result.error !== undefined) {
			return result.error;
		}

		for (face_template of result.face_templates) {
			data += face_template.id + ",";
			data += face_template.face_type + ",";
			data += face_template.template + ",";
			data += face_template.user_id + ",";
			data += face_template.length + "\r\n";

			current_count += 1;
			last_id = face_template.id;
		}

		var current_progress = (current_count/total_templates) * max_progress;
		progress = max_progress < current_progress ? max_progress : current_progress;
		await modal.updateProgress(progress, "Exporting data");
	}
	return data + "\r\n"
}

	async function export_tables(tables_to_export, modal) {
	var data = "";

	// Exportação metadados de tabelas personalizadas
	var metadata_result = MessengerUtil.send('export_custom_tables_metadata');
	if (metadata_result.error != undefined) {
		return metadata_result.error;
	}
	data += metadata_result;

	// Exportação das tabelas
	data += "cid_data\r\n\r\n";
	for (const item of tables_to_export) {
		if (item.object == "face_templates") {
			var result = await export_face_templates(modal);
			if (result.error != undefined) {
				return result.error;
			}
			data += result
		}
		else {
			const table = { object: item.object, columns: []};
			var result = MessengerUtil.send('export_object', table);
			if (result.error != undefined) {
				return result.error;
			}
			data += item.object + "\r\n" + result + "\r\n";
		}
	}
	return data.slice(0, -2);
}

function export_users(custom_tables_metadata) {
	var modal = new Modal();
	modal.setTitle('Export');
	modal.setContent('' +
		'<div id="message">Exporting data</div><br/>' +
		'<div class="progress">' +
		'<div class="progress-bar expbar" style="color:#FFFFFF00;width:0;background-color:#35AA47" role="progressbar">.</div>' +
		'</div>'
	);
	modal.updateProgress = async function (value, message) {
		modal.getContent().find('#message').text(message);
		modal.getContent().find('.expbar').css({ width: value + '%' });

		await new Promise(function (resolve, reject) {
			setTimeout(resolve, 500);
		});

		if (value == 100) {
			setTimeout(function () { modal.hide(); }, 2000);
		}
	};
	modal.show(function () {
		modal.getContent().find(".modal-header .close").remove();
	});

	var objects = [
		{
			object: 'user_types'
		},
		{
			object: 'users'
		},
		{
			object: 'templates',
			columns: ["finger_position", "finger_type", "template", "user_id"]
		},
		{
			object: 'face_templates',
			columns: ["face_type", "template", "user_id"]
		},
		{
			object: 'cards',
			columns: ["value", "user_id"]
		},
		{
			object: 'user_roles'
		},
		{
			object: 'pins'
		},
		{
			object: 'qrcodes'
		},
		{
			object: 'visits'
		}
	]
	add_custom_tables_metadata(custom_tables_metadata, objects);

	setTimeout(function () {
		exportAndGenerateZip('users', objects, modal);
	}, 500);
}

function export_all(custom_tables_metadata, isBackup) {
	var modal = new Modal();
	modal.setTitle('Export');
	modal.setContent('' +
		'<div id="message">Exporting data</div><br/>' +
		'<div class="progress">' +
		'<div class="progress-bar expbar" style="color:#FFFFFF00;width:0;background-color:#35AA47" role="progressbar">.</div>' +
		'</div>'
	);
	modal.updateProgress = async function (value, message) {
		modal.getContent().find('#message').text(message);
		modal.getContent().find('.expbar').css({ width: value + '%' });

		await new Promise(function (resolve, reject) {
			setTimeout(resolve, 500);
		});

		if (value == 100) {
			setTimeout(function () { modal.hide(); }, 2000);
		}
	};
	modal.show(function () {
		modal.getContent().find(".modal-header .close").remove();
	});

	var tables_to_export = [
		{ object: 'groups' },
		{ object: 'time_zones' },
		{ object: 'time_spans' },
		{ object: 'user_types' },
		{ object: 'users' },
		{ object: 'cards' },
		{ object: 'templates' },
		{ object: 'face_templates' },
		{ object: 'user_roles' },
		{ object: 'visits' },
		{ object: 'access_rules' },
		{ object: 'validations' },
		{ object: 'reports' },
		{ object: 'report_columns' },
		{ object: 'report_column_formats' },
		{ object: 'object_field_report_columns' },
		{ object: 'counter_report_columns' },
		{ object: 'fixed_report_columns' },
		{ object: 'report_filters' },
		{ object: 'alarm_zones' },
		{ object: 'portal_rules' },
		{ object: 'api_logins' },
		{ object: 'api_access_levels' },
		{ object: 'api_commands' },
		{ object: 'api_object_commands' },
		{ object: 'api_object_field_commands' },
		{ object: 'api_object_field_command_values' },
		{ object: 'access_rule_actions' },
		{ object: 'access_rule_time_zones' },
		{ object: 'access_rule_validations' },
		{ object: 'alarm_zone_time_zones' },
		{ object: 'area_access_rules' },
		{ object: 'group_access_rules' },
		{ object: 'portal_access_rules' },
		{ object: 'portal_portal_rules' },
		{ object: 'portal_rule_actions' },
		{ object: 'portal_rule_groups' },
		{ object: 'portal_rule_time_zones' },
		{ object: 'portal_rule_users' },
		{ object: 'portal_rule_validations' },
		{ object: 'user_access_rules' },
		{ object: 'user_groups' },
		{ object: 'api_login_api_access_levels' },
		{ object: 'pins' },
		{ object: 'qrcodes' }
	];
	var export_file_name;
	if (isBackup) {
		tables_to_export[tables_to_export.length] = { object: 'alarm_logs' }
		tables_to_export[tables_to_export.length] = { object: 'call_logs' }
		tables_to_export[tables_to_export.length] = { object: 'access_logs' }
		tables_to_export[tables_to_export.length] = { object: 'access_log_access_rules' }
		tables_to_export[tables_to_export.length] = { object: 'access_log_portal_rules' }
		export_file_name = 'backup'
	}
	else {
		export_file_name = 'sync'
	}
	add_custom_tables_metadata(custom_tables_metadata, tables_to_export);

	setTimeout(function () {
		exportAndGenerateZip(export_file_name, tables_to_export, modal);
	}, 500);
}

function export_logs(custom_tables_metadata){
	var modal = new Modal();
	modal.setTitle('Exporting');
	modal.setContent('Exporting...');
	modal.show(function(){
		modal.getContent().find(".modal-header .close").remove();
	});

	var objects = [
		{
			object: 'access_logs'
		},
		{
			object: 'access_log_access_rules'
		},
		{
			object: 'access_log_portal_rules'
		}
	]
	add_custom_tables_metadata(custom_tables_metadata, objects);

	var data = MessengerUtil.send('export_objects', {objects});
	saveTextAsFile('logs.csv', data);
	modal.hide();
}
// TODO oque sao essas coisas?
function init_afd_filters(filterSelect) {
	const nsrFilter = $('#nsrFilter');
	const dateFilter = $('#dateFilter');
	switch (filterSelect.value) {
		case 'date-filter':
			init_date_filter();
			break;
		case 'nsr-filter':
			init_nsr_filter();
			break;
		case 'no-filter':
		default:
			init_no_filter();
			break;
	}

	function init_no_filter() {
		dateFilter.hide();
		nsrFilter.hide();
	}

	function init_nsr_filter() {
		dateFilter.hide();
		nsrFilter.show();
		nsrFilter.on("input", function() {
			if (parseInt($('#inputNSR').val()) <= 0) {
				$('#inputNSR').val(1)
			}
		});
	}

	function init_date_filter() {
		nsrFilter.hide();
		dateFilter.show();
		const dt = Main.getSystemDate();
		var dtStart = new Datepicker();
		dtStart.init($('#inputDate'));
		dtStart.setDate(dt);
	}
}

function afd_filters() {
	const filterSelect = $('#filter-selection');
	switch (filterSelect.val()) {
		case 'date-filter':
			var day = parseInt($('#inputDate').val().substr(0,2));
			var month = parseInt($('#inputDate').val().substr(3,2));
			var year = parseInt($('#inputDate').val().substr(6,4));
			return {
				initial_date: {
					day: day,
					month: month,
					year: year
				}
			};
		case 'nsr-filter':
			var nsr = parseInt($('#inputNSR').val());
			return { initial_nsr: nsr };
		case 'no-filter':
		default:
			return {};
	}
}

function afd_mode() {
	const modeSelect = $('#afd-mode-selection');
	switch (modeSelect.val()) {
		case 'afd-671':
			return 671;
		case 'afd-595':
		default:
			return 595;
	}
}

async function export_afd() {
	var filters = afd_filters();
	filters.mode = afd_mode();
	var modal = new Modal();
	modal.setTitle('Exportando');
	modal.setContent('' +
		'<div id="message">Exportando AFD</div><br/>' +
		'<div class="progress">' +
		'<div class="progress-bar expbar" style="color:#FFFFFF00;width:0;background-color:#35AA47" role="progressbar">.</div>' +
		'</div>'
	);
	modal.updateProgress = async function(value, message) {
		modal.getContent().find('#message').text(message);
		modal.getContent().find('.expbar').css({ width: value + '%' });

		await new Promise(function(resolve, reject) {
			setTimeout(resolve, 500);
		});

		if (value == 100) {
			setTimeout(function() { modal.hide(); }, 2000);
		}
	};
	modal.show(function(){
		modal.getContent().find(".modal-header .close").remove();
	});

	const limit = 500;
	let total = 0;
	if ("initial_date" in filters) {
		total = MessengerUtil.send('count_registers', {initial_date: filters.initial_date}).log_number;
	} else if ("initial_nsr" in filters) {
		total = MessengerUtil.send('count_registers', {}).log_number - filters.initial_nsr + 1;
	} else {
		total = MessengerUtil.send('count_registers', {}).log_number;
	}
	let offset = 0;
	let data = "";
	filters.offset = offset;
	filters.limit = limit;
	await modal.updateProgress(0, "Exportando AFD");

	while (filters.offset < total) {
		data += MessengerUtil.send('export_afd', filters);
		filters.offset += limit;
		await modal.updateProgress(filters.offset/total*100, "Exportando AFD");
	}

	if (total <= 0) {
		data += MessengerUtil.send('export_afd', filters);
	}

	await modal.updateProgress(100, "Exportação concluída com sucesso.");

	if (filters.mode == 671) {
		var formatted_serial = data.substr(189, 17);
		// AFD + serial + CNPJ do empregador + REP_P
		saveTextAsFile('AFD' + formatted_serial + '00000000000000' + 'REP_P' + '.txt', data);
	}
	else { // 595
		var formatted_serial = data.substr(187, 17);
		saveTextAsFile('AFD' + formatted_serial + '.txt', data);
	}

	modal.setContent('Exportação concluída com sucesso.');
	modal.getContent().parent().find('.btn').remove();
	modal.addButton([
		{
			'type' : 'ok',
			'class' : 'blue',
			'text' : 'OK',
			'callback' : function(){
				modal.close()
			}
		}
	]);
}

var containsImageFile = false; // Global boolean variable

function openImportModal() {
	function progress_bar_update(index) {
		var total = $('#prog_bar_list').find('li').length;
		var current = index + 1;
		var $percent = (current / total) * 100;
		$('#form_wizard_1').find('.bar').css({
			width: $percent + '%'
		});
	}

	function applySyncBackupLayout() {
		$('#form_wizard_1').find('.button-previous').hide();
		$('#form_wizard_1').find('.button-next').hide();
		$('#form_wizard_1').find('.button-submit').show();
		$('#form_wizard_1').find('.bar').css({
			width: 100 + '%'
		});
	}

	var import_sync = $('#importSync');
	import_sync.click(function () {
		$('#typeDiv').hide();
		applySyncBackupLayout();
	});

	var import_backup = $('#importBackup');
	import_backup.click(function () {
		$('#typeDiv').hide();
		applySyncBackupLayout();
	});

	var import_users_tag = $('#importUsers');
	import_users_tag.click(function () {
		$('#form_wizard_1').find('.button-submit').hide();
		$('#form_wizard_1').find('.button-next').show();
		$('#typeDiv').show();
		progress_bar_update(0);
	});

	const inputFile = document.getElementById('inputImportFile');
	const fileStatus = document.getElementById('fileStatus');

	inputFile.addEventListener('change', function() {
		if (inputFile.files.length > 0) {
			document.getElementById('fileStatusNull').style.display = 'none';

			const fileNames = Array.from(inputFile.files).map(file => file.name).join(', ');
			const fileStatusAddFile = document.getElementById('fileStatusAddFile');
			fileStatusAddFile.textContent = fileNames;
			fileStatusAddFile.style.display = 'inline';
		} else {
			document.getElementById('fileStatusNull').style.display = 'inline';
			document.getElementById('fileStatusAddFile').style.display = 'none';
		}
	});

	$('#chkEasyImport').parent().bootstrapSwitch();
	$('#chkEasyImport').parent().bootstrapSwitch('setState', false);

	$('#import_format_div').hide();
	$('#separator_div').hide();
	// Event handler
	$('#chkEasyImport').parent().parent().on('switch-change', function (e, data) {
		if (data.value) { // true = switch ON
			$('#import_format_div').show();
			$('#separator_div').show();
		} else {
			$('#import_format_div').hide();
			$('#separator_div').hide();
		}
	});
	$.uniform.update($('#chkCSVImage').attr('checked', 'checked'));
	$.uniform.update($('#chkComma').attr('checked', 'checked'));
	function verify_input_file() {
		var file = $("#inputImportFile")[0].files;
		if (file[0] == undefined) {
			if ($('#importUsers').hasClass('active'))
				setTimeout(function () { $('#form_wizard_1').find('.button-previous').click() }, 0);
			var _modal = new Modal();
			_modal.setTitle('Import');
			_modal.setContent('Select a file');
			_modal.addButton([
				{
					'type': 'cancel',
					'text': 'OK'
				}
			]);
			_modal.show();
			return false;
		}
		var fileExtension = file[0].type;
		if (file.length == 0) {
			if ($('#importUsers').hasClass('active'))
				setTimeout(function () { $('#form_wizard_1').find('.button-previous').click() }, 0);
			var _modal = new Modal();
			_modal.setTitle('Import');
			_modal.setContent('Select a file');
			_modal.addButton([
				{
					'type': 'cancel',
					'text': 'OK'
				}
			]);
			_modal.show();
			return false;
		} else if (fileExtension != "application/zip"
			&& fileExtension != "application/zip-compressed"
			&& fileExtension != "application/x-zip-compressed"
			&& fileExtension != "application/octet-stream") {
			if ($('#importUsers').hasClass('active'))
				setTimeout(function () { $('#form_wizard_1').find('.button-previous').click() }, 0);
			var _modal = new Modal();
			_modal.setTitle('Import');
			_modal.setContent('Invalid file type');
			_modal.addButton([
				{
					'type': 'cancel',
					'text': 'OK'
				}
			]);
			_modal.show();
			return false;
		} else {
			return true;
		}
	}

	var success = $('.button-submit');
	success.click(function () {
		var md = new Modal();
		md.setTitle('Import');
		md.setContent("The device will restart after the process. Do you wish to continue?");
		md.addButton([
			{
				'type': 'ok',
				'text': 'Ok',
				'callback': confirmationModal
			},
			{
				'type': 'cancel'
			}
		]);
		md.show();

		function confirmationModal(){
			var md2 = new Modal();
			md2.setTitle('Important');
			md2.setContent('When the import starts, it will continue until completion, even if this web page is closed.');
			md2.addButton([
				{
					'type': 'ok',
					'text': 'Ok',
					'callback': function() {
						md2.hide();
						initProcess()
					}
				},
				{
					'type': 'cancel'
				}
			]);
			md2.show();
		}

		function initProcess() {
			if (md != null)
				md.hide();
			var ok = verify_input_file();
			if (!ok)
				return false;

			//TIPOS DE USUÁRIO
			var user_types_keep_curr;
			if ($('#keepCurrentUserTypes').hasClass('active'))
				user_types_keep_curr = true;
			else
				user_types_keep_curr = false;

			var on_conflict;
			var remaining;

			//CONFLITOS
			if ($('#confChange').hasClass('active'))
				on_conflict = "REPLACE"
			else if ($('#confOverwrite').hasClass('active'))
				on_conflict = "OVERWRITE"
			else
				on_conflict = "IGNORE"

			//RESTANTES
			remaining = $('#remainKeep').hasClass('active') ? "KEEP" : "DESTROY"
			var file = $("#inputImportFile")[0].files[0];
			if ($('#importUsers').hasClass('active')) {
				//import users
				if ($('#chkEasyImport').parent().hasClass('switch-on')) {
					validate_easy_import_users(user_types_keep_curr, on_conflict, remaining, file);
				} else {
					validate_import_users(user_types_keep_curr, on_conflict, remaining, file);
				}
			}
			else if ($('#importSync').hasClass('active')) {
				//import sync
				validate_import_all(false, file);
			}
			else if ($('#importBackup').hasClass('active')) {
				//import backup
				validate_import_all(true, file);
			}
			return true;
		}
	});

	success.hide();
	$('#form_wizard_1').find('.button-previous').hide();
	$('#form_wizard_1').bootstrapWizard({
		'nextSelector': '.button-next',
		'previousSelector': '.button-previous',
		onTabClick: function (tab, navigation, index) {
			return false;
		},
		onNext: function (tab, navigation, index) {
			success.hide();

			var total = navigation.find('li').length;
			var current = index + 1;

			// set done steps
			jQuery('li', $('#form_wizard_1')).removeClass("done");
			var li_list = navigation.find('li');
			for (var i = 0; i < index; i++) {
				jQuery(li_list[i]).addClass("done");
			}
		
			// Check if we need to skip page 2
			if (index === 1 && $('#chkEasyImport').parent().hasClass('switch-on')) {
				// skip page 2 by jumping ahead 2 steps
				$('#form_wizard_1').bootstrapWizard('show', 2);
				$('#form_wizard_1').find('.button-previous').show();
				return false; // prevent default next behavior
			}

			if (current == 1) {
				$('#form_wizard_1').find('.button-previous').show();
			} else if (current == 2) {
				var ok = verify_input_file();
				if (ok)
					$('#form_wizard_1').find('.button-previous').show();
			} else {
				$('#form_wizard_1').find('.button-previous').show();
			}

			if (current >= total) {
				$('#form_wizard_1').find('.button-next').hide();
				$('#form_wizard_1').find('.button-submit').show();
			} else {
				$('#form_wizard_1').find('.button-next').show();
				$('#form_wizard_1').find('.button-submit').hide();
			}
		},
		onPrevious: function (tab, navigation, index) {
			success.hide();
			var total = navigation.find('li').length;
			var current = index + 1;
		
			// Check if we need to skip back over page 2
			if (index === 1 && $('#chkEasyImport').parent().hasClass('switch-on')) {
				// skip back to page 1
				$('#form_wizard_1').bootstrapWizard('show', 0);
				$('#form_wizard_1').find('.button-previous').hide();
				return false;
			}
		
			// set done steps
			jQuery('li', $('#form_wizard_1')).removeClass("done");
			var li_list = navigation.find('li');
			for (var i = 0; i < index; i++) {
				jQuery(li_list[i]).addClass("done");
			}

			if (current == 1) {
				$('#form_wizard_1').find('.button-previous').hide();
			} else if (current == 2 && $('#importBackup').hasClass('active')) {
				setTimeout(function () { $('#form_wizard_1').find('.button-previous').click() }, 0);
			} else {
				$('#form_wizard_1').find('.button-previous').show();
			}

			if (current >= total) {
				$('#form_wizard_1').find('.button-next').hide();
				$('#form_wizard_1').find('.button-submit').show();
			} else {
				$('#form_wizard_1').find('.button-next').show();
				$('#form_wizard_1').find('.button-submit').hide();
			}
		},
		onTabShow: function (tab, navigation, index) {
			progress_bar_update(index);
		}
	});
}

function validate_easy_import_users(user_types_keep_curr, on_conflict, remaining, file) {
	localStorage.clear();
	var fileRead = new FileReader();
	if (document.getElementById('chkCSVImage').checked) {
		fileRead.onload = function (e) {
			var zip = new JSZip();

			zip.loadAsync(e.target.result).then(function (zip) {
				let csvFileName = null;
				let containsImageFile = false;

				// Check for any CSV file and save its name
				Object.keys(zip.files).forEach(function (filename) {
					if (filename.endsWith('.csv')) {
						csvFileName = filename;
					}
				});

				if (!csvFileName) {
					openErrorModal('Import error, invalid file');
				} else {
					// Check for user_images folder (if it exists)
					let userImagesFolder = zip.folder("/user_images/");
					if (userImagesFolder) {
						Object.entries(userImagesFolder.files).forEach(([key, value]) => {
							if (value.name.endsWith('.jpg') || value.name.endsWith('.jpeg') || value.name.endsWith('.png')) {
								containsImageFile = true;
							}
						});
					} else {
						containsImageFile = false;
					}
					// Continue processing
					import_users(user_types_keep_curr, on_conflict, remaining, file, csvFileName);
				}
			});
		}
	} else {
		fileRead.onload = function (e) {
			var zip = new JSZip();

			zip.loadAsync(e.target.result).then(function (zip) {
				// Check for user_images folder (if it exists)
				let userImagesFolder = zip.folder("/user_images/");
				if (userImagesFolder) {
					Object.entries(userImagesFolder.files).forEach(([key, value]) => {
						if (value.name.endsWith('.jpg') || value.name.endsWith('.jpeg') || value.name.endsWith('.png')) {
							containsImageFile = true;
						}
					});
				} else {
					openErrorModal('Import error, invalid file');
				}
				// Continue processing
				import_users(user_types_keep_curr, on_conflict, remaining, file, "");
			});
		}
	}

	fileRead.readAsArrayBuffer(file);
	function openErrorModal(message) {
		if (md != null)
			md.hide();

		var md = new Modal();
		md.setTitle('Import');
		md.setContent(message);
		md.addButton([
			{
				'type': 'cancel',
				'text': 'OK'
			}
		]);
		md.show();
	}
}

function validate_import_users(user_types_keep_curr, on_conflict, remaining, file) {
	var importType = 'users';
	localStorage.clear();
	var fileRead = new FileReader();
	fileRead.onload = function (e) {
		var zip = new JSZip();

		zip.loadAsync(e.target.result).then(function (zip) {
			if (zip.file(importType + '.csv') == null || zip.folder("/user_images/") == null) {
				openErrorModal("Import error, invalid file");
			} else {
				var userImagesFolder = zip.folder("/user_images/");
				Object.entries(userImagesFolder.files).forEach(([key, value]) => {
					if (value.name.endsWith('.jpg') || value.name.endsWith('.jpeg') || value.name.endsWith('.png')) {
						containsImageFile = true;
					}
				});
				import_users(user_types_keep_curr, on_conflict, remaining, file);
			}
		});
	}
	fileRead.readAsArrayBuffer(file);
	function openErrorModal(message) {
		if (md != null)
			md.hide();

		var md = new Modal();
		md.setTitle('Importar');
		md.setContent(message);
		md.addButton([
			{
				'type': 'cancel',
				'text': 'OK'
			}
		]);
		md.show();
	}
}

function validate_import_all(isBackup, file) {
	if (isBackup == true) {
		var importType = 'backup';
	} else {
		var importType = 'sync';
	}
	localStorage.clear();
	var fileRead = new FileReader();
	fileRead.onload = function (e) {
		var zip = new JSZip();

		zip.loadAsync(e.target.result).then(function (zip) {
			if (zip.file(importType + '.csv') == null || zip.folder("/user_images/") == null) {
				openErrorModal("Import error, invalid file");
			} else {
				var userImagesFolder = zip.folder("/user_images/");
				Object.entries(userImagesFolder.files).forEach(([key, value]) => {
					if (value.name.endsWith('.jpg') || value.name.endsWith('.jpeg') || value.name.endsWith('.png')) {
						containsImageFile = true;
					}
				});
				import_all(isBackup, file);
			}
		});
	}
	fileRead.readAsArrayBuffer(file);
	function openErrorModal(message) {
		if (md != null)
			md.hide();

		var md = new Modal();
		md.setTitle('Importar');
		md.setContent(message);
		md.addButton([
			{
				'type': 'cancel',
				'text': 'OK'
			}
		]);
		md.show();
	}
}

function import_all(isBackup, file) {
	var __modal = new Modal();

	$('.modal-header .close').hide();

	__modal.setTitle('Import');
	__modal.setContent('' +
		'<div id="message">Uncompressing import file</div><br/>' +
		'<div class="progress">' +
		'<div class="progress-bar impbar" style="color:#FFFFFF00;width:0;background-color:#35AA47" role="progressbar">.</div>' +
		'</div>'
	);
	__modal.updateProgress = async function (value, message) {
		__modal.getContent().find('#message').text(message);
		__modal.getContent().find('.impbar').css({ width: value + '%' });

		await new Promise(function (resolve, reject) {
			setTimeout(resolve, 500);
		});
	};
	__modal.show(function () {
		__modal.getContent().find(".modal-header .close").remove();
		var _continue = true
		var data = MessengerUtil.send('destroy_objects', { object: "groups", where: { groups: { id: { "!=": 1 } } } });
		if (data.error) {
			_continue = false
			modal_error("Error while deleting groups table", __modal);
		}
		if (!_continue)
			return false;

		data = MessengerUtil.send('destroy_objects', { object: "time_zones", where: { time_zones: { id: { "!=": 1 } } } });
		if (data.error) {
			_continue = false
			modal_error("Error while deleting time_zones table", __modal);
		}

		data = MessengerUtil.send('destroy_objects', { object: "time_spans", where: { time_spans: { id: { "!=": 1 } } } });
		if (data.error) {
			_continue = false
			modal_error("Error while deleting time_spans table", __modal);
		}

		if (!_continue)
			return false

		var resolution = {};
		var tables_to_delete = [
			['users', 'id'],
			['user_types', 'id'],
			['cards', 'id'],
			['templates', 'id'],
			['face_templates', 'id'],
			['visits', 'id'],
			['access_rules', 'id'],
			['validations', 'id'],
			['reports', 'id'],
			['report_columns', 'id'],
			['report_column_formats', 'id'],
			['object_field_report_columns', 'id'],
			['counter_report_columns', 'id'],
			['fixed_report_columns', 'id'],
			['report_filters', 'id'],
			['alarm_zones', 'zone'],
			['portal_rules', 'id'],
			['api_access_levels', 'id']
		];

		if (isBackup) {
			tables_to_delete.push(["access_logs", 'id']);
			tables_to_delete.push(["alarm_logs", 'id']);
			tables_to_delete.push(["call_logs", 'id']);
			tables_to_delete.push(["access_log_access_rules", 'id']);
			tables_to_delete.push(["access_log_portal_rules", 'id']);
		}

		tables_to_delete.forEach(function (item) {
			resolution[item[0]] = [{
				object: item[0],
				resolution: item[1],
				on_conflict: 'OVERWRITE',
				remaining: 'DESTROY'
			}];
			var entry = item[0];
			var data = MessengerUtil.send('destroy_all', { object: entry });
			if (data.error) {
				_continue = false
				modal_error("Error while deleting table " + entry, __modal);
				return false;
			}
		});

		//tabelas do sistema, não devem ser modificadas pela exportação e importação
		if (containsImageFile) {
			var tables_to_ignore = ['scripts', 'script_parameters', 'face_templates'];
		} else {
			var tables_to_ignore = ['scripts', 'script_parameters'];
		}

		var importType = isBackup ? 'backup' : 'sync';

		import_file(resolution, importType, __modal, file, true, undefined, tables_to_ignore);
	});
}

function import_users(user_types_keep_curr, on_conflict, remaining, file, csvFileName) {
	var __modal = new Modal();

	$('.modal-header .close').hide();

	__modal.setTitle('Import');
	__modal.setContent('' +
		'<div id="message">Uncompressing import file</div><br/>' +
		'<div class="progress">' +
		'<div class="progress-bar impbar" style="color:#FFFFFF00;width:0;background-color:#35AA47" role="progressbar">.</div>' +
		'</div>'
	);
	__modal.updateProgress = async function (value, message) {
		__modal.getContent().find('#message').text(message);
		__modal.getContent().find('.impbar').css({ width: value + '%' });

		await new Promise(function (resolve, reject) {
			setTimeout(resolve, 500);
		});
	};
	__modal.show(function () {
		__modal.getContent().find(".modal-header .close").remove();
		var resolution = {
			'users': [{
				object: 'users',
				resolution: 'id',
				on_conflict: on_conflict,
				remaining: remaining,
				is_user_import: true
			}],
			'templates': [{
				object: 'templates',
				resolution: 'user_id',
				on_conflict: on_conflict == "REPLACE" ? "OVERWRITE" : on_conflict,
				remaining: remaining
			}],
			'cards': [{
				object: 'cards',
				resolution: 'user_id',
				on_conflict: on_conflict == "REPLACE" ? "OVERWRITE" : on_conflict,
				remaining: remaining
			}],
			'pins': [{
				object: 'pins',
				resolution: 'user_id',
				on_conflict: on_conflict == "REPLACE" ? "OVERWRITE" : on_conflict,
				remaining: remaining
			}],
			'qrcodes': [{
				object: 'qrcodes',
				resolution: 'user_id',
				on_conflict: on_conflict == "REPLACE" ? "OVERWRITE" : on_conflict,
				remaining: remaining
			}],
			'user_roles': [{
				object: 'user_roles',
				resolution: 'user_id',
				on_conflict: on_conflict == "REPLACE" ? "OVERWRITE" : on_conflict,
				remaining: remaining
			}]
		};

		if (!containsImageFile) {
			resolution["face_templates"] = [{
				object: 'face_templates',
				resolution: 'user_id',
				on_conflict: on_conflict == "REPLACE" ? "OVERWRITE" : on_conflict,
				remaining: remaining
			}];
		}

		var columns_to_ignore = {};
		if (user_types_keep_curr) {
			columns_to_ignore['users'] = ['user_type_id'];
			resolution['c_users'] = [{
				object: 'c_users',
				resolution: 'id',
				on_conflict: on_conflict,
				remaining: remaining,
				is_user_import: true
			}];
		}

		if (containsImageFile) {
			var tables_to_ignore = ['face_templates'];
		} else {
			var tables_to_ignore = [];
		}

		if ($('#chkEasyImport').parent().hasClass('switch-on') && document.getElementById('chkNameImage').checked) {
			import_images(__modal, file);
		}
		else {
			import_file(resolution, 'users', __modal, file, remaining === 'DESTROY', columns_to_ignore, tables_to_ignore, csvFileName);
		}


		return true;
	});
}

function stringToUint8Array(s) {
	var s = unescape(encodeURIComponent(s)), a = [];
	for (var i = 0; i < s.length; i++)
		a.push(s.charCodeAt(i));
	return new Uint8Array(a);
}

function import_images(__modal, file) {
	var errorObj = {
		errorString: "",
		warning: ""
	};
	function openResultModal(message) {
		if (__modal != null)
			__modal.hide();

		var _modal = new Modal();
		_modal.setTitle('Import');
		_modal.setContent(message);
		_modal.addButton([
			{
				'type': 'cancel',
				'text': 'OK'
			}
		]);
		_modal.show();
	}
	localStorage.clear();
	var fr = new FileReader();
	fr.onload = async function (e) {
		var zip = new JSZip();
		await zip.loadAsync(e.target.result);
		const users = [];  // Holds { filename, registration, relativePath }

		// Collect user info & relativePath
		zip.forEach(function (relativePath, zipEntry) {
			if (relativePath.substr(0, 12) !== "user_images/" || zipEntry.dir) {
				return;
			}
			const fullFilename = relativePath.substr(12);
			const filename = fullFilename.substring(0, fullFilename.lastIndexOf('.'));

			users.push({
				name: filename,
				registration: '',
				relativePath: relativePath
			});
		});

		const totalUsers = users.length;
		const chunkSize = 50;
		let processedUsers = 0;
		let allIds = [];

		// STEP 1: Create users in chunks
		for (let i = 0; i < totalUsers; i += chunkSize) {
			const chunk = users.slice(i, i + chunkSize);

			let response = await MessengerUtil.send('create_objects', {
				object: 'users',
				values: chunk.map(user => ({
					name: user.name,
					registration: user.registration
				}))
			});

			// Store IDs
			if (response && Array.isArray(response.ids)) {
				allIds.push(...response.ids);
			}

			// STEP 1.5: Associate users with group_id = 1
			if (response && Array.isArray(response.ids)) {
				const userGroupPayload = {
					object: 'user_groups',
					fields: ['user_id', 'group_id'],
					values: response.ids.map(user_id => ({
						user_id: user_id,
						group_id: 1
					}))
				};

				// Send the create_objects request for user_groups
				let groupResponse = await MessengerUtil.send('create_objects', userGroupPayload);

				// Handle errors (optional logging)
				if (groupResponse.hasOwnProperty('error') || groupResponse.success == false) {
					errorObj.errorString += "Error in the association with department: " + groupResponse + "\n";
				}
			}

			processedUsers += chunk.length;
			let progress = Math.floor((processedUsers / totalUsers) * 50); // Up to 50% for user creation
			await __modal.updateProgress(progress, "Importing data");
		}

		await __modal.updateProgress(50, "Users created. Importing photos...");

		// STEP 2: Upload user images with corresponding IDs
		for (let i = 0; i < users.length; i++) {
			const user = users[i];
			const user_id = allIds[i]; // Match: ith user -> ith ID
			const zipEntry = zip.file(user.relativePath);

			if (!zipEntry) continue;

			// Read file as uint8array
			const fileData = await zipEntry.async("uint8array");

			let response = await MessengerUtil.sendFile('user_set_image', fileData,
				'user_id=' + user_id +
				'&timestamp=' + Math.floor(Date.now() / 1000) +
				'&import=0'
			);

			if (response && response.hasOwnProperty('error') || response.success == false) {
				errorObj.errorString += `Error registering user image: ${user_id} ${response}\n`;
			}

			let progress = 50 + Math.floor(((i + 1) / users.length) * 50); // 50%-100%
			await __modal.updateProgress(progress, "Importing user photos");
		}

		await __modal.updateProgress(100, "Import completed");
		setTimeout(function () {
			let modalString = errorObj.errorString == "" ? "Import executed successfully" : "Import executed with errors"
			if (errorObj.warning != "") {
				modalString += ". Attention: some tables presented conflicts" + errorObj.warning
			}
			openResultModal(modalString);
			var rebootAlert = new Modal();
			rebootAlert.setTitle('Import');
			let rebootMsg = "Import completed successfully. Restarting the device.";
			if(errorObj.errorString != "" || errorObj.warning != "") {
				rebootMsg = 'Rebooting device' + (errorObj.errorString == "" ? "" : "\nCheck file errors.txt")
				+ (errorObj.warning == "" ? "" : "\nAttention: some tables presented conflicts" + errorObj.warning)
			}
			rebootAlert.setContent(rebootMsg);
			rebootAlert.show();
			if (errorObj.errorString != "") {
				saveTextAsFile("errors.txt", errorObj.errorString);
			}
			setTimeout(function () {
				var time = 60;
				MessengerUtil.sendAsync('reboot', null, null, false);
				Main.sessionFail({ error: 'customError' }, function () {
					setInterval(function () {
						time--;
						if (time == 0)
							window.location = 'login.html';
						$('#countReboot').html(('00' + time).slice(-2));
					}, 1000);

				}, 'Wait!', 'Restarting Equipment', 'Wait' + '<span id=\"countReboot\">' + ('00' + time).slice(-2) + '</span> ' + 'seconds for the equipment to restart.', true);
			}, 10000);
		}, 2000);
	}
	fr.readAsArrayBuffer(file);
}

function import_file(resolution, importType, __modal, file, isDestroy, columns_to_ignore, tables_to_ignore, csvFileName) {
	localStorage.clear();
	var isUsers = importType === 'users';
	let importFileName;
	let easyImport = isUsers && $('#chkEasyImport').parent().hasClass('switch-on')
	if (easyImport) {
		importFileName = csvFileName;
	} else {
		importFileName = importType + '.csv'
	}
	var errorObj = {
		errorString: "",
		warning: ""
	};
	function import_file_send(contents, alert) {
		var result = null;
		$.ajax({
			url: str_url,
			type: 'POST',
			data: stringToUint8Array(contents),
			processData: false,
			cache: false,
			async: false,
			contentType: "application/octet-stream",
			success: function (data) {
				result = { success: true, data: data };
				if (alert === true) {
					if (data.code == 2)
						openResultModal("Maximum number of users in license exceeded");
					else if (data.code == 1)
						openResultModal(data.error);
				}
				if (data.error != undefined) {
					errorObj.errorString += data.error
				}
				if (data.warning != undefined) {
					errorObj.warning = data.warning
				}
			},
			error: function () {
				result = { success: false, data: {} };
				openResultModal("Error while importing");
			}
		});
		return result;
	}

	// Guess separator from a header line
	function guessSeparator(headerLine) {
		const candidates = [',', ';', '\t', '|', ':'];
		const counts = {};

		for (const sep of candidates) {
			const regex = new RegExp(sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); // Escape special chars
			counts[sep] = (headerLine.match(regex) || []).length;
		}

		// Choose the one with the highest count
		const best = Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a));
		return best[0];
	}

	function convertCSV(inputCSV) {
		const lines = inputCSV.trim().split(/\r?\n/); // Handle both Unix and Windows line endings
		let separator = ',';
		if (document.getElementById('chkComma').checked) {
			separator = ',';
		} else if (document.getElementById('chkSemicolon').checked) {
			separator = ';';
		} else if (document.getElementById('chkAuto').checked) {
			separator = guessSeparator(lines[0]);
		}
		const headers = lines[0].split(separator).map(h => h.trim());

		// Find positions of known columns
		const idIndex = headers.indexOf('id');
		const nameIndex = headers.indexOf('name');
		const cardIndex = headers.indexOf('card');
		const pinIndex = headers.indexOf('pin');
		const qrcodeIndex = headers.indexOf('qrcode');

		// Validate mandatory 'id' column
		if (idIndex === -1) {
			throw new Error("Missing mandatory 'id' column!");
		}

		const outputLines = [];

		// Add the two 'cid_data' lines
		outputLines.push("cid_data");
		outputLines.push("");

		// Add the required header lines for 'users'
		outputLines.push("users");
		outputLines.push("id,registration,name,password,panic_password,salt,panic_salt,expires,user_type_id,begin_time,end_time,image_timestamp,last_access");

		// Process each line for 'users'
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim() === '') continue; // Skip empty lines

			const fields = lines[i].split(separator).map(f => f.trim());

			// Skip lines with empty 'id'
			const id = fields[idIndex];
			if (!id) {
				console.warn(`Skipping line ${i + 1}: Empty 'id' found.`);
				continue;
			}

			// Use empty string if 'name' column is missing
			const name = nameIndex !== -1 ? fields[nameIndex] : '';

			// Build new line: <id>,,<name>,,,,,,,0,0,,
			const newLine = `${id},,${name},,,,,,,0,0,,`;
			outputLines.push(newLine);
		}

		// If 'card' column exists, add the 'cards' section
		if (cardIndex !== -1) {
			outputLines.push(''); // Add a blank line before the 'cards' section
			outputLines.push("cards");
			outputLines.push("id,value,user_id,secret");

			// Process each line for 'cards'
			for (let i = 1; i < lines.length; i++) {
				if (lines[i].trim() === '') continue; // Skip empty lines

				const fields = lines[i].split(separator).map(f => f.trim());

				const id = fields[idIndex];
				const card = fields[cardIndex];

				// Skip lines with empty 'id'
				if (!id) {
					console.warn(`Skipping line ${i + 1}: Empty 'id' found.`);
					continue;
				}

				// If 'card' is not empty, add a line to the 'cards' section
				if (card) {
					const newCardLine = `,${card},${id},`;
					outputLines.push(newCardLine);
				}
			}
		}

		// If 'pin' column exists, add the 'pins' section
		if (pinIndex !== -1) {
			outputLines.push(''); // Add a blank line before the 'pins' section
			outputLines.push("pins");
			outputLines.push("id,pin_type,value,user_id");

			// Process each line for 'pins'
			for (let i = 1; i < lines.length; i++) {
				if (lines[i].trim() === '') continue; // Skip empty lines

				const fields = lines[i].split(separator).map(f => f.trim());

				const id = fields[idIndex];
				const pin = fields[pinIndex];

				// Skip lines with empty 'id'
				if (!id) {
					console.warn(`Skipping line ${i + 1}: Empty 'id' found.`);
					continue;
				}

				// If 'pin' is not empty, add a line to the 'pins' section
				if (pin) {
					const newPinLine = `,0,${pin},${id}`;
					outputLines.push(newPinLine);
				}
			}
		}

		// If 'qrcode' column exists, add the 'qrcodes' section
		if (qrcodeIndex !== -1) {
			outputLines.push(''); // Add a blank line before the 'qrcodes' section
			outputLines.push("qrcodes");
			outputLines.push("id,value,user_id");

			// Process each line for 'qrcodes'
			for (let i = 1; i < lines.length; i++) {
				if (lines[i].trim() === '') continue; // Skip empty lines

				const fields = lines[i].split(separator).map(f => f.trim());

				const id = fields[idIndex];
				const qrcode = fields[qrcodeIndex];

				// Skip lines with empty 'id'
				if (!id) {
					console.warn(`Skipping line ${i + 1}: Empty 'id' found.`);
					continue;
				}

				// If 'qrcode' is not empty, add a line to the 'qrcodes' section
				if (qrcode) {
					const newQrcodeLine = `,${qrcode},${id}`;
					outputLines.push(newQrcodeLine);
				}
			}
		}

		// Return final CSV content as string with \r\n line endings
		return outputLines.join('\r\n');
	}


	async function generateByImages(importZip) {
		const outputLines = [];

		// Add the 'cid_data' header
		outputLines.push("cid_data");
		outputLines.push("");

		// Add the 'users' header
		outputLines.push("users");
		outputLines.push("id,registration,name,password,panic_password,salt,panic_salt,expires,user_type_id,begin_time,end_time,image_timestamp,last_access");

		// Array to hold promises for async operations
		const processingPromises = [];

		// Iterate through all files in the zip
		importZip.forEach(async function (relativePath, zipEntry) {
			// Skip if not in the 'user_images' folder or if it's a directory
			if (relativePath.substr(0, 12) !== "user_images/" || zipEntry.dir) {
				return;
			}

			// Extract id and name from the filename
			const filename = relativePath.substr(12); // Remove 'user_images/' prefix
			const names = filename.split(' - ');
			const name = names[1].split('.').slice(0, -1).join('.'); // Remove the file extension
			const id = names[0]
			// Validate id and name
			if (!id || !name) {
				console.warn(`Skipping file ${filename}: Invalid filename format.`);
				return;
			}

			// Add the user data to the output
			const newLine = `${id},,${name},,,,,,,0,0,,`;
			outputLines.push(newLine);
		});

		// Wait for all async operations to complete
		await Promise.all(processingPromises);

		// Return the output as a CSV string
		return outputLines.join('\r\n'); // Use \r\n for Windows-style line endings
	}

	var str_url;

	var fr = new FileReader();
	var affectedUsers = [];

	fr.onload = function (e) {
		var zip = new JSZip();
		var data = MessengerUtil.send('get_configuration', { general: ['keep_user_image'] }).general;

		zip.loadAsync(e.target.result).then(async function (zip) {
			// Users must be read first so that they all exist when user images are imported
			if (easyImport && document.getElementById('chkNameIdImage').checked) {
				let generatedCSv = await generateByImages(zip);
				await readCSVcontent(generatedCSv);
				if (data.keep_user_image === '1') {
					await readUserImages(zip, errorObj);
				}
				await __modal.updateProgress(100, "Finished!");
				setTimeout(function () {
					let modalString = errorObj.errorString == "" ? "Import executed successfully" : "Import executed with errors"
					if (errorObj.warning != "") {
						modalString += ". Attention: some tables presented conflicts" + errorObj.warning
					}
					openResultModal(modalString);
					var rebootAlert = new Modal();
					rebootAlert.setTitle('Import');
					let rebootMsg = "Import completed successfully. Restarting the device.";
					if(errorObj.errorString != "" || errorObj.warning != "") {
						rebootMsg = 'Rebooting device' + (errorObj.errorString == "" ? "" : "\nCheck file errors.txt")
						+ (errorObj.warning == "" ? "" : "\nAttention: some tables presented conflicts" + errorObj.warning)
					}
					rebootAlert.setContent(rebootMsg);
					rebootAlert.show();
					if (errorObj.errorString != "") {
						saveTextAsFile("errors.txt", errorObj.errorString);
					}
					setTimeout(function () {
						var time = 60;
						MessengerUtil.sendAsync('reboot', null, null, false);
						Main.sessionFail({ error: 'customError' }, function () {
							setInterval(function () {
								time--;
								if (time == 0)
									window.location = 'login.html';
								$('#countReboot').html(('00' + time).slice(-2));
							}, 1000);

						}, 'Wait!', 'Restarting Equipment', 'Wait' + '<span id=\"countReboot\">' + ('00' + time).slice(-2) + '</span> ' + 'seconds for the equipment to restart.', true);
					}, 10000);
				}, 2000);
			} else {
				zip.file(importFileName).async('string').then(async function (csv) {
					try {
						if (easyImport) {
							let modifiedCsv = convertCSV(csv);
							await readCSVcontent(modifiedCsv);
						} else {
							await readCSVcontent(csv);
						}
						if (data.keep_user_image === '1') {
							await readUserImages(zip, errorObj);
						}
					await __modal.updateProgress(100, "Finished!");
						setTimeout(function () {
						let modalString = errorObj.errorString == "" ? "Import executed successfully" : "Import executed with errors"
							if (errorObj.warning != "") {
							modalString += ". Attention: some tables presented conflicts" + errorObj.warning
							}
							openResultModal(modalString);
							var rebootAlert = new Modal();
							rebootAlert.setTitle('Import');
							let rebootMsg = "Import completed successfully. Restarting the device.";
							if(errorObj.errorString != "" || errorObj.warning != "") {
								rebootMsg = '"Rebooting device' + (errorObj.errorString == "" ? "" : "\nCheck file errors.txt")
								+ (errorObj.warning == "" ? "" : "\nAttention: some tables presented conflicts" + errorObj.warning)
							}
							rebootAlert.setContent(rebootMsg);
							rebootAlert.show();
							if (errorObj.errorString != "") {
								saveTextAsFile("errors.txt", errorObj.errorString);
							}
							setTimeout(function () {
								var time = 60;
								MessengerUtil.sendAsync('reboot', null, null, false);
								Main.sessionFail({ error: 'customError' }, function () {
									setInterval(function () {
										time--;
										if (time == 0)
											window.location = 'login.html';
										$('#countReboot').html(('00' + time).slice(-2));
									}, 1000);

							}, 'Wait!', 'Restarting Equipment', 'Wait' + '<span id=\"countReboot\">' + ('00' + time).slice(-2) + '</span> ' + 'seconds for the equipment to restart.', true);
							}, 10000);
						}, 2000);
					} catch (e) {
						// Avoid to continue executing other methods if import fails.
						console.error("outer", e.message);
					}
				});
			}
		});

	}

	async function readUserImages(importZip, errorObj) {
		var totalImages = affectedUsers.length;
		var transferredImages = 0;
		var userImages = [];
		importZip.forEach(async function (relativePath, zipEntry) {

			if (relativePath.substr(0, 12) !== "user_images/" || zipEntry.dir)
				return;
			let user_id;
			if (easyImport && document.getElementById('chkNameIdImage').checked) {
				user_id = parseInt(relativePath.substr(12).split("")[0]);
			} else {
				user_id = parseInt(relativePath.substr(12).split(' - ')[0]);
			}

			var returnMessage
			if (affectedUsers.find(id => id === user_id)) {
				userImages.push(importZip.file(relativePath).async("uint8array").then(function (file) {
					returnMessage = MessengerUtil.sendFile('user_set_image', file, 'user_id=' + user_id + '&timestamp=' + Math.floor(Date.now() / 1000) + '&import=' + Number(easyImport));
					if (returnMessage.hasOwnProperty('error') || returnMessage.success == false) {
						errorObj.errorString += "Error on enrolling face of user " + user_id + "\n";
						errorObj.errorString += JSON.stringify(returnMessage) + "\n\n";
					}
				}));
				await userImages[userImages.length - 1];

				transferredImages++;
				var progress = 70 + parseInt(transferredImages / totalImages * 30);
				await __modal.updateProgress(progress, "Importing user images " + "(" + transferredImages + "/" + totalImages + ")" );
			}
		});
		return Promise.all(userImages);
	}

	async function readCSVcontent(contents) {
		var dados = {};
		var metadata = {};
		var result = { success: true };
		var lastKey = null;
		var lstLinhas = contents.split('\r\n');

		//Primeiro, metadados
		var j = 0;
		var compatibility_backup = false;
		if (lstLinhas[0] == 'cid_metadata') {
			while (lstLinhas[j] != 'cid_data') {
				if (lstLinhas[j].length > 0 && lstLinhas[j] != 'cid_metadata') {
					if (lastKey === null) {
						lastKey = lstLinhas[j];
						metadata[lastKey] = [lstLinhas[++j]];
					} else {
						metadata[lastKey].push(lstLinhas[j]);
					}
				} else {
					lastKey = null;
				}
				j++;
			}
		} else {
			compatibility_backup = true;
		}
		var lastKey = null;
		// Ao final, j contém o indice para o começo de cid_data
		//Segundo, dados
		for (var i = j; i < lstLinhas.length; i++) {
			if (lstLinhas[i].length > 0 && lstLinhas[i] != 'cid_metadata' && lstLinhas[i] != 'cid_data') {
				if (lastKey === null) {
					lastKey = lstLinhas[i];
					dados[lastKey] = [lstLinhas[++i]];
				} else {
					dados[lastKey].push(lstLinhas[i]);
				}
			} else
				lastKey = null;
		}

		// 1) Deletar a custom_tables e custom_columns
		var user_types_keep_curr = null;
		if (columns_to_ignore)
			user_types_keep_curr = (Object.keys(columns_to_ignore).length != 0);
		if ((!isUsers || (user_types_keep_curr != null && !user_types_keep_curr))) {
			var _data = MessengerUtil.send('load_objects', { object: 'custom_tables' });
			var ids_to_delete = []
			_data.custom_tables.forEach(function (entry) {
				if (compatibility_backup) {
					if (entry['table_name'] != 'c_users' && entry['table_name'] != 'c_visits') {
						ids_to_delete.push(entry['id']);
					}
				} else {
					ids_to_delete.push(entry['id']);
				}
			});

			if (ids_to_delete.length != 0)
				MessengerUtil.send('object_remove', { ids: ids_to_delete });

			// 2) Recria as tabelas deletadas no passo anterior
			while (!compatibility_backup && Object.keys(metadata).length > 0) {
				var curr_key = Object.keys(metadata)[0];
				var splitted_key = curr_key.split(",");
				var _fields = metadata[curr_key][0].split(',');
				var table_name = splitted_key[0];
				var table_label = splitted_key[1];
				var table_id = splitted_key[2];

				var column_metadata = [];
				// Para cada column_metadata, cria o objeto e faz a chamada para o FCGI
				for (var i = 1; i < metadata[curr_key].length; i++) {
					var _values = metadata[curr_key][i].split(",");
					var cur_column_metadata = {};

					for (var j = 0; j < _fields.length; j++) {
						// if foreign_key_object
						if (_fields[j] == 'foreign_key_object' && _values[j] != "") {
							if (cur_column_metadata['foreign_key'] == undefined) {
								cur_column_metadata['foreign_key'] = {};
							}
							cur_column_metadata['foreign_key']['object'] = _values[j];

						} else if (_fields[j] == 'foreign_key_field' && _values[j] != "") { // if foreign_key_fields
							cur_column_metadata['foreign_key']['field'] = _values[j];
						} else if (_fields[j] == 'unique') { // if unique
							if (_values[j] == "0") {
								cur_column_metadata[_fields[j]] = false;
							} else {
								cur_column_metadata[_fields[j]] = true;
							}
						} else if (_fields[j] == 'constraint') { // if constraint
							if (_values[j] == '2' || _values[j] == '6')
								cur_column_metadata[_fields[j]] = "FOREIGN_KEY";
							else if (_values[j] == '5')
								cur_column_metadata[_fields[j]] = "PRIMARY_KEY";
							else if (_values[j] == '4')
								cur_column_metadata[_fields[j]] = "NOT_NULL";
						} else {
							cur_column_metadata[_fields[j]] = _values[j]
						}

					}
					column_metadata.push(cur_column_metadata);
				}
				MessengerUtil.send('object_add',
					{
						object: table_name,
						name: table_label,
						id: parseInt(table_id),
						fields: column_metadata
					}
				);
				delete metadata[curr_key];
			}
		}
		// 3) Enviar cada tabela (1 de cada vez) para ser importada pelo fcgi
		var maxLength = 100 * 1000;
		var metadata_keys = [];

		Object.keys(metadata).forEach(function (__curr) {
			metadata_keys.push(__curr.split(',')[0]);
		});

		function resolution_key_column(import_data, resolution_key) {
			var import_colunms = import_data[0].split(',');
			var column_number = null;
			for (var i = import_colunms.length - 1; i >= 0; i--) {
				if (import_colunms[i] === resolution_key) {
					column_number = i;
					break;
				}
			}

			return column_number; //Erro: não foi encontrada a resolution_key dentro dos parametros importados
		}

		function order_by_resolution(import_data, resolution_key_column) {
			var data_header = import_data[0];
			import_data.splice(0, 1);
			var import_colunms = data_header.split(',');

			import_data.sort(function (a, b) {
				var a_splitted = a.split(',');
				var b_splitted = b.split(',');
				if (Number(a_splitted[resolution_key_column]) < Number(b_splitted[resolution_key_column]))
					return -1;
				else if (Number(a_splitted[resolution_key_column]) > Number(b_splitted[resolution_key_column]))
					return 1;
				else
					return 0;
			});

			import_data.unshift(data_header);
			return import_data;
		}

		function dataToBeSent() {
			var length = 0;
			for (const key of Object.keys(dados)) {
				length += dados[key].length
			}
			return length;
		}

		var totalData = dataToBeSent();
		var second_time = {}
		while (Object.keys(dados).length > 0 && result.success == true) {
			var dataLeft = dataToBeSent();
			var imported_data = totalData - dataLeft
			var progress = parseInt(imported_data / totalData * 70);
			var dataProgress = Math.floor((100*imported_data) / totalData);
			await __modal.updateProgress(progress, "Importando dados " + "(" + dataProgress + "%)");

			var key = Object.keys(dados)[0];
			if (user_types_keep_curr == false || (metadata_keys.indexOf(key) == -1 && (key != "user_types"))) {
				if (second_time[key] === undefined) {
					second_time[key] = true;
				} else if (resolution[key] != undefined) {
					resolution[key][0].remaining = "KEEP";
				}
			}
			var _continue = true;
			var send = [];
			var length = 0;

			var resolution_column = null;
			if (resolution[key] !== undefined) {
				resolution_column = resolution_key_column(dados[key], resolution[key][0].resolution);
				dados[key] = order_by_resolution(dados[key], resolution_column);
			}

			while (_continue && Object.keys(dados).length > 0 && length < maxLength) {
				if (user_types_keep_curr == true && (metadata_keys.indexOf(key) != -1 || (key == "user_types"))) {
					while (dados[key].length > 1)
						dados[key].splice(1, 1);
				} else {
					send.push(key);
					send.push(dados[key][0]);
					while (dados[key].length > 1) {
						send.push(dados[key][1]);
						length += dados[key][1].length;
						dados[key].splice(1, 1);
						if (length >= maxLength) {
							if (dados[key].length <= 1 || resolution_column === null)
								break;

							var curr_splitted = send[send.length - 1].split(',');
							var next_splitted = dados[key][1].split(',');
							if (curr_splitted[resolution_column] !== next_splitted[resolution_column])
								break;
						}
					}
				}

				send.push('');
				_continue = false;
				if (dados[key].length === 1) {
					delete dados[key];
				}
			}

			var base_url = '/import_objects.fcgi';

			var query_string_params = {};

			if ((isUsers && resolution[key]) || key == 'devices') {
				query_string_params['resolution'] = Main.bigJSONstringify(resolution[key]);
			}


			if (isUsers && columns_to_ignore) {
				query_string_params['ignore_columns'] = Main.bigJSONstringify(columns_to_ignore);
			}
			if (tables_to_ignore) {
				query_string_params['ignore_tables'] = Main.bigJSONstringify(tables_to_ignore);
			}

			// Montagem da query_string
			str_url = base_url;
			var query_string_keys = [];
			query_string_keys = Object.keys(query_string_params);
			if (query_string_keys.length != 0) {
				str_url += "?"
				query_string_keys.forEach(function (__param_key) {
					str_url += __param_key + "=" + query_string_params[__param_key] + "&";
				});
				str_url = str_url.substr(0, str_url.length - 1);
			}

			result = import_file_send(send.join('\r\n'), Object.keys(dados).length === 0);

			if (send[0] === 'users') {
				const users = result.data.users;
				if (typeof users !== 'undefined') {
					affectedUsers = affectedUsers.concat(users.inserted, users.updated);
				}
			}
		}

		var data = MessengerUtil.send('load_objects', { object: 'devices' });
		if (data.devices.length === 1 && data.devices[0].id !== Main.currentDeviceID()) {
			var other_device = data.devices[0];
			MessengerUtil.send('modify_objects', {
				object: 'devices',
				values: {
					id: Main.currentDeviceID(),
					ip: '',
					name: '',
					public_key: ''
				},
				where: { devices: { id: other_device.id } }
			});
		} else if (data.devices.length > 1) {
			var need_to_create = true;
			data.devices.forEach(function (currd) {
				if (currd.id === Main.currentDeviceID()) {
					need_to_create = false;
				}
			});
			if (need_to_create) {
				MessengerUtil.send('create_objects', {
					object: 'devices',
					values: [{
						id: Main.currentDeviceID(),
						ip: '',
						name: '',
						public_key: ''
					}]
				});
			}
		}
		if (result.success == false) {
			throw Error();
		}
	}

	function openResultModal(message) {
		if (__modal != null)
			__modal.hide();

		var _modal = new Modal();
		_modal.setTitle('Import');
		_modal.setContent(message);
		_modal.addButton([
			{
				'type': 'cancel',
				'text': 'OK'
			}
		]);
		_modal.show();
	}

	fr.readAsArrayBuffer(file);
}

function openDebugModal(deviceSerial){
	var debugModal = $('<div class="modal hide fade bg-grey" data-backdrop="static" tabindex="-1"></div>');
	$('body').append(debugModal);
	debugModal.html(
		'<div class="modal-body font-white" style="background-color: #0057b7">' +
		'<button type="button" class="close" data-dismiss="modal" aria-hidden="true"></button>' +
		'<center>' +
			'<h3>Debug tools</h3>' +
		'</center>' +
		'<br />' +
		// Campo Serial
		'<div style="margin-bottom: 15px;">' +
			'<label style="color: white; font-weight: bold;">Serial: ' + deviceSerial + '</label>' +
		'</div>' +
		// Separador Token
		'<hr style="border: 0; border-top: 1px solid white; margin: 5px 0;" />' +
		'<div id="tempPasswordDiv" style="display: flex; flex-direction: column; gap: 10px;">' +
			'<div id="tokenStatusContainer" style="display: none; padding: 10px; border-radius: 5px; margin-bottom: 10px;">' +
				'<div id="tokenStatusText" style="font-size: 14px; font-weight: bold;"></div>' +
				'<div id="tokenRemainingTime" style="font-size: 12px; margin-top: 5px;"></div>' +
			'</div>' +
			'<div style="display: flex; gap: 10px; align-items: flex-end;">' +
				'<div id="passwordInputContainer" style="flex: 1;">' +
					'<label for="tempPasswordInput" style="color: white;">Password</label>' +
					'<input id="tempPasswordInput" class="form-control" placeholder="Enter token password" />' +
				'</div>' +
				'<button id="tempPasswordBtn" class="btn btn-warning" style="height: 38px; white-space: nowrap;">Activate</button>' +
				'<button id="blockPasswordBtn" class="btn btn-danger" style="height: 38px; white-space: nowrap; display: none;">Block</button>' +
			'</div>' +
			'<div id="tempPasswordStatus" style="font-size: 12px; margin-top: 5px; color: white;"></div>' +
		'</div>' +
		// Separador Plugin Verbosity
		'<hr style="border: 0; border-top: 1px solid white; margin: 5px 0;" />' +
		'<div id="pluginVerbosityDiv" style="display: none; flex-direction: column; gap: 20px;">' +
			'<div style="display: flex; gap: 20px; align-items: flex-end;">' +
				'<div style="flex: 1;">' +
					'<label for="pluginInput" style="color: white;">Plugin</label>' +
					'<input type="text" id="pluginInput" class="form-control" />' +
				'</div>' +
				'<div style="flex: 1;">' +
					'<label for="verbosityInput" style="color: white;">Verbosity</label>' +
					'<input type="text" id="verbosityInput" class="form-control" />' +
				'</div>' +
				'<button id="pluginVerbosityOkBtn" class="btn btn-primary" style="height: 38px; display: flex; align-items: center; justify-content: center; white-space: nowrap;">ok</button>' +
			'</div>' +
			'<hr style="border: 0; border-top: 1px solid white; margin: 5px 0;" />' +
			'<div style="display: flex; justify-content: center; margin-top: 10px;">' +
				'<button id="screenlogBtn" class="btn btn-secondary" style="height: 28px; width: 120px; font-size: 13px; display: flex; align-items: center; justify-content: center; white-space: nowrap;">enable screenlog</button>' +
			'</div>' +
			'<hr style="border: 0; border-top: 1px solid white; margin: 5px 0;" />' +
			'<div style="display: flex; flex-direction: column; gap: 10px;">' +
				'<div>' +
					'<label for="postofficeMessage" style="color: white; display: block; margin-bottom: 5px;">PostOffice (JSON)</label>' +
					'<textarea id="postofficeMessage" class="form-control" rows="4" placeholder=\'{"message": "example", "reply":true, "params":{}}\' style="width: 100%; resize: vertical;"></textarea>' +
				'</div>' +
				'<div style="display: flex; justify-content: center;">' +
					'<button id="postofficeBtn" class="btn btn-primary" style="height: 38px; width: 120px;">Enviar</button>' +
				'</div>' +
				'<div>' +
					'<label style="color: white; display: block; margin-bottom: 5px;">Resposta</label>' +
					'<div id="postofficeResponse" style="background-color: #1a1a1a; border: 1px solid #444; border-radius: 4px; padding: 10px; min-height: 100px; color: #fff; font-family: monospace; overflow-x: auto; word-wrap: break-word;"></div>' +
				'</div>' +
			'</div>' +
		'</div>' +
		'</div>');

	// Variáveis de controle
	var engineeringUnlocked = false;
	var currentToken = null;

	// Função para atualizar a exibição do token
	function updateTokenDisplay(tokenData) {
		
		if (tokenData.validated) {
			// Token válido - exibir em verde com o token visível
			$('#tokenStatusContainer').show().css('background-color', '#28a745');
			$('#tokenStatusText').html('<strong>Token: ' + (tokenData.token || 'Active') + '</strong>').css('color', '#fff');
			$('#tokenRemainingTime').text('Time remaining: ' + tokenData.remaining_minutes + ' minutes').css('color', '#fff');
			$('#passwordInputContainer').hide();
			$('#tempPasswordBtn').hide();
			$('#blockPasswordBtn').show();
			$('#tempPasswordStatus').hide();
			engineeringUnlocked = true;
			currentToken = tokenData.token;
			
			// Mostrar opções de engenharia quando token está validado
			$('#pluginVerbosityDiv').css('display', 'flex');
		} else if (tokenData.token) {
			// Token criado mas não validado - exibir em amarelo aguardando senha
			$('#tokenStatusContainer').show().css('background-color', '#ffc107');
			$('#tokenStatusText').html('<strong>Token: ' + tokenData.token + '</strong>').css('color', '#212529');
			$('#tokenRemainingTime').text('Waiting for activation').css('color', '#212529');
			$('#passwordInputContainer').show();
			$('#tempPasswordBtn').show().text('Activate');
			$('#blockPasswordBtn').hide();
			currentToken = tokenData.token;
			$('#tempPasswordStatus').text('Enter the password to activate the token').css('color', '#ffc107');
			$('#tempPasswordInput').val('').focus();
		} else {
			// Sem token - permitir geração de novo token
			$('#tokenStatusContainer').show().css('background-color', '#6c757d');
			$('#tokenStatusText').html('<strong>Token: Not available</strong>').css('color', '#fff');
			$('#tokenRemainingTime').text('No active token').css('color', '#fff');
			$('#passwordInputContainer').hide();
			$('#tempPasswordBtn').show().text('Generate Token');
			$('#blockPasswordBtn').hide();
			currentToken = null;
			$('#tempPasswordStatus').text('Click to generate a new token').css('color', '#6c757d');
		}
	}

	// Obter status inicial do token
	var tokenResponse = MessengerUtil.send('engineering_token', {});
	updateTokenDisplay(tokenResponse);

	// Evento de ativação/geração de token
	debugModal.find('#tempPasswordBtn').on('click', function () {
		var password = $('#tempPasswordInput').val();
		
		// Se não há token atual, gerar um novo
		if (!currentToken) {
			var tokenResponse = MessengerUtil.send('engineering_token', {});
			updateTokenDisplay(tokenResponse);
			
			if (tokenResponse.token) {
				$('#tempPasswordStatus').text('New token generated! Enter the password to activate.').css('color', '#28a745');
				currentToken = tokenResponse.token;
			} else if (tokenResponse.error) {
				$('#tempPasswordStatus').text('Error: ' + tokenResponse.error).css('color', '#dc3545');
			} else {
				$('#tempPasswordStatus').text('Error generating token.').css('color', '#dc3545');
			}
			return;
		}
		
		// Validar senha
		if (!password) {
			$('#tempPasswordStatus').text('Please enter the token password.').css('color', '#dc3545');
			$('#tempPasswordInput').focus();
			return;
		}
		
		// Enviar senha para validação
		var validationResponse = MessengerUtil.send('engineering_token', {
			password: password
		});
		
		// Atualizar display baseado na resposta
		if (validationResponse.validated) {
			// Sucesso na validação
			updateTokenDisplay(validationResponse);
			$('#tempPasswordStatus').text('Token activated successfully!').css('color', '#28a745');
			$('#tempPasswordInput').val('');
			
			// Mostrar opções de engenharia
			$('#pluginVerbosityDiv').css('display', 'flex');
		} else if (validationResponse.error) {
			// Erro na validação
			$('#tempPasswordStatus').text('Error: ' + validationResponse.error).css('color', '#dc3545');
			$('#tempPasswordInput').val('').focus();
			
			// Se token expirou ou foi invalidado, resetar
			if (validationResponse.error.includes('expired') || validationResponse.error.includes('invalid')) {
				currentToken = null;
				updateTokenDisplay({token: null, validated: false});
			}
		} else {
			// Senha incorreta
			$('#tempPasswordStatus').text('Incorrect password. Please try again.').css('color', '#dc3545');
			$('#tempPasswordInput').val('').focus();
		}
	});
	
	// Evento de bloqueio do token
	debugModal.find('#blockPasswordBtn').on('click', function () {
		// Enviar comando de bloqueio
		var blockResponse = MessengerUtil.send('engineering_token', {
			block: true
		});
		
		// Resetar estado
		engineeringUnlocked = false;
		currentToken = null;
		
		// Ocultar divs de engenharia
		$('#pluginVerbosityDiv').hide();
		
		// Atualizar display para estado bloqueado
		updateTokenDisplay({token: null, validated: false});
		$('#tempPasswordStatus').text('Token blocked successfully.').css('color', '#28a745');
		
		// Ocultar toda a div de token após 2 segundos
		setTimeout(function() {
			debugModal.modal('hide');
		}, 2000);
	});

	// Enter key handler para o campo de senha
	debugModal.find('#tempPasswordInput').on('keypress', function(e) {
		if (e.which === 13) { // Enter key
			$('#tempPasswordBtn').click();
		}
	});

		// Add click event to screenlogBtn
		debugModal.find('#screenlogBtn').on('click', function() {
			let screenlogBtn = $('#screenlogBtn');
			if (!debugModal.data('screenlogClicked')) {
				console.log('Screenlog button clicked');
				screenlogBtn.text('get screenlog');
				debugModal.data('screenlogClicked', true);
				MessengerUtil.send('enable_screenlog');
			} else {
				console.log('Get screenlog clicked');
				var data = MessengerUtil.send('get_screenlog');
				var date = getFormatedDate();
				var dataSystem = MessengerUtil.send('system_information', null, null, false);
				var dataFirmware = dataSystem.version
				var dataSerial = dataSystem.serial;
				dataSerial = dataSerial.replace('/','-');
				var fileName = 'screenlog_' + 'V' + dataFirmware + '_' + dataSerial + '_' + date + '.txt';
				saveTextAsFile(fileName, data);
			}
		});

		// Add click event to postoffice send button
		debugModal.find('#postofficeBtn').on('click', function() {
			var messageJson = $('#postofficeMessage').val();
			if (!messageJson) {
				$('#postofficeResponse').html('<span style="color: red;">Por favor, insira uma mensagem JSON</span>');
				return;
			}
			
			try {
				var jsonData = JSON.parse(messageJson);
				var response = MessengerUtil.send('postoffice', jsonData);
				$('#postofficeResponse').html('<pre>' + JSON.stringify(response, null, 2) + '</pre>');
			} catch (e) {
				$('#postofficeResponse').html('<span style="color: red;">Erro: JSON inválido - ' + e.message + '</span>');
			}
		});

	// Add click event to pluginVerbosityOkBtn
	debugModal.find('#pluginVerbosityOkBtn').on('click', function() {
		const plugin = $('#pluginInput').val();
		const verbosity = $('#verbosityInput').val();
		if (plugin && verbosity) {
			const obj = {};
			obj[plugin] = { 'log_verbosity': verbosity };
			MessengerUtil.send('set_configuration', obj);
		}
	});
	
	debugModal.modal();
	debugModal.on("hidden", function() {
		debugModal.html('');
		debugModal.remove();
	});
}

function openAboutModal(){
	//ajax para preencher os campos
	// TODO: Utilizar Main.getInfo()
	var data = MessengerUtil.send('system_information', null, null, false);
	var sec_box_info = MessengerUtil.send(
		'get_configuration',
		{
			'osdp': [
				'enabled'
			],
			'rs485': [
				'enabled'
			]
		}
	);

	var osdpEnabled = sec_box_info.osdp.enabled === '1';
	var rs485Enabled = sec_box_info.rs485.enabled === '1';

	var secbox_is_active = !(osdpEnabled || rs485Enabled);

	var aboutModal = $('<div class="modal hide fade bg-grey" data-backdrop="static" tabindex="-1"></div>');
	$('body').append(aboutModal)
	aboutModal.html(
		'<div class="modal-body font-white" style="background-color: #0057b7">' +
		'<button type="button" class="close" data-dismiss="modal" aria-hidden="true"></button>' +
		'<center>' +
			'<div style="position:relative;display:inline-block;">' +
				'<img src="/images/logoW.png" width="250px" />' +
				'<button id="hiddenFirmwareBtn" style="position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;pointer-events:auto;z-index:10;cursor:default"></button>' +
			'</div>' +
		'</center>' +
		'<br />' +
		'<h3>Device: ' + (data.device_two_names) + '</h3>' +
		'<h3>Serial: ' + data.serial + '</h3>' +
		'<h3>Firmware: ' + data.version + '</h3>' +
		(secbox_is_active && Main.has_SecBox() ?
		((Main.iDBlockNext_mode() ? '<h3>Firmware da Catraca: ' + getTurnstileFirmwareVersion() + '</h3>':
		'<h3>SecBox: ' + getSecBoxFirmwareVersion() + '</h3>')) : '') +
		'<h3>MAC: ' + data.network.mac + '</h3>' +
		'<h3>Device ID: ' + data.device_id + '</h3>' +
		'<h5><a href="https://www.hidglobal.com/sales-policy/on-premise-software-eula" style="color: white">Click here to acces information on terms and conditions of use</a></h5>' +
		'</div>');

	// Evento de clique no botão oculto
	aboutModal.find('#hiddenFirmwareBtn').on('click', function() {
		if (!aboutModal.data('hiddenBtnClickCount')) {
			aboutModal.data('hiddenBtnClickCount', 0);
		}
		let count = aboutModal.data('hiddenBtnClickCount') + 1;
		aboutModal.data('hiddenBtnClickCount', count);
		
		if (count >= 10) {
			// Resetar contador
			aboutModal.data('hiddenBtnClickCount', 0);
			
			// Fechar modal About e abrir modal Debug
			aboutModal.modal('hide');
			openDebugModal(data.serial);
		}
	});
	
	aboutModal.modal()
	aboutModal.on("hidden", function() {
		aboutModal.html('');
		aboutModal.remove();
	});
}

function getSecBoxFirmwareVersion() {
	let fw_version = MessengerUtil.send('update_secbox_firmware_version');
	let hex_fw_version = fw_version.fw_version.toString(16);
	if (0 != hex_fw_version) {
		return '2.' + hex_fw_version[0] + '.' + hex_fw_version[2];
	} else {
		return 'SecBox V2 not found';
	}
}

function getTurnstileFirmwareVersion() {
	try {
		let fw_version = MessengerUtil.send('update_secbox_firmware_version');
		let hex_fw_version = fw_version.fw_version.toString(16);
		let int_fw_version = parseInt(hex_fw_version);
		if (int_fw_version == 0) {
			return 'Turnstile not found';
		} else if (int_fw_version < 10) {
			return '4.0.' + hex_fw_version;
		}
		return '4.' + hex_fw_version[0] + '.' + hex_fw_version[2];
	} catch (e) {
		return 'Turnstile not found';
	}
}

var modal_memoryUseEdit = $('#modal_memoryUseEdit').clone().end().remove();
function openMemoryUseModal(){
	var md = new Modal();
	md.setTitle('Memory Usage');
	md.setHTMLContent(modal_memoryUseEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	var isOn;

	function save(returnMessage){
		var clear_expired_users = 'all';
		if (md.getContent().find('#clear_users_visitors').is(':checked')) {
			clear_expired_users = 'visitors';
		}
		else if (md.getContent().find('#clear_users_disable').is(':checked')) {
			clear_expired_users = 'disable';
		}
		var data = MessengerUtil.send('set_configuration', {
			'identifier' : { 'verbose_logging' : isOn },
			'general' : { 'clear_expired_users': clear_expired_users }
		});
		returnMessage(data);
	}

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function(){
			var data = MessengerUtil.send('get_configuration', {
				'general': [ 'clear_expired_users' ],
				'identifier' : ['verbose_logging']
			});
			isOn = data.identifier.verbose_logging;
			md.getContent().find('#chkVerbose').parent().bootstrapSwitch();
			md.getContent().find('#chkVerbose').parent().bootstrapSwitch('setState', isOn == "1");
			md.getContent().find('#chkVerbose').parent().parent().on('switch-change', function (e, data) {
				log();
			});
			log();
			switch (data.general.clear_expired_users) {
				case "all":
					md.getContent().find('#clear_users_all').attr('checked', 'checked');
					break;
				case "visitors":
					md.getContent().find('#clear_users_visitors').attr('checked', 'checked');
					break;
				case "disable":
					md.getContent().find('#clear_users_disable').attr('checked', 'checked');
					break;
				default:
					md.getContent().find('#clear_users_all').attr('checked', 'checked');
			}

			function log(){
				var log;
				if(md.getContent().find('#chkVerbose').parent().hasClass('switch-on')){
					isOn = '1';
					log = 'Logs all types of access, including unidentified. Uses more memory.';
				}
				else{
					isOn = '0'
					log = 'Logs only granted and denied access.';
				}
				md.getContent().find('#log').html(log);
			}
		});
	}
}

function openUSBModal(){
	var md = new Modal();
	md.setTitle('USB');
	md.setHTMLContent($('#modal_USBEdit'));
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	md.show(function(){

		var data = MessengerUtil.send(
			'get_configuration',
			{
				'general': ['usb_port_enabled']
			}
		);
		md.getContent().find('#chkButtonUSBPortEnabled').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonUSBPortEnabled').parent().bootstrapSwitch('setState', data.general.usb_port_enabled == '1');
	});

	function save (returnMessage) {
		let usb_port_enabled = md.getContent().find('#chkButtonUSBPortEnabled').parent().bootstrapSwitch('status')? "1" : "0";
		let data = MessengerUtil.send(
			'set_configuration',
			{
				'general': {'usb_port_enabled': usb_port_enabled}
			}
		);
		returnMessage(data);
	}
}

var modal_LightEdit = $('#modal_lightingEdit').clone().end().remove();
function openLightingModal(){
	var warning_modal = new Modal();
	warning_modal.setTitle('Lighting');
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);

	var md = new Modal();
	md.setTitle('Lighting');
	md.setHTMLContent(modal_LightEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);


	var colorInitial;
	var colorEnd;
	var colorFix;

	function save(returnMessage){
		var ajaxResponse;
		if(Main.isiDBlockNextPrimary()) {
			var newEvent;
			if(md.getContent().find('#noLigth').hasClass('active'))
				newEvent = 3
			else if(md.getContent().find('#ligthFixed').hasClass('active'))
				newEvent = 4

			var rgbFix = colorFix.getColorRGB();
			var solid_red = rgbFix.r;
			var solid_green = rgbFix.g;
			var solid_blue = rgbFix.b;
			var hexColor = solid_red.toString(16).padStart(2, '0') +
							solid_green.toString(16).padStart(2, '0') +
							solid_blue.toString(16).padStart(2, '0');

			var data = MessengerUtil.send('remote_led_control', {
				event: newEvent,
				color: hexColor
			});
			if(data.error != undefined)
				ajaxResponse = data.error;
			else
				ajaxResponse = true;
		} else {
			var newState;
			if(md.getContent().find('#noLigth').hasClass('active'))
				newState = '1'
			else if(md.getContent().find('#ligthFixed').hasClass('active'))
				newState = '2'
			else if(md.getContent().find('#ligthTransition').hasClass('active'))
				newState = '3'

			var rgbInitial = colorInitial.getColorRGB();
			var rgbEnd = colorEnd.getColorRGB();
			var rgbFix = colorFix.getColorRGB();

			var data = MessengerUtil.send('set_configuration', {
				led_rgb: {
					state: newState,
					solid_red: transform255to65000(rgbFix.r),
					solid_green: transform255to65000(rgbFix.g),
					solid_blue: transform255to65000(rgbFix.b),
					transition_start_red: transform255to65000(rgbInitial.r),
					transition_start_green: transform255to65000(rgbInitial.g),
					transition_start_blue: transform255to65000(rgbInitial.b),
					transition_end_red: transform255to65000(rgbEnd.r),
					transition_end_green: transform255to65000(rgbEnd.g),
					transition_end_blue: transform255to65000(rgbEnd.b)
				}
			});
			if(data.error != undefined)
				ajaxResponse = data.error;
			else{
				ajaxResponse = true;
				//aqui chamo o ajax para efetivamente modificar as cores do led
				MessengerUtil.send('led_rgb_refresh', null, null, false);
			}
		}

		returnMessage(ajaxResponse);
	}

	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function(){
			if(Main.isiDBlockNextPrimary()){
				var data = MessengerUtil.send('remote_led_control',{
					event: 2
				})
				var initial_color = data.led_initial_color
				var red = (initial_color >> 16) & 0xFF;
				var green = (initial_color >> 8) & 0xFF;
				var blue = initial_color & 0xFF;

				md.getContent().find('#ligthTransition').hide()
				md.getContent().find('#tab_ligthTransition').hide()

				if(data.led_initial_color == "0"){
					md.getContent().find('#noLigth').addClass('active');
					md.getContent().find('#tab_noLigth').addClass('active');
				} else {
					md.getContent().find('#ligthFixed').addClass('active');
					md.getContent().find('#tab_ligthFixed').addClass('active');
				}

				colorFix = new Color(md.getContent().find('#fix'));
				colorFix.setColorRGB(red, green, blue);
			} else{
				var data = MessengerUtil.send('get_configuration', {
					led_rgb: ['state', 'solid_red', 'solid_green', 'solid_blue', 'transition_start_red', 'transition_start_green', 'transition_start_blue', 'transition_end_red', 'transition_end_green', 'transition_end_blue']
				}).led_rgb;

				if(data.state == "1"){
					md.getContent().find('#noLigth').addClass('active');
					md.getContent().find('#tab_noLigth').addClass('active');
				}
				if(data.state == "2"){
					md.getContent().find('#ligthFixed').addClass('active');
					md.getContent().find('#tab_ligthFixed').addClass('active');
				}
				if(data.state == "3"){
					md.getContent().find('#ligthTransition').addClass('active');
					md.getContent().find('#tab_ligthTransition').addClass('active');
				}
				colorInitial = new Color(md.getContent().find('#initial'));
				colorEnd = new Color(md.getContent().find('#final'));
				colorFix = new Color(md.getContent().find('#fix'));
				colorInitial.setColorRGB(transform65000to255(data.transition_start_red), transform65000to255(data.transition_start_green), transform65000to255(data.transition_start_blue));
				colorEnd.setColorRGB(transform65000to255(data.transition_end_red), transform65000to255(data.transition_end_green), transform65000to255(data.transition_end_blue));
				colorFix.setColorRGB(transform65000to255(data.solid_red), transform65000to255(data.solid_green), transform65000to255(data.solid_blue));
			}
		});
	}
}

async function downloadVPNExampleFile() {
	const fileName = 'vpn_ref.zip';
	const data = await receiveAsBinaryData('get_vpn_file', null, null, false);

	saveTextAsFile(fileName, data.result);
}

function exportOpenVpnLog(){
	function openErrorModal(message) {
		var _modal = new Modal();
		_modal.setTitle('OpenVPN');
		_modal.setContent(message);
		_modal.addButton([
			{
				'type': 'cancel',
				'text': 'OK'
			}
		]);
		_modal.show();
	}

	var data = MessengerUtil.send('get_openvpn_log', null, null, false);
	if (data.error != undefined) {
		openErrorModal("There is no OpenVPN log file available.");
		return;
	}
	var date = getFormatedDate();
	var dataSystem = MessengerUtil.send('system_information', null, null, false);
	var dataFirmware = dataSystem.version;
	var dataSerial = dataSystem.serial;
	dataSerial = dataSerial.replace('/','-');
	var fileName = 'OPENVPN_log_' + 'V' + dataFirmware + '_' + dataSerial + '_' + date + '.txt';
	saveTextAsFile(fileName, data);
}

function exportWpaLog(){
	function openErrorModal(message) {
		var _modal = new Modal();
		_modal.setTitle('WPA');
		_modal.setContent(message);
		_modal.addButton([
			{
				'type': 'cancel',
				'text': 'OK'
			}
		]);
		_modal.show();
	}

	var data = MessengerUtil.send('get_wpa_log', null, null, false);
	if (data.error != undefined) {
		openErrorModal("There is no WPA log file available.");
		return;
	}
	var date = getFormatedDate();
	var dataSystem = MessengerUtil.send('system_information', null, null, false);
	var dataFirmware = dataSystem.version;
	var dataSerial = dataSystem.serial;
	dataSerial = dataSerial.replace('/','-');
	var fileName = 'WPA_log_' + 'V' + dataFirmware + '_' + dataSerial + '_' + date + '.txt';
	saveTextAsFile(fileName, data);
}

var modal_networkEdit = $('#modal_networkEdit').clone().end().remove();
function openNetworkModal(){
	const HELP_TEXT = {
		peap: "PEAP encapsulates authentication inside a TLS tunnel, allowing secure use of username and password. It is widely used in corporate networks.",
		ttls: "TTLS creates a TLS tunnel and supports multiple inner methods. It is flexible and works well with credential-based authentication.",
		tls: "EAP-TLS uses certificates for both client and server authentication. It is the most secure and robust method, but requires valid certificates.",

		mschapv2: "MS-CHAPv2 is an inner method used within PEAP/TTLS. It authenticates using username and password and is supported by most systems.",
		md5: "EAP-MD5 is simple and does not use a secure tunnel. It is rare and generally not recommended due to lack of attack protection.",
		gtc: "EAP-GTC uses generic challenges and can integrate tokens, OTPs, and external systems. It is flexible but depends on the network infrastructure.",

		eap_cert: "The CA certificate (Certificate Authority) is used to verify the server's identity during the TLS handshake. It protects against man-in-the-middle attacks.",
		client_key: "The client's private key must match the uploaded certificate. It must never be shared.",
		client_cert: "The client certificate is used in EAP-TLS to prove the device's identity. It must match the private key."
	};

	var md = new Modal();
	md.setTitle('Network settings');
	md.setHTMLContent(modal_networkEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	var certificate;
	var has_eap_certificate = false;
	var has_eap_tls_private_key = false;
	var has_eap_tls_certificate = false;
	var eap_certificate = null;
	var eap_tls_private_key = null;
	var eap_tls_certificate = null;
	var do_save = false;
	let statusTimeout = null;
	let vpnPasswordChanged = false;
	async function save(returnMessage){
		// ================================ 802.1x =================================
		if (eap_certificate) {
			if (!eap_certificate.certificate || eap_certificate.error) {
				returnMessage(
						eap_certificate.error ?
						eap_certificate.error :
						"Choose a valid certificate");
				eap_certificate = null;
				return;
			}

			var data = MessengerUtil.sendFile('eap_802_1X_certificate_change', stringToUint8Array(eap_certificate.certificate));
			if ('error' in data) {
				returnMessage("Invalid EAP 802.1X certificate");
				return;
			}
		}
		if (eap_tls_private_key) {
			if ((!eap_tls_private_key.certificate && !eap_tls_private_key.generated_new) || eap_tls_private_key.error) {
				returnMessage(
						eap_tls_private_key.error ?
						eap_tls_private_key.error :
						"Choose a valid private key");
				eap_tls_private_key = null;
				return;
			}

			if (eap_tls_certificate) {
				if (!eap_tls_certificate.certificate || eap_tls_certificate.error) {
					returnMessage(
							eap_tls_certificate.error ?
							eap_tls_certificate.error :
							"Choose a valid client certificate");
					eap_tls_certificate = null;
					return;
				}
			}
			else {
				returnMessage("Add a valid client certificate");
				eap_tls_certificate = null;
				return;
			}

			var data_pk;
			if (eap_tls_private_key.generated_new) {
				data_pk = MessengerUtil.send('eap_tls_802_1X_private_key_persist', null, null, false);
			}
			else {
				data_pk = MessengerUtil.sendFile('eap_tls_802_1X_private_key_change', stringToUint8Array(eap_tls_private_key.certificate));	
			}
			if ('error' in data_pk) {
				returnMessage("Invalid private key");
				return;
			}
			var data_cert = MessengerUtil.sendFile('eap_tls_802_1X_certificate_change', stringToUint8Array(eap_tls_certificate.certificate));
			if ('error' in data_cert) {
				returnMessage("Invalid client certificate");
				return;
			}
		}

		var auth802_1x_enabled =	md.getContent().find('#chk802_1X').parent().hasClass('switch-on');
		var auth802_1x_login = md.getContent().find('#login_802_1X')[0].value;
		var auth802_1x_password = md.getContent().find('#password_802_1X')[0].value;
		var auth802_1x_inner_auth = md.getContent().find('#innerAuthRadioList').find('input[type="radio"]:checked').val();
		var auth802_1x_eap_auth = md.getContent().find('#eapAuthRadioList').find('input[type="radio"]:checked').val();
		var auth802_1x_uses_certificate = md.getContent().find('#chk_uses_certificate_802_1X').parent().hasClass('switch-on');

		if (auth802_1x_uses_certificate && !eap_certificate && !has_eap_certificate) {
			returnMessage('Attach an EAP 802.1X certificate');
			return;
		}
		if (auth802_1x_eap_auth === "TLS" && !eap_tls_private_key && !has_eap_tls_private_key) {
			returnMessage('Anexe uma chave privada EAP-TLS para o cliente');
			return;
		}
		if (auth802_1x_eap_auth === "TLS" && !eap_tls_certificate && !has_eap_tls_certificate) {
			returnMessage('Anexe um certificado EAP-TLS para o cliente');
			return;
		}

		if(do_save || auth802_1x_password || !auth802_1x_enabled) {
			switch(auth802_1x_inner_auth) {
				case "MSCHAPV2":
					auth802_1x_inner_auth_int = 0;
					break;
				case "MD5":
					auth802_1x_inner_auth_int = 1;
					break;
				case "GTC":
					auth802_1x_inner_auth_int = 2;
					break;
				default:
					auth802_1x_inner_auth_int = 3;
			}

			switch(auth802_1x_eap_auth) {
				case "PEAP":
					auth802_1x_eap_auth_int = 0;
					break;
				case "TTLS":
					auth802_1x_eap_auth_int = 1;
					break;
				case "TLS":
					auth802_1x_eap_auth_int = 2;
					break;
				default:
					auth802_1x_eap_auth_int = 3;
			}

			let auth802_1XBodyRequest = {
				enabled: auth802_1x_enabled,
				login: auth802_1x_login ? auth802_1x_login : "",
				password: auth802_1x_password ? auth802_1x_password : "",
				inner_auth: auth802_1x_inner_auth_int,
				eap_auth: auth802_1x_eap_auth_int,
				uses_certificate: auth802_1x_uses_certificate
			};
			const auth802_1XData = MessengerUtil.send('configure_802_1X', auth802_1XBodyRequest);
			if (auth802_1XData.error !== undefined) {
				returnMessage(auth802_1XData.error);
				return;
			}
		}

		// ================================== VPN ==================================
		if ($("#inputVPNFile")[0].files.length > 0) {
			const file = $("#inputVPNFile")[0].files[0];
			const fileExtension = file.name.split('.').pop();

			const fileExtToFileType = {
				'zip': 'zip',
				'conf': 'config',
				'ovpn': 'ovpn'
			};
			const fileTypeParam = "file_type=" + fileExtToFileType[fileExtension];

			const ret = await sendAsBinaryData('set_vpn_file', file, fileTypeParam);
		}

		var vpn_enabled = md.getContent().find('#chkVPN').parent().hasClass('switch-on');
		var vpn_login_enabled = md.getContent().find('#chkLoginPassword').parent().hasClass('switch-on');
		var vpn_login = md.getContent().find('#login_VPN')[0].value;
		var vpn_password = md.getContent().find('#password_VPN')[0].value;

		if(vpn_login_enabled){
			if(vpn_password === "" || vpn_login === ""){
				returnMessage('Empty VPN login or password');
				return;
			}
		}

		clearTimeout(statusTimeout);

		let vpnBodyRequest = {
			enabled: vpn_enabled,
			login_enabled: vpn_login_enabled,
			login: vpn_login
		};
		if (vpnPasswordChanged) {
			vpnBodyRequest.password = vpn_password;
		}
		const vpnData = MessengerUtil.send('set_vpn_information', vpnBodyRequest);
		if (vpnData.error !== undefined) {
			returnMessage(vpnData.error);
			return;
		}

		// ================================ Network ================================
		if (certificate) {
			if (!certificate.certificate || certificate.error) {
				returnMessage(
						certificate.error ?
						certificate.error :
						"Choose a valid certificate");
				certificate = null;
				return;
			}

			var data = MessengerUtil.sendFile('ssl_certificate_change', stringToUint8Array(certificate.certificate));
			if (data.error) {
					returnMessage("Invalid certificate");
					return;
			}
		}

		var ip = md.getContent().find('#inputIP')[0].value;
		var netmask = md.getContent().find('#inputNetmask')[0].value;
		var gateway = md.getContent().find('#inputGateway')[0].value;
		var custom_hostname_enabled = md.getContent().find('#chkDeviceName').parent().hasClass('switch-on');
		var device_hostname = md.getContent().find('#inputDeviceName')[0].value;
		var port = md.getContent().find('#inputPorta')[0].value;
		var ssl_enabled = md.getContent().find('#chkSslEnabled').parent().hasClass('switch-on');
		var self_signed_certificate = md.getContent().find('#radioList').find('input[type="radio"]:checked').val() == 'selfSigned' ? true : false;
		var dhcp_enabled = md.getContent().find('#chkDHCP').parent().hasClass('switch-on');
		var ten_mbps = false;
		var primary_dns = md.getContent().find('#inputPrimaryDns')[0].value;
		var secondary_dns = md.getContent().find('#inputSecondaryDns')[0].value;

		if (validateNetwork({ ip: ip, netmask: netmask, gateway: gateway, primary_dns: primary_dns,
			secondary_dns: secondary_dns, port: port, dhcp: dhcp_enabled, device_hostname: device_hostname}).length){
			returnMessage('IP, Network mask, Gateway, Device name or port: bad format');
			return;
		}

		var data = MessengerUtil.sendAsync('set_system_network', {
			ip: ip,
			netmask: netmask,
			gateway: gateway,
			primary_dns: primary_dns,
			secondary_dns: secondary_dns,
			custom_hostname_enabled: custom_hostname_enabled,
			device_hostname: device_hostname,
			web_server_port : parseInt(port),
			ssl_enabled: ssl_enabled,
			self_signed_certificate: self_signed_certificate,
			ten_mbps: ten_mbps,
			dhcp_enabled: dhcp_enabled
		}, null, null, function(result){
			if(result.error == undefined || result.status == 0){
				returnMessage(null);
				setTimeout(function () {
					window.location = (ssl_enabled ? 'https://' : 'http://') + ip + ':' + port + '/en_US/html/configurations.html';
				}, 2500);
			}else{
				returnMessage(result);
			}
		});
	}

	md.show(function(){
		// TODO: Utilizar Main.getInfo()
		var data = MessengerUtil.send('system_information', null, null, false);
		const vpnData = MessengerUtil.send('get_vpn_information', null, null, false);
		const catraData = MessengerUtil.send(
			'get_configuration',
			{
				'sec_box': ['catra_role']
			}
		);
		md.getContent().find('#inputIP')[0].value = data.network.ip;
		md.getContent().find('#inputNetmask')[0].value = data.network.netmask;
		md.getContent().find('#inputGateway')[0].value = data.network.gateway;
		md.getContent().find('#chkDeviceName').parent().bootstrapSwitch();
		md.getContent().find('#chkDeviceName').parent().bootstrapSwitch('setState', data.network.custom_hostname_enabled);
		md.getContent().find('#inputDeviceName')[0].value = data.network.device_hostname;
		md.getContent().find('#inputPorta')[0].value = data.network.web_server_port;
		md.getContent().find('#chkDHCP').parent().bootstrapSwitch();
		md.getContent().find('#chkDHCP').parent().bootstrapSwitch('setState', data.network.dhcp_enabled);
		md.getContent().find('#inputPrimaryDns')[0].value = data.network.primary_dns;
		md.getContent().find('#inputSecondaryDns')[0].value = data.network.secondary_dns;
		md.getContent().find('#chkVPN').parent().bootstrapSwitch();
		md.getContent().find('#chkVPN').parent().bootstrapSwitch('setState', vpnData.enabled);
		md.getContent().find('#chkLoginPassword').parent().bootstrapSwitch();
		md.getContent().find('#chkLoginPassword').parent().bootstrapSwitch('setState', vpnData.login_enabled);
		md.getContent().find('#login_VPN')[0].value = vpnData.login;
		md.getContent().find('#password_VPN')[0].value = (vpnData.password ? '********' : '');
		md.getContent().find('#chkSslEnabled').parent().bootstrapSwitch();
		md.getContent().find('#chkSslEnabled').parent().bootstrapSwitch('setState', data.network.ssl_enabled);
		md.getContent().find('#chkSslEnabled').parent().parent().on('switch-change', function (e, data) {
			var port = md.getContent().find('#inputPorta')[0].value;

			if (data.value) {
				if (port === '80') {
					md.getContent().find('#inputPorta')[0].value = '443';
				}
				md.getContent().find('#radioListDiv').removeClass('hidden');

				var radio = md.getContent().find('#radioList').find('input[type="radio"]:checked').val();
				if (radio == 'thirdParty') {
					md.getContent().find('#certificateFileDiv').removeClass('hidden');
				}
			} else {
				if (port === '443') {
					md.getContent().find('#inputPorta')[0].value = '80';
				}

				md.getContent().find('#radioListDiv').addClass('hidden');
				md.getContent().find('#certificateFileDiv').addClass('hidden');
			}
		});
		if(data.network.self_signed_certificate) {
				md.getContent().find('#selfSigned').prop('checked',true);
				md.getContent().find('#certificateFileDiv').addClass('hidden');
		} else {
				md.getContent().find('#thirdParty').prop('checked',true);
				md.getContent().find('#certificateFileDiv').removeClass('hidden');
		}

		if (catraData.sec_box.catra_role === '2') {
			md.getContent().find('#inputPorta').prop('disabled', true);
		}

		md.getContent().find('#chk802_1X').parent().bootstrapSwitch();
		md.getContent().find('#chk802_1X').parent().bootstrapSwitch('setState', data.auth802_1x.enabled);
		md.getContent().find('#chk_uses_certificate_802_1X').parent().bootstrapSwitch();
		md.getContent().find('#chk_uses_certificate_802_1X').parent().bootstrapSwitch('setState', data.auth802_1x.uses_certificate);
		md.getContent().find('#login_802_1X')[0].value = data.auth802_1x.login;

		switch(data.auth802_1x.inner_auth) {
			case 0:
				md.getContent().find('#MSCHAPV2').prop('checked',true);
				break;
			case 1:
				md.getContent().find('#MD5').prop('checked',true);
				break;
			case 2:
				md.getContent().find('#GTC').prop('checked',true);
				break;
			default:
				md.getContent().find('#MSCHAPV2').prop('checked',true);
				break;
		}

		switch(data.auth802_1x.eap_auth) {
			case 0:
				md.getContent().find('#PEAP').prop('checked',true);
				break;
			case 1:
				md.getContent().find('#TTLS').prop('checked',true);
				break;
			case 2:
				md.getContent().find('#TLS').prop('checked',true);
				md.getContent().find('#login_802_1X').prop('disabled', true);
				md.getContent().find('#innerAuthRadioListDiv').hide();
				md.getContent().find('#eapTlsRadioListDiv').show();
				md.getContent().find('#csr_cert').prop('checked', true);
				md.getContent().find('#eap_tls_files').show();
				md.getContent().find('#label_password_802_1X').html("Private Key Password");
				md.getContent().find('#chk_uses_certificate_802_1X').parent().bootstrapSwitch('setState', true);
				md.getContent().find("#csr_cert").on('change', function () {
					var csr_cert = md.getContent().find('#csr_cert').prop('checked');
					if(csr_cert) {
						md.getContent().find('#eap_tls_private_key').hide();
						md.getContent().find('#btn_csr').parent().show();
					}
				});
				md.getContent().find("#pk_cert").on('change', function () {
					var pk_cert = md.getContent().find('#pk_cert').prop('checked');
					if(pk_cert) {
						md.getContent().find('#eap_tls_private_key').show();
						md.getContent().find('#btn_csr').parent().hide();
					}
				});
				break;
			default:
				md.getContent().find('#PEAP').prop('checked',true);
				break;
		}

		md.getContent().find("#PEAP").on('change', function () {
			var peap_checked = md.getContent().find('#PEAP').prop('checked');
			if(peap_checked) {
				md.getContent().find('#login_802_1X')[0].value = data.auth802_1x.login;
				md.getContent().find('#login_802_1X').prop('disabled', false);
				md.getContent().find('#innerAuthRadioListDiv').show();
				md.getContent().find('#eapTlsRadioListDiv').hide();
				md.getContent().find('#btn_csr').parent().hide();
				md.getContent().find('#eap_tls_files').hide();
				md.getContent().find('#label_password_802_1X').html("Password");
			}
		});
		md.getContent().find("#TTLS").on('change', function () {
			var ttls_checked = md.getContent().find('#TTLS').prop('checked');
			if(ttls_checked) {
				md.getContent().find('#login_802_1X')[0].value = data.auth802_1x.login;
				md.getContent().find('#login_802_1X').prop('disabled', false);
				md.getContent().find('#innerAuthRadioListDiv').show();
				md.getContent().find('#eapTlsRadioListDiv').hide();
				md.getContent().find('#btn_csr').parent().hide();
				md.getContent().find('#eap_tls_files').hide();
				md.getContent().find('#label_password_802_1X').html("Password");
				md.getContent().find('#chk_uses_certificate_802_1X').parent().bootstrapSwitch('setState', true);
			}
		});
		md.getContent().find("#TLS").on('change', function () {
			var tls_checked = md.getContent().find('#TLS').prop('checked');
			if(tls_checked) {
				md.getContent().find('#login_802_1X')[0].value = data.network.device_hostname;
				md.getContent().find('#login_802_1X').prop('disabled', true);
				md.getContent().find('#innerAuthRadioListDiv').hide();
				md.getContent().find('#eapTlsRadioListDiv').show();
				md.getContent().find('#csr_cert').prop('checked', true);
				md.getContent().find('#btn_csr').parent().show();
				md.getContent().find('#eap_tls_files').show();
				md.getContent().find('#label_password_802_1X').html("Private Key Password");
				md.getContent().find('#chk_uses_certificate_802_1X').parent().bootstrapSwitch('setState', true);
				md.getContent().find("#csr_cert").on('change', function () {
					var csr_cert = md.getContent().find('#csr_cert').prop('checked');
					if(csr_cert) {
						md.getContent().find('#eap_tls_private_key').hide();
						md.getContent().find('#btn_csr').parent().show();
					}
				});
				md.getContent().find("#pk_cert").on('change', function () {
					var pk_cert = md.getContent().find('#pk_cert').prop('checked');
					if(pk_cert) {
						md.getContent().find('#eap_tls_private_key').show();
						md.getContent().find('#btn_csr').parent().hide();
					}
				});
			}
		});

		md.getContent().find("#chk_uses_certificate_802_1X").parent().parent().on('switch-change', function (e, data) {
			var ttls_checked = md.getContent().find('#TTLS').prop('checked');
			var tls_checked = md.getContent().find('#TLS').prop('checked');
			if((ttls_checked || tls_checked) && md.getContent().find('#chk_uses_certificate_802_1X').parent().hasClass('switch-off')) {
				md.getContent().find('#chk_uses_certificate_802_1X').parent().bootstrapSwitch('setState', true);
			}
		});

		md.getContent().find("#password_802_1X").on('change', function () {
			do_save = true;
		});
		md.getContent().find("#btn_csr").on('click', function () {
			eap_tls_private_key = { generated_new: true };
		});
		md.getContent().find("#inputEapCertificateFile").on('change', function () {
			var file = $('#inputEapCertificateFile')[0].files[0];
			if (!file) {
				eap_certificate = null;
				return;
			}

			if ((file.size ? file.size : file.fileSize) > 10240) {
				eap_certificate = { error: "Invalid certificate" }
				return;
			}

			var reader = new FileReader();
			reader.onloadend = function (e) {
				eap_certificate = { certificate: e.target.result };
				do_save = true;
			}
			reader.readAsText(file, "UTF-8");
		});
		md.getContent().find("#inputEapTlsPrivateKeyFile").on('change', function () {
			var file = $('#inputEapTlsPrivateKeyFile')[0].files[0];
			if (!file) {
				eap_tls_private_key = null;
				return;
			}

			if ((file.size ? file.size : file.fileSize) > 10240) {
				eap_tls_private_key = { error: "Invalid private key" }
				return;
			}

			var reader = new FileReader();
			reader.onloadend = function (e) {
				eap_tls_private_key = { certificate: e.target.result };
				do_save = true;
			}
			reader.readAsText(file, "UTF-8");
		});
		md.getContent().find("#inputEapTlsCertificateFile").on('change', function () {
			var file = $('#inputEapTlsCertificateFile')[0].files[0];
			if (!file) {
				eap_tls_certificate = null;
				return;
			}

			if ((file.size ? file.size : file.fileSize) > 10240) {
				eap_tls_certificate = { error: "Invalid client certificate" }
				return;
			}

			var reader = new FileReader();
			reader.onloadend = function (e) {
				eap_tls_certificate = { certificate: e.target.result };
				do_save = true;
			}
			reader.readAsText(file, "UTF-8");
		});

		status802_1XTimeout = setTimeout(function refresh802_1XStatus() {
			if (!(document.getElementById("auth_802_1x_status_bar") && document.getElementById("auth_802_1x_status_label"))) {
				return;
			}

			const response = MessengerUtil.send('get_802_1X_status', null, null, false);
			document.getElementById("auth_802_1x_status_bar").classList.remove("grey", "green", "red", "blue");

			if (response.error !== undefined) {
				document.getElementById("auth_802_1x_status_bar").classList.add("grey");
				document.getElementById("auth_802_1x_status_label").textContent = "Could not get 802.1X connection status";
				status802_1XTimeout = setTimeout(refresh802_1XStatus, 5000);
				return;
			}
			const status_mappings = [
				["blue", "Initializing"],
				["red", "Disconnected"],
				["blue", "Connecting"],
				["blue", "Authenticating"],
				["green", "Authenticated"],
				["red", "Aborting"],
				["red", "Held"],
				["green", "Forcing authorization"],
				["red", "Forcing unauthorization"],
				["blue", "Rebooting"],
				["grey", "Unknown status"]
			];
			document.getElementById("auth_802_1x_status_bar").classList.add(status_mappings[response.status][0]);
			document.getElementById("auth_802_1x_status_label").innerHTML = "<h4>" + status_mappings[response.status][1] + "</h4>";
			status802_1XTimeout = setTimeout(refresh802_1XStatus, 2000);
		}, 0);
		md.getContent().parent().on('hide', function () {
			clearTimeout(status802_1XTimeout);
		});

		if (data.network.custom_hostname_enabled) {
			md.getContent().find('#inputDeviceName').prop('disabled', false);
		} else {
			md.getContent().find('#inputDeviceName').prop('disabled', true);
		}
		md.getContent().find("#chkDeviceName").on('change', function () {
			if (md.getContent().find('#chkDeviceName').parent().hasClass('switch-on')) {
				md.getContent().find('#inputDeviceName').prop('disabled', false);
				md.getContent().find('#inputDeviceName')[0].value = data.network.device_hostname;
			} else {
				md.getContent().find('#inputDeviceName').prop('disabled', true);
				md.getContent().find('#inputDeviceName')[0].value = ('CID-' + data.serial.replace('/','-'));
			}
		});

		md.getContent().find('#selfSigned').on('click', function() {
			md.getContent().find('#certificateFileDiv').addClass('hidden');
		});
		md.getContent().find('#thirdParty').on('click', function() {
			md.getContent().find('#certificateFileDiv').removeClass('hidden');
		});
		md.getContent().find('#importCertificate').on('click', function() {
			var data = MessengerUtil.sendAsync('get_ssl_certificate', {}, null, null, function(result) {
				if (result.error == undefined || result.status == 0) {
					var blob = new Blob([result], { type: "text/plain" });
					var url = URL.createObjectURL(blob);
					var link = document.createElement("a");
					link.href = url;
					link.download = "ssl_certificate.pem";
					link.style.display = "none";
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
					URL.revokeObjectURL(url);
					md.getContent().find('#importCertificate').addClass('blue');
					md.getContent().find('#importCertificate').removeClass('gray');
					md.getContent().find('#certificateError').addClass('hidden');
				} else {
					md.getContent().find('#importCertificate').removeClass('blue');
					md.getContent().find('#importCertificate').addClass('gray');
					md.getContent().find('#certificateError').removeClass('hidden');
				}
			});
		});

		if (data.network.ssl_enabled) {
			md.getContent().find('#radioListDiv').removeClass('hidden');
		} else {
			md.getContent().find('#radioListDiv').addClass('hidden');
		}

		const inputVPNFile = document.getElementById('inputVPNFile');
		const fileLabelVPN = document.querySelector('label[for="inputVPNFile"]');

		inputVPNFile.addEventListener('change', function () {
			if (inputVPNFile.files.length > 0) {
				const fileName = inputVPNFile.files[0].name;
				fileLabelVPN.innerHTML = `${fileName} <img src="/images/upload_button.png" alt="icon" class="file-icon" style="width: 20px; height: 20px"/>`;
			} else {
				fileLabelVPN.innerHTML = `Add file <img src="/images/upload_button.png" alt="icon" class="file-icon" style="width: 20px; height: 20px"/>`;
			}
		});

		const hasVPNFile = MessengerUtil.send('has_vpn_file', null, null, false);
		console.log(hasVPNFile)
		if (hasVPNFile.error) {
			return returnMessage(hasVPNFile.error);
		}
		if (hasVPNFile.has_file) {
			md.getContent().find('#check_vpn_files').html('Parameterization files loaded');
		}

		if (vpnData.login_enabled) {
			md.getContent().find('#login_area').show();
		} else {
			md.getContent().find('#login_area').hide();
		}
		md.getContent().find("#chkLoginPassword").on('change', function () {
			if (md.getContent().find('#chkLoginPassword').parent().hasClass('switch-on')) {
				md.getContent().find('#login_area').show();
			} else {
				md.getContent().find('#login_area').hide();
			}
		});
		md.getContent().find("#password_VPN").on('change', function () {
			vpnPasswordChanged = true;
		});

		statusTimeout = setTimeout(function refreshVPNStatus() {
			if (!(document.getElementById("vpn_status_bar") && document.getElementById("vpn_status_label"))) {
				return;
			}

			const response = MessengerUtil.send('get_vpn_status', null, null, false);
			document.getElementById("vpn_status_bar").classList.remove("grey", "green", "red");

			if (response.error !== undefined) {
				document.getElementById("vpn_status_bar").classList.add("grey");
				document.getElementById("vpn_status_label").textContent = "Couldn't get the VPN status";
				statusTimeout = setTimeout(refreshVPNStatus, 5000);
				return;
			}
			switch (response.status) {
				case 0:
					const vpn_ip = MessengerUtil.send('get_vpn_ip', null, null, false);
					document.getElementById("vpn_status_bar").classList.add("green");
					document.getElementById("vpn_status_label").textContent = "VPN connected (" + vpn_ip.ip + ")";
					break;
				case 1:
					document.getElementById("vpn_status_bar").classList.add("red");
					document.getElementById("vpn_status_label").textContent = "Authentication failed";
					break;
				case 2:
					document.getElementById("vpn_status_bar").classList.add("red");
					document.getElementById("vpn_status_label").textContent = "Missing Certification Authority (CA)";
					break;
				case 3:
					document.getElementById("vpn_status_bar").classList.add("red");
					document.getElementById("vpn_status_label").textContent = "Certification Authority (CA) failed";
					break;
				case 4:
					document.getElementById("vpn_status_bar").classList.add("red");
					document.getElementById("vpn_status_label").textContent = "Missing certificate or private key";
					break;
				case 5:
					document.getElementById("vpn_status_bar").classList.add("red");
					document.getElementById("vpn_status_label").textContent = "Certificate failed";
					break;
				case 6:
					document.getElementById("vpn_status_bar").classList.add("red");
					document.getElementById("vpn_status_label").textContent = "Private key failed";
					break;
				case 7:
					document.getElementById("vpn_status_bar").classList.add("red");
					document.getElementById("vpn_status_label").textContent = "TLS authentication failed";
					break;
				case 8:
					document.getElementById("vpn_status_bar").classList.add("grey");
					document.getElementById("vpn_status_label").textContent = "VPN disabled";
					break;
				case 9:
					document.getElementById("vpn_status_bar").classList.add("grey");
					document.getElementById("vpn_status_label").textContent = "Trying to connect...";
					break;
				case 10:
					document.getElementById("vpn_status_bar").classList.add("red");
					document.getElementById("vpn_status_label").textContent = "VPN disconnected";
					break;
				default:
					document.getElementById("vpn_status_bar").classList.add("grey");
					document.getElementById("vpn_status_label").textContent = "Unknown VPN status";
					break;
			}
			statusTimeout = setTimeout(refreshVPNStatus, 2000);
		}, 0);
		md.getContent().parent().on('hide', function () {
			clearTimeout(statusTimeout);
		})

		md.getContent().find("#inputCertificateFile").on('change', function () {
			const fileCertificate = document.getElementById('inputCertificateFile');
			const fileLabelCertificate = document.querySelector('label[for="inputCertificateFile"]');

			const fileNameCertificate = fileCertificate.files[0].name;

			var file = $('#inputCertificateFile')[0].files[0];
			if (!file) {
				certificate = null;
				fileLabelCertificate.innerHTML = `Add certificate <img src="/images/upload_button.png" alt="icon" class="file-icon" style="width: 20px; height: 20px"/>`;
				return;
			}

			if ((file.size ? file.size : file.fileSize) > 10240) {
				certificate = { error: "Invalid certificate" }
				return;
			}

			fileLabelCertificate.innerHTML = `${fileNameCertificate} <img src="/images/upload_button.png" alt="icon" class="file-icon" style="width: 20px; height: 20px"/>`;

			var reader = new FileReader();
			reader.onloadend = function (e) {
				certificate = { certificate: e.target.result };
			}
			reader.readAsText(file, "UTF-8");
		});
		onDHCPChanges(md.getContent().find('#chkDHCP').parent().hasClass('switch-on'));
		md.getContent().find("#chkDHCP").parent().parent().on('switch-change', function(e, data) {
			onDHCPChanges(data.value);
		});

		$('.help-btn').on('click', function() {
			const helpKey = $(this).data('help');
			if (HELP_TEXT[helpKey]) {
				showHelpModal(HELP_TEXT[helpKey]);
			}
		});

		function showHelpModal(helpText) {
			const helpModal = new Modal();
			helpModal.setTitle('Info');
			helpModal.setContent(helpText);
			helpModal.addButton([{
				'type': 'ok',
				'text': 'OK'
			}]);
			helpModal.show();
		}

		new Validate($(md.getContent()), validateNetwork);

		md.getContent().parent().addClass('network_modal');

		md.getContent().parent().find('.close').on('click', function() {
			md.getContent().parent().removeClass('network_modal');
		});

		md.getContent().parent().find('.red').on('click', function() {
			md.getContent().parent().removeClass('network_modal');
		});

		md.getContent().parent().find('.green').on('click', function() {
			md.getContent().parent().removeClass('network_modal');
		});
	});

	function onDHCPChanges(dhcp_enabled) {
		if (dhcp_enabled) {
			md.getContent().find('#inputIP').prop('disabled', true);
			md.getContent().find('#inputNetmask').prop('disabled', true);
			md.getContent().find('#inputGateway').prop('disabled', true);
			md.getContent().find('#inputPrimaryDns').prop('disabled', true);
			md.getContent().find('#inputSecondaryDns').prop('disabled', true);
		} else {
			md.getContent().find('#inputIP').prop('disabled', false);
			md.getContent().find('#inputNetmask').prop('disabled', false);
			md.getContent().find('#inputGateway').prop('disabled', false);
			md.getContent().find('#inputPrimaryDns').prop('disabled', false);
			md.getContent().find('#inputSecondaryDns').prop('disabled', false);
		}
	}

	function dot2num(dot)
	{
			var d = dot.split('.');
			return ((((((+d[0])*256)+(+d[1]))*256)+(+d[2]))*256)+(+d[3]);
	}

	function validateNetwork(data){
		var result = [];

		if('port' in data){
			if(data.port.length > 0 && isNaN(data.port) ||
					parseInt(data.port) <= 0 || parseInt(data.port) == 22 || parseInt(data.port) > 65535)
				result.push('Please enter a valid value');
		}

		if('device_hostname' in data){
			if(data.device_hostname.length == 0 || data.device_hostname.length > 63)
				result.push('Please enter a valid value');
		}

		if (data.dhcp) {
			return result;
		}

		var regex = new RegExp(/^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/);
		['ip', 'gateway'].forEach(function(key){
			if(key in data){
				if(!regex.test(data[key])){
					result.push('Please enter a valid value');
				}
			}
		});

		if(data.netmask != undefined){
			if(!regex.test(data.netmask)){
				result.push('Please enter a valid value');
			}else{
				var mask = dot2num(data.netmask);
				var not_mask = ~mask;
				if (!(((not_mask + 1) & not_mask) == 0 && (mask != 0)))
					result.push('Invalid Mask');
			}
		}

		if(data.ip != undefined && data.netmask != undefined && data.gateway != undefined){
			if(!regex.test(data.ip) || !regex.test(data.netmask) || !regex.test(data.gateway)){
				result.push('Please enter a valid value');
			}else{
				var int_ip= dot2num(data.ip);
				var int_net_mask= dot2num(data.netmask);
				var int_gw= dot2num(data.gateway);

				if ((int_ip & int_net_mask) != (int_gw & int_net_mask))
					result.push('Invalid Gateway');
			}
		}

		if(data.primary_dns != undefined){
			if(!regex.test(data.primary_dns)){
				result.push('Insira um valor válido');
			}
		}

		if(data.secondary_dns != undefined){
			if(data.secondary_dns != "" && !regex.test(data.secondary_dns)){
				result.push('Insira um valor válido');
			}
		}

		if('port' in data){
			if(data.port.length > 0 && isNaN(data.port) || parseInt(data.port) <= 0 ||
			parseInt(data.port) == 22 || parseInt(data.port) > 65535) {
				result.push('Please enter a valid value');
			}
			if (data.port.length !== 0) {
				var verifier = MessengerUtil.send(
					'check_port_availability',
					{
						initial_port: parseInt(data.port),
						final_port: parseInt(data.port)
					}
				);
				if (verifier.status && verifier.status != "OK" && verifier.status != "WEB") {
					result.push("Port already used: " + verifier.status);
				}
			}
		}
		return result;
	}
}

async function downloadCsrEapTls() {
	var data_sys = MessengerUtil.send('system_information', null, null, false);
	const fileName = 'csr_' + data_sys.network.device_hostname + '.pem';

	const password_802_1x = document.getElementById("password_802_1X").value;
	const data = await receiveAsBinaryData('get_eap_tls_csr_file', {password: password_802_1x ? password_802_1x : ""});

	saveTextAsFile(fileName, data.result);
}

var modal_relayGpioEdit = $('#modal_relayGpioEdit').clone().end().remove();
function openRelayGpioModal() {
	var md = new Modal();
	md.setTitle('Relay and GPIOs');
	md.setHTMLContent(modal_relayGpioEdit);
	md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel'
		}
	]);
	md.show(function () {
		var data = MessengerUtil.send('get_configuration', {
			general: ['buttonhole1_enabled', 'relay1_enabled',
				'relay1_timeout', 'relay1_auto_close',
				'gpio_ext1_mode', 'gpio_ext2_mode', 'gpio_ext3_mode', 'relay_out_mode',
				'gpio_ext1_debounce', 'gpio_ext2_debounce', 'gpio_ext3_debounce',
				'gpio_ext1_idle', 'gpio_ext2_idle', 'gpio_ext3_idle', 'gpio_ext1_activation_mode',
				'gpio_ext2_activation_mode', 'gpio_ext3_activation_mode']
		}).general;
		md.getContent().find('#relay_enabled').parent().bootstrapSwitch();
		md.getContent().find('#relay_enabled').parent().bootstrapSwitch('setState', data.relay1_enabled == "1");
		md.getContent().find('#relay_auto_close').parent().bootstrapSwitch();
		md.getContent().find('#relay_auto_close').parent().bootstrapSwitch('setState', data.relay1_auto_close == "1");
		md.getContent().find('#gpio_ext1_idle').parent().bootstrapSwitch();
		md.getContent().find('#gpio_ext1_idle').parent().bootstrapSwitch('setState', data.gpio_ext1_idle == "1");
		md.getContent().find('#gpio_ext2_idle').parent().bootstrapSwitch();
		md.getContent().find('#gpio_ext2_idle').parent().bootstrapSwitch('setState', data.gpio_ext2_idle == "1");
		md.getContent().find('#gpio_ext3_idle').parent().bootstrapSwitch();
		md.getContent().find('#gpio_ext3_idle').parent().bootstrapSwitch('setState', data.gpio_ext3_idle == "1");
		md.getContent().find('#relay_timeout').val(data.relay1_timeout);
		switch (data.relay_out_mode) {
			case OutputMode.NORMAL_ACCESS:
				md.getContent().find('#relay_normal_access').attr('checked', 'checked');
				break;
			case OutputMode.ONLY_REJECTED:
				md.getContent().find('#relay_only_rejected').attr('checked', 'checked');
				break;
			case OutputMode.BELL:
				md.getContent().find('#relay_bell').attr('checked', 'checked');
				break;
			case OutputMode.SIREN:
				md.getContent().find('#relay_siren').attr('checked', 'checked');
				break;
			case OutputMode.EMERGENCY:
				md.getContent().find('#relay_emergency').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#relay_normal_access').attr('checked', 'checked');
		}

		switch (data.gpio_ext1_mode) {
			case GpioExtMode.DISABLED:
				md.getContent().find('#gpio_ext1_disabled').attr('checked', 'checked');
				break;
			case GpioExtMode.ENABLE_ID:
				md.getContent().find('#gpio_ext1_enable_id').attr('checked', 'checked');
				break;
			case GpioExtMode.ALARM_INPUT:
				md.getContent().find('#gpio_ext1_alarm_input').attr('checked', 'checked');
				break;
			case GpioExtMode.EMERGENCY_MODE_INPUT:
				md.getContent().find('#gpio_ext1_emergency').attr('checked', 'checked');
				break;
			case GpioExtMode.LOCKDOWN_MODE_INPUT:
				md.getContent().find('#gpio_ext1_lockdown').attr('checked', 'checked');
				break;
			case GpioExtMode.PJSIP_BUTTON:
				md.getContent().find('#gpio_ext1_pjsip').attr('checked', 'checked');
				break;
			case GpioExtMode.INTERLOCK:
				md.getContent().find('#gpio_ext1_interlock').attr('checked', 'checked');
				break;
			case GpioExtMode.OPEN_RELAY:
				md.getContent().find('#gpio_ext1_open_relay').attr('checked', 'checked');
				break;
			case GpioExtMode.OPEN_SEC_BOX:
				md.getContent().find('#gpio_ext1_open_secbox').attr('checked', 'checked');
				break;
			case GpioExtMode.OPEN_ALL:
				md.getContent().find('#gpio_ext1_open_all').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#gpio_ext1_disabled').attr('checked', 'checked');
		}

		switch (data.gpio_ext1_mode) {
			case GpioExtMode.EMERGENCY_MODE_INPUT:
				md.getContent().find('#relay_and_gpio1_act_mode_checkbox').show();
				break;
			case GpioExtMode.LOCKDOWN_MODE_INPUT:
				md.getContent().find('#relay_and_gpio1_act_mode_checkbox').show();
				break;
			default:
				md.getContent().find('#relay_and_gpio1_act_mode_checkbox').hide();
		}

		switch (data.gpio_ext2_mode) {
			case GpioExtMode.DISABLED:
				md.getContent().find('#gpio_ext2_disabled').attr('checked', 'checked');
				break;
			case GpioExtMode.ENABLE_ID:
				md.getContent().find('#gpio_ext2_enable_id').attr('checked', 'checked');
				break;
			case GpioExtMode.ALARM_INPUT:
				md.getContent().find('#gpio_ext2_alarm_input').attr('checked', 'checked');
				break;
			case GpioExtMode.EMERGENCY_MODE_INPUT:
				md.getContent().find('#gpio_ext2_emergency').attr('checked', 'checked');
				break;
			case GpioExtMode.LOCKDOWN_MODE_INPUT:
				md.getContent().find('#gpio_ext2_lockdown').attr('checked', 'checked');
				break;
			case GpioExtMode.PJSIP_BUTTON:
				md.getContent().find('#gpio_ext2_pjsip').attr('checked', 'checked');
				break;
			case GpioExtMode.INTERLOCK:
				md.getContent().find('#gpio_ext2_interlock').attr('checked', 'checked');
				break;
			case GpioExtMode.OPEN_RELAY:
				md.getContent().find('#gpio_ext2_open_relay').attr('checked', 'checked');
				break;
			case GpioExtMode.OPEN_SEC_BOX:
				md.getContent().find('#gpio_ext2_open_secbox').attr('checked', 'checked');
				break;
			case GpioExtMode.OPEN_ALL:
				md.getContent().find('#gpio_ext2_open_all').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#gpio_ext2_disabled').attr('checked', 'checked');
		}

		switch (data.gpio_ext2_mode) {
			case GpioExtMode.EMERGENCY_MODE_INPUT:
				md.getContent().find('#relay_and_gpio2_act_mode_checkbox').show();
				break;
			case GpioExtMode.LOCKDOWN_MODE_INPUT:
				md.getContent().find('#relay_and_gpio2_act_mode_checkbox').show();
				break;
			default:
				md.getContent().find('#relay_and_gpio2_act_mode_checkbox').hide();
		}

		switch (data.gpio_ext3_mode) {
			case GpioExtMode.DISABLED:
				md.getContent().find('#gpio_ext3_disabled').attr('checked', 'checked');
				break;
			case GpioExtMode.ENABLE_ID:
				md.getContent().find('#gpio_ext3_enable_id').attr('checked', 'checked');
				break;
			case GpioExtMode.ALARM_INPUT:
				md.getContent().find('#gpio_ext3_alarm_input').attr('checked', 'checked');
				break;
			case GpioExtMode.EMERGENCY_MODE_INPUT:
				md.getContent().find('#gpio_ext3_emergency').attr('checked', 'checked');
				break;
			case GpioExtMode.LOCKDOWN_MODE_INPUT:
				md.getContent().find('#gpio_ext3_lockdown').attr('checked', 'checked');
				break;
			case GpioExtMode.PJSIP_BUTTON:
				md.getContent().find('#gpio_ext3_pjsip').attr('checked', 'checked');
				break;
			case GpioExtMode.INTERLOCK:
				md.getContent().find('#gpio_ext3_interlock').attr('checked', 'checked');
				break;
			case GpioExtMode.OPEN_RELAY:
				md.getContent().find('#gpio_ext3_open_relay').attr('checked', 'checked');
				break;
			case GpioExtMode.OPEN_SEC_BOX:
				md.getContent().find('#gpio_ext3_open_secbox').attr('checked', 'checked');
				break;
			case GpioExtMode.OPEN_ALL:
				md.getContent().find('#gpio_ext3_open_all').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#gpio_ext3_disabled').attr('checked', 'checked');
		}

		switch (data.gpio_ext3_mode) {
			case GpioExtMode.EMERGENCY_MODE_INPUT:
				md.getContent().find('#relay_and_gpio3_act_mode_checkbox').show();
				break;
			case GpioExtMode.LOCKDOWN_MODE_INPUT:
				md.getContent().find('#relay_and_gpio3_act_mode_checkbox').show();
				break;
			default:
				md.getContent().find('#relay_and_gpio3_act_mode_checkbox').hide();
		}

		switch (data.gpio_ext1_activation_mode) {
			case ActivationMode.PULSE:
				md.getContent().find('#gpio_ext1_act_pulse').attr('checked', 'checked');
				break;
			case ActivationMode.EDGE:
				md.getContent().find('#gpio_ext1_act_state').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#gpio_ext1_pulse').attr('checked', 'checked');
		}

		switch (data.gpio_ext2_activation_mode) {
			case ActivationMode.PULSE:
				md.getContent().find('#gpio_ext2_act_pulse').attr('checked', 'checked');
				break;
			case ActivationMode.EDGE:
				md.getContent().find('#gpio_ext2_act_state').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#gpio_ext2_pulse').attr('checked', 'checked');
		}

		switch (data.gpio_ext3_activation_mode) {
			case ActivationMode.PULSE:
				md.getContent().find('#gpio_ext3_act_pulse').attr('checked', 'checked');
				break;
			case ActivationMode.EDGE:
				md.getContent().find('#gpio_ext3_act_state').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#gpio_ext3_pulse').attr('checked', 'checked');
		}
	
		md.getContent().find('input[name="gpio_ext1_mode"]').change(function() {
			if (md.getContent().find('#gpio_ext1_emergency').is(':checked') ||
			    md.getContent().find('#gpio_ext1_lockdown').is(':checked')){
				md.getContent().find('#relay_and_gpio1_act_mode_checkbox').show();
			} else {
				md.getContent().find('#relay_and_gpio1_act_mode_checkbox').hide();
			}
		});

		md.getContent().find('input[name="gpio_ext2_mode"]').change(function() {
			if (md.getContent().find('#gpio_ext2_emergency').is(':checked') ||
			    md.getContent().find('#gpio_ext2_lockdown').is(':checked')){
				md.getContent().find('#relay_and_gpio2_act_mode_checkbox').show();
			} else {
				md.getContent().find('#relay_and_gpio2_act_mode_checkbox').hide();
			}
		});	

		md.getContent().find('input[name="gpio_ext3_mode"]').change(function() {
			if (md.getContent().find('#gpio_ext3_emergency').is(':checked') ||
			    md.getContent().find('#gpio_ext3_lockdown').is(':checked')){
				md.getContent().find('#relay_and_gpio3_act_mode_checkbox').show();
			} else {
				md.getContent().find('#relay_and_gpio3_act_mode_checkbox').hide();
			}
		});
	});
	function save(returnMessage) {
		let relay1_enabled = 0;
		let relay1_auto_close = 0;
		let relay1_timeout = 250;
		let gpio_ext1_idle = 0;
		let gpio_ext2_idle = 0;
		let gpio_ext3_idle = 0;
		let buttonhole1_enabled = 0;
		let gpio_ext1_mode = GpioExtMode.DISABLED;
		let gpio_ext2_mode = GpioExtMode.DISABLED;
		let gpio_ext3_mode = GpioExtMode.DISABLED;
		let gpio_ext1_activation_mode = ActivationMode.PULSE;
		let gpio_ext2_activation_mode = ActivationMode.PULSE;
		let gpio_ext3_activation_mode = ActivationMode.PULSE;
		let relay_out_mode = OutputMode.NORMAL_ACCESS;

		if (md.getContent().find('#gpio_ext1_disabled').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.DISABLED;
		} else if (md.getContent().find('#gpio_ext1_enable_id').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.ENABLE_ID;
		} else if (md.getContent().find('#gpio_ext1_alarm_input').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.ALARM_INPUT;
		} else if (md.getContent().find('#gpio_ext1_emergency').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.EMERGENCY_MODE_INPUT;
		} else if (md.getContent().find('#gpio_ext1_lockdown').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.LOCKDOWN_MODE_INPUT;
		} else if (md.getContent().find('#gpio_ext1_pjsip').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.PJSIP_BUTTON;
		} else if (md.getContent().find('#gpio_ext1_interlock').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.INTERLOCK;
		} else if (md.getContent().find('#gpio_ext1_open_relay').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.OPEN_RELAY;
		} else if (md.getContent().find('#gpio_ext1_open_secbox').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.OPEN_SEC_BOX;
		} else if (md.getContent().find('#gpio_ext1_open_all').is(':checked')) {
			gpio_ext1_mode = GpioExtMode.OPEN_ALL;
		}

		if (md.getContent().find('#gpio_ext1_idle').parent().hasClass('switch-on')) {
			gpio_ext1_idle = 1;
		} else {
			gpio_ext1_idle = 0;
		}

		if (md.getContent().find('#gpio_ext1_act_pulse').is(':checked')) {
			gpio_ext1_activation_mode = ActivationMode.PULSE;
		} else if (md.getContent().find('#gpio_ext1_act_state').is(':checked')) {
			gpio_ext1_activation_mode = ActivationMode.EDGE;		
		}

		if (md.getContent().find('#gpio_ext2_disabled').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.DISABLED;
		} else if (md.getContent().find('#gpio_ext2_enable_id').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.ENABLE_ID;
		} else if (md.getContent().find('#gpio_ext2_alarm_input').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.ALARM_INPUT;
		} else if (md.getContent().find('#gpio_ext2_emergency').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.EMERGENCY_MODE_INPUT;
		} else if (md.getContent().find('#gpio_ext2_lockdown').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.LOCKDOWN_MODE_INPUT;
		} else if (md.getContent().find('#gpio_ext2_pjsip').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.PJSIP_BUTTON;
		} else if (md.getContent().find('#gpio_ext2_interlock').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.INTERLOCK;
		} else if (md.getContent().find('#gpio_ext2_open_relay').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.OPEN_RELAY;
		} else if (md.getContent().find('#gpio_ext2_open_secbox').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.OPEN_SEC_BOX;
		} else if (md.getContent().find('#gpio_ext2_open_all').is(':checked')) {
			gpio_ext2_mode = GpioExtMode.OPEN_ALL;
		}

		if (md.getContent().find('#gpio_ext2_idle').parent().hasClass('switch-on')) {
			gpio_ext2_idle = 1;
		} else {
			gpio_ext2_idle = 0;
		}

		if (md.getContent().find('#gpio_ext2_act_pulse').is(':checked')) {
			gpio_ext2_activation_mode = ActivationMode.PULSE;
		} else if (md.getContent().find('#gpio_ext2_act_state').is(':checked')) {
			gpio_ext2_activation_mode = ActivationMode.EDGE;
		}

		if (md.getContent().find('#gpio_ext3_disabled').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.DISABLED;
		} else if (md.getContent().find('#gpio_ext3_enable_id').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.ENABLE_ID;
		} else if (md.getContent().find('#gpio_ext3_alarm_input').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.ALARM_INPUT;
		} else if (md.getContent().find('#gpio_ext3_emergency').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.EMERGENCY_MODE_INPUT;
		} else if (md.getContent().find('#gpio_ext3_lockdown').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.LOCKDOWN_MODE_INPUT;
		} else if (md.getContent().find('#gpio_ext3_pjsip').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.PJSIP_BUTTON;
		} else if (md.getContent().find('#gpio_ext3_interlock').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.INTERLOCK;
		} else if (md.getContent().find('#gpio_ext3_open_relay').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.OPEN_RELAY;
		} else if (md.getContent().find('#gpio_ext3_open_secbox').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.OPEN_SEC_BOX;
		} else if (md.getContent().find('#gpio_ext3_open_all').is(':checked')) {
			gpio_ext3_mode = GpioExtMode.OPEN_ALL;
		}

		if (md.getContent().find('#gpio_ext3_idle').parent().hasClass('switch-on')) {
			gpio_ext3_idle = 1;
		} else {
			gpio_ext3_idle = 0;
		}

		if (md.getContent().find('#gpio_ext3_act_pulse').is(':checked')) {
			gpio_ext3_activation_mode = ActivationMode.PULSE;
		} else if (md.getContent().find('#gpio_ext3_act_state').is(':checked')) {
			gpio_ext3_activation_mode = ActivationMode.EDGE;		
		}

		if (gpio_ext1_mode > GpioExtMode.INTERLOCK || gpio_ext2_mode > GpioExtMode.INTERLOCK
			|| gpio_ext3_mode > GpioExtMode.INTERLOCK) {
			buttonhole1_enabled = 1
		}

		MessengerUtil.send('set_configuration', {
			general: {
				gpio_ext1_mode: gpio_ext1_mode,
				gpio_ext2_mode: gpio_ext2_mode,
				gpio_ext3_mode: gpio_ext3_mode,
				gpio_ext1_idle: gpio_ext1_idle.toString(),
				gpio_ext2_idle: gpio_ext2_idle.toString(),
				gpio_ext3_idle: gpio_ext3_idle.toString(),
				gpio_ext1_activation_mode: gpio_ext1_activation_mode,
				gpio_ext2_activation_mode: gpio_ext2_activation_mode,
				gpio_ext3_activation_mode: gpio_ext3_activation_mode,
				buttonhole1_enabled: buttonhole1_enabled.toString()
			}
		});

		if (md.getContent().find('#relay_enabled').parent().hasClass('switch-on')) {
			relay1_enabled = 1;
		}

		if (md.getContent().find('#relay_auto_close').parent().hasClass('switch-on')) {
			relay1_auto_close = 1;
		}

		relay1_timeout = parseInt(md.getContent().find('#relay_timeout').val());
		if (isNaN(relay1_timeout) || relay1_timeout < 100 || relay1_timeout > 10000) {
			return returnMessage({ error: "Invalid activation time! (must be between 100 and 10000 ms)" });
		}

		let bell_enabled = 0;
		let siren_enabled = 0;
		if (md.getContent().find('#relay_normal_access').is(':checked')) {
			relay_out_mode = OutputMode.NORMAL_ACCESS;
		} else if (md.getContent().find('#relay_only_rejected').is(':checked')) {
			relay_out_mode = OutputMode.ONLY_REJECTED;
		} else if (md.getContent().find('#relay_bell').is(':checked')) {
			relay_out_mode = OutputMode.BELL;
			bell_enabled = 1;
		} else if (md.getContent().find('#relay_siren').is(':checked')) {
			relay_out_mode = OutputMode.SIREN;
			siren_enabled = 1;
		} else if (md.getContent().find('#relay_emergency').is(':checked')) {
			relay_out_mode = OutputMode.EMERGENCY;
		}

		let sec_box_out_mode = MessengerUtil.send('get_configuration', {
			general: ['sec_box_out_mode']
		}).general.sec_box_out_mode;

		if (sec_box_out_mode ==	OutputMode.SIREN) {
			siren_enabled = 1;
		}

		if (sec_box_out_mode ==	OutputMode.BELL) {
			bell_enabled = 1;
		}

		MessengerUtil.send('set_configuration', {
			general: {
				relay1_enabled: relay1_enabled.toString(),
				relay_out_mode: relay_out_mode,
				relay1_auto_close: relay1_auto_close.toString(),
				relay1_timeout: relay1_timeout.toString()
			}
		});

		MessengerUtil.send('set_configuration', {
			'alarm': {
				'siren_enabled': siren_enabled.toString()
			}
		});

		MessengerUtil.send('set_configuration', {
			general: { bell_enabled: bell_enabled.toString() }
		});

		return returnMessage(null);
	}

}

var modal_secBoxEdit = $('#modal_secBoxEdit').clone().end().remove();
function openSecBoxModal() {
	var md = new Modal();
	md.setTitle('Security box');
	var osdp_info = MessengerUtil.send(
		'get_configuration',
		{
			'osdp': [
				'enabled'
			]
		}
	);

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Funcionalidade disponível somente para equipamentos no modo primário');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else if (osdp_info.osdp.enabled == '1') {
		md.setContent("Disable OSDP to configure EAM functionality. A device restart is required after disabling.");
		md.addButton([
			{
				'type': 'save',
				'text': 'Deactivate OSDP',
				'callback': disable_OSDP
			},
			{
				'type': 'cancel'
			}
		]);
		md.show();
	} else {
		md.setHTMLContent(modal_secBoxEdit);
		md.addButton([
			{
				'type': 'save',
				'callback': save
			},
			{
				'type': 'cancel'
			}
		]);
	}

	function disable_OSDP(returnMessage) {
		let data = MessengerUtil.send('set_configuration', {
			'osdp': {
				'enabled': '0'
			}
		});
		var rebootAlert = new Modal();
		rebootAlert.setTitle('OSDP Settings');
		rebootAlert.setContent('Rebooting device');
		rebootAlert.show();
		setTimeout(function () {
			var time = 60;
			MessengerUtil.sendAsync('reboot', null, null, false);
			Main.sessionFail({ error: 'customError' }, function () {
				setInterval(function () {
					time--;
					if (time === 0)
						window.location = 'login.html';
					$('#countReboot').html(('00' + time).slice(-2));
				}, 1000);

			}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
		}, 10000);
		return returnMessage(data.error != undefined ? data.error : null);
	}

	function save(returnMessage) {
		var relayTimeout;
		var doorSensorEn = 0;
		var doorSensorIdle = 0;
		var relayAutoClose = 0;
		var exception_mode = 'none';
		var remote_interlock_ck_enabled = 0;
		var remote_interlock_api_bypass_ck_enabled = 0;
		var remote_interlock_button_bypass_ck_enabled = 0;
		var sec_box_out_mode = OutputMode.NORMAL_ACCESS;

		if (md.getContent().find("#doorTimeout").val() === "") {
			return returnMessage({ error: "Do not leave any fields blank!" });
		}

		relayTimeout = parseInt(md.getContent().find('#doorTimeout').val());
		if (isNaN(relayTimeout) || relayTimeout < 100 || relayTimeout > 10000) {
			return returnMessage({ error: "Invalid activation time! (must be between 100 and 10000 ms)" });
		}

		if (md.getContent().find('#chkSensorActive').parent().hasClass('switch-on')) {
			doorSensorEn = 1;
		}
		if (md.getContent().find('#chkSensorNO').parent().hasClass('switch-on')) {
			doorSensorIdle = 1;
		}
		if (md.getContent().find('#chkAutoClose').parent().hasClass('switch-on')) {
			relayAutoClose = 1;
		}
		if (md.getContent().find('#exception_mode_emergency').is(':checked')) {
			exception_mode = 'emergency';
		}
		else if (md.getContent().find('#exception_mode_lock_down').is(':checked')) {
			exception_mode = 'lock_down';
		}
		if (md.getContent().find('#chkRemoteInterlockEnabled').parent().hasClass('switch-on')) {
			remote_interlock_ck_enabled = 1;
		}
		if (md.getContent().find('#chkRemoteInterlockAPIBypassEnabled').parent().hasClass('switch-on')) {
			remote_interlock_api_bypass_ck_enabled = 1;
		}
		if (md.getContent().find('#chkRemoteInterlockButtonBypassEnabled').parent().hasClass('switch-on')) {
			var fw_version = MessengerUtil.send('update_secbox_firmware_version');
			var hex_fw_version = fw_version.fw_version.toString(16);
			var fw_version_first = parseInt(hex_fw_version[0]);
			var fw_version_third = parseInt(hex_fw_version[2]);
			if (fw_version_first < 2 && fw_version_third < 3) {
				remote_interlock_button_bypass_ck_enabled = 0;
				return returnMessage({ error: "Function to ignore interlock when opening door via Push Button unavailable in the current version of EAM firmware!" });
			} else {
				remote_interlock_button_bypass_ck_enabled = 1;
			}
		}

		let bell_enabled = 0;
		let siren_enabled = 0;
		if (md.getContent().find('#normal_access').is(':checked')) {
			sec_box_out_mode = OutputMode.NORMAL_ACCESS;
		} else if (md.getContent().find('#only_rejected').is(':checked')) {
			sec_box_out_mode = OutputMode.ONLY_REJECTED;
		} else if (md.getContent().find('#bell').is(':checked')) {
			bell_enabled = 1;
			sec_box_out_mode = OutputMode.BELL;
		} else if (md.getContent().find('#siren').is(':checked')) {
			siren_enabled = 1;
			sec_box_out_mode = OutputMode.SIREN;
		}

		let relay_out_mode = MessengerUtil.send('get_configuration', {
			general: ['relay_out_mode']
		}).general.relay_out_mode;

		if (relay_out_mode ==	OutputMode.SIREN) {
			siren_enabled = 1;
		}

		if (relay_out_mode ==	OutputMode.BELL) {
			bell_enabled = 1;
		}

		MessengerUtil.send('modify_objects', {
			"object": "sec_boxs",
			"fields": ["relay_timeout", "door_sensor_enabled", "door_sensor_idle", "auto_close_enabled"],
			"where": {
				'sec_boxs': {
					'id': [65793]
				}
			},
			"values": {
				"relay_timeout": relayTimeout,
				"door_sensor_enabled": doorSensorEn,
				"door_sensor_idle": doorSensorIdle,
				"auto_close_enabled": relayAutoClose
			}
		});

		var previousExceptionMode = MessengerUtil.send('get_configuration', {
			general: ['exception_mode']
		});

		MessengerUtil.send('set_network_interlock', {
			"interlock_enabled": remote_interlock_ck_enabled,
			"api_bypass_enabled": remote_interlock_api_bypass_ck_enabled,
			"rex_bypass_enabled": remote_interlock_button_bypass_ck_enabled
		});

		var data_error = null

		if (exception_mode.localeCompare(previousExceptionMode.general.exception_mode) != 0) {
			var data = MessengerUtil.send('set_configuration', {
				general: { exception_mode: exception_mode }
			});
			data_error = data.error != undefined ? data.error : null
		}

		MessengerUtil.send('set_configuration', {
			general: { sec_box_out_mode: sec_box_out_mode }
		});

		MessengerUtil.send('set_configuration', {
			'alarm': {
				'siren_enabled': siren_enabled.toString()
			}
		});

		MessengerUtil.send('set_configuration', {
			general: { bell_enabled: bell_enabled.toString() }
		});

		drawRelaysMenu();
		return returnMessage(data_error);
	}

	md.show(function () {

		var remote_interlock_enabled = MessengerUtil.send('get_configuration',
			{
				'general': ['network_interlock_enabled']
			});

		var remote_interlock_api_bypass_enabled = MessengerUtil.send('get_configuration',
			{
				'general': ['network_interlock_bypass_api']
			});

		var remote_interlock_button_bypass_enabled = MessengerUtil.send('get_configuration',
			{
				'general': ['network_interlock_bypass_rex']
			});

		var secBox = MessengerUtil.send('load_objects', {
			'object': 'sec_boxs',
			'where': {
				'sec_boxs': {
					'id': [65793]
				}
			}
		}).sec_boxs[0];

		var data = MessengerUtil.send('get_configuration', {
			general: ['exception_mode', 'sec_box_out_mode'],
			sec_box: [
				'security_mode'
			]
		});

		console.log(data.sec_box.security_mode)

		md.getContent().find('#chkRemoteInterlockEnabled').parent().bootstrapSwitch();
		md.getContent().find('#chkRemoteInterlockEnabled').parent().bootstrapSwitch('setState', remote_interlock_enabled.general.network_interlock_enabled == '1');
		md.getContent().find('#chkRemoteInterlockAPIBypassEnabled').parent().bootstrapSwitch();
		md.getContent().find('#chkRemoteInterlockAPIBypassEnabled').parent().bootstrapSwitch('setState', remote_interlock_api_bypass_enabled.general.network_interlock_bypass_api == '1');
		md.getContent().find('#chkRemoteInterlockButtonBypassEnabled').parent().bootstrapSwitch();
		md.getContent().find('#chkRemoteInterlockButtonBypassEnabled').parent().bootstrapSwitch('setState', remote_interlock_button_bypass_enabled.general.network_interlock_bypass_rex == '1');
		md.getContent().find('#chkSensorActive').parent().bootstrapSwitch();
		md.getContent().find('#chkSensorActive').parent().bootstrapSwitch('setState', secBox.door_sensor_enabled);
		md.getContent().find('#chkSensorNO').parent().bootstrapSwitch();
		md.getContent().find('#chkSensorNO').parent().bootstrapSwitch('setState', secBox.door_sensor_idle);
		md.getContent().find('#chkAutoClose').parent().bootstrapSwitch();
		md.getContent().find('#chkAutoClose').parent().bootstrapSwitch('setState', secBox.auto_close_enabled);
		md.getContent().find('#doorTimeout').val(secBox.relay_timeout);
		md.getContent().find('#chkSecurityModeActive').parent().bootstrapSwitch();
		md.getContent().find('#chkSecurityModeActive').parent().bootstrapSwitch('setState', data.sec_box.security_mode === '1');
		md.getContent().find('#chkSecurityModeActive').parent().parent().on('switch-change', function (e, data) {
			chkSecurityModeCallback();
		});
		switch (data.general.exception_mode) {
			case "emergency":
				md.getContent().find('#exception_mode_emergency').attr('checked', 'checked');
				break;
			case "lock_down":
				md.getContent().find('#exception_mode_lock_down').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#exception_mode_disable').attr('checked', 'checked');
		}

		switch (data.general.sec_box_out_mode) {
			case OutputMode.NORMAL_ACCESS:
				md.getContent().find('#normal_access').attr('checked', 'checked');
				break;
			case OutputMode.ONLY_REJECTED:
				md.getContent().find('#only_rejected').attr('checked', 'checked');
				break;
			case OutputMode.BELL:
				md.getContent().find('#bell').attr('checked', 'checked');
				break;
			case OutputMode.SIREN:
				md.getContent().find('#siren').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#normal_access').attr('checked', 'checked');
		}

		md.getContent().find('#chkResetCrypto').click(function () {
			var secbox_is_active = MessengerUtil.send('secbox_is_active');
			if (secbox_is_active.isActive == true) {
				reset_crypto_key();
			}
			else {
				var modal_sc_not_found = new Modal();
				modal_sc_not_found.setTitle('SecBox V2 not found');
				modal_sc_not_found.setContent('SecBox V2 was found');
				modal_sc_not_found.show();
				setTimeout(function () { modal_sc_not_found.hide(); }, 2000);
			}
		});

		md.getContent().find('#chkUpdateFirmware').click(function () {
			var fw_new_version = MessengerUtil.send('update_secbox_firmware_new_version');
			if (fw_new_version.fw_new_version == 0) {
				var modal_no_version_found = new Modal();
				modal_no_version_found.setTitle('Firmware update');
				modal_no_version_found.setContent('No version found');
				modal_no_version_found.show();
				setTimeout(function () { modal_no_version_found.hide(); }, 2000);
			} else if (fw_new_version.fw_new_version == 1) {
				var modal_no_update = new Modal();
				modal_no_update.setTitle('Firmware update');
				modal_no_update.setContent('SecBox V2 is up to date');
				modal_no_update.show();
				setTimeout(function () { modal_no_update.hide(); }, 2000);
			} else {
				update_secbox_firmware()
			}
		});
		md.getContent().find('#remoteInterlockModes').click(function () {
			function reloadRulesTable() {
				md.getContent().find('#rules_list_area').show();
				var remote_interlock_rules = MessengerUtil.send('load_objects',
					{
						"object": "network_interlocking_rules"
					})
				let ruleLines = '';
				remote_interlock_rules.network_interlocking_rules.forEach(function (rule) {
					ruleLines += "<tr>" +
						// '<td>' + rule.id + "</td>" +
						'<td>' + rule.ip + "</td>" +
						'<td>' + rule.login + "</td>" +
						'<td>' + rule.password + "</td>" +
						'<td>' + rule.port + "</td>" +
						'<td>' + rule.portal_name + "</td>" +
						'<td>' + (rule.enabled === 0 ? "No" : "Yes") + "</td>" +
						'<td>' + '<div class="editRule pointer" idRule="' + rule.id + '" ruleIpAddress="' + rule.ip +
						'" ruleLogin="' + rule.login + '" rulePassword="' + rule.password + '" rulePortWeb="' + rule.port + '" rulePortalName="' + rule.portal_name + '" ruleEnabled="' + rule.enabled +
						'"><center><div class="btn"><i class="icon-pencil"></i></div></center></div>' + "</td>" +
						"<td>" + '<div class="removeRule pointer" idRule="' + rule.id +
						'"><center><div class="btn red" ><img src="/images/trash.png" alt="add" width="32" style="margin-top: -2px" /></div></center></div>' + "</td>" +
						"</tr>"
				});

				md.getContent().find('#interlock_rules_table_body').html(ruleLines);
				// if (md.getContent().find('#tab2_sb').hasClass('active')) {
				// 	var width = md.getContent().find('#interlock_rules_table_body').width() + 30;
				// 	md.changeWidth(width.toString() + "px");
				// }
				// md.centerModal();

				md.getContent().find('.editRule').click(function (event) {
					let editModal = new Modal();
					editModal.setTitle('Edit Rule');
					editModal.setHTMLContent($('#modal_networkInterlockRuleEdit').clone());
					editModal.addButton([
						{
							'type': 'ok',
							'callback': edit,
							'text': 'Edit'
						},
						{
							'type': 'cancel'
						}
					]);

					const id = parseInt($(this).attr('idRule'));
					const ip_address = $(this).attr('ruleIpAddress');
					const login = $(this).attr('ruleLogin');
					const password = $(this).attr('rulePassword');
					const port = $(this).attr('rulePortWeb');
					const portal_name = $(this).attr('rulePortalName');
					const rule_enabled = parseInt($(this).attr('ruleEnabled'));
					editModal.show(function () {
						editModal.getContent().find('#remoteInterlockInputIP').val(ip_address);
						editModal.getContent().find('#remoteInterlockInputLogin').val(login);
						editModal.getContent().find('#remoteInterlockInputPassword').val(password);
						editModal.getContent().find('#remoteInterlockInputPortWeb').val(port);
						editModal.getContent().find('#remoteInterlockInputDoorName').val(portal_name);
						editModal.getContent().find('#remoteInterlockRuleEnabled').val(rule_enabled).change();
					});

					function edit() {
						const ip_address = editModal.getContent().find('#remoteInterlockInputIP').val();
						const login = editModal.getContent().find('#remoteInterlockInputLogin').val();
						const password = editModal.getContent().find('#remoteInterlockInputPassword').val();
						const port = editModal.getContent().find('#remoteInterlockInputPortWeb').val();
						const portal_name = editModal.getContent().find('#remoteInterlockInputDoorName').val();
						const rule_enabled = parseInt(editModal.getContent().find('#remoteInterlockRuleEnabled').val());

						if ((portal_name.length !== 0) && (ip_address.length !== 0)) {
							MessengerUtil.send('modify_objects', {
								"object": "network_interlocking_rules",
								"values": {
									"ip": ip_address,
									"login": login,
									"password": password,
									"port": port,
									"portal_name": portal_name,
									"enabled": rule_enabled
								},
								"where": {
									"network_interlocking_rules": {
										"id": id
									}
								}
							})
						}


						setTimeout(reloadRulesTable, 500);
						editModal.close();
					}

					editModal.getContent().find('#btn_remote_interlock_test').click(function (returnMessage) {
						var sysdata = MessengerUtil.send('system_information', null, null, false);
						var https = 'http://';
						if (sysdata.network.ssl_enabled) {
							https = 'https://';
						}
						var url = https + editModal.getContent().find('#remoteInterlockInputIP').val() + ':' + editModal.getContent().find('#remoteInterlockInputPortWeb').val() + '/login.fcgi';
						data = {
							'login': editModal.getContent().find('#remoteInterlockInputLogin').val(),
							'password': editModal.getContent().find('#remoteInterlockInputPassword').val()
						}
						var dataOut = null;
						var contents = {
							url: url,
							async: false,
							processData: false,
							type: 'POST',
							contentType: 'application/json',
							success: function (result) {
								dataOut = result;
							},
							error: function (result) {
								if (result.readyState != 4)
									dataOut = { status: result.status, error: 'Unexpected error' };
								else
									dataOut = !result.responseJSON ? JSON.parse(result.responseText) : result.responseJSON;

								Main.sessionFail(dataOut, null);
								console.log(dataOut);
							}
						};
						contents.data = Main.bigJSONstringify(data);
						$.ajax(contents);
						var testResponse = new Modal();
						testResponse.setTitle('Connection Test');
						var content = null;
						if (dataOut.error != undefined) {
							content = 'Error connecting to remote device.';
						} else {
							if (dataOut.session.length === 0) {
								content = 'Error connecting to remote device.';
							} else {
								content = 'Conection successful!';
							}
						}
						testResponse.setContent(content);
						testResponse.addButton([
							{
								'type': 'ok',
								'callback': function () {
									testResponse.close();
								}
							}
						]);
						testResponse.show();
					});
				})

				md.getContent().find('.removeRule').click(function (event) {
					let removeModal = new Modal();
					removeModal.setTitle('Delete Rule');
					removeModal.setContent('Are you sure you wish to delete this rule?');
					removeModal.addButton([
						{
							'type': 'ok',
							'callback': remove
						},
						{
							'type': 'cancel'
						}
					]);

					const index = parseInt($(this).attr('idRule'));
					function remove() {
						MessengerUtil.send('destroy_objects', {
							'object': 'network_interlocking_rules',
							'where': {
								'network_interlocking_rules': {
									'id': index
								}
							}
						})
						setTimeout(reloadRulesTable(), 500);
						removeModal.close();
					}
					removeModal.show(function () {

					});
				})
				md.getContent().find('#add_rule_button').click(function () {
					let addModal = new Modal();
					addModal.setTitle('Add Rule');
					addModal.setHTMLContent($('#modal_networkInterlockRuleEdit').clone());
					addModal.addButton([
						{
							'type': 'ok',
							'callback': edit,
							'text': 'Save'
						},
						{
							'type': 'cancel'
						}
					]);
					addModal.show(function () {

					});
					function edit() {
						const ip_address = addModal.getContent().find('#remoteInterlockInputIP').val();
						const login = addModal.getContent().find('#remoteInterlockInputLogin').val();
						const password = addModal.getContent().find('#remoteInterlockInputPassword').val();
						const port = addModal.getContent().find('#remoteInterlockInputPortWeb').val();
						const portal_name = addModal.getContent().find('#remoteInterlockInputDoorName').val();
						const rule_enabled = parseInt(addModal.getContent().find('#remoteInterlockRuleEnabled').val());
						if ((portal_name.length !== 0) && (ip_address.length !== 0)) {
							MessengerUtil.send('create_objects', {
								"object": "network_interlocking_rules",
								"values": [{
									"ip": ip_address,
									"login": login,
									"password": password,
									"port": port,
									"portal_name": portal_name,
									"enabled": rule_enabled
								}]
							})
						}
						setTimeout(reloadRulesTable, 500);
						addModal.close();
					}
					addModal.getContent().find('#btn_remote_interlock_test').click(function (returnMessage) {
						var sysdata = MessengerUtil.send('system_information', null, null, false);
						var https = 'http://';
						if (sysdata.network.ssl_enabled) {
							https = 'https://';
						}
						var url = https + addModal.getContent().find('#remoteInterlockInputIP')[0].value + '/hidlogin.fcgi';
						data = {
							'login': addModal.getContent().find('#remoteInterlockInputLogin').val(),
							'password': addModal.getContent().find('#remoteInterlockInputPassword').val()
						}
						var dataOut = null;
						var contents = {
							url: url,
							async: false,
							processData: false,
							type: 'POST',
							contentType: 'application/json',
							success: function (result) {
								dataOut = result;
							},
							error: function (result) {
								if (result.readyState != 4)
									dataOut = { status: result.status, error: 'Unexpected error' };
								else
									dataOut = !result.responseJSON ? JSON.parse(result.responseText) : result.responseJSON;

								Main.sessionFail(dataOut, null);
								console.log(dataOut);
							}
						};
						contents.data = Main.bigJSONstringify(data);
						$.ajax(contents);
						var testResponse = new Modal();
						testResponse.setTitle('Connection Test');
						var content = null;
						if (dataOut.error != undefined) {
							content = 'Error connecting to remote device.';
						} else {
							if (dataOut.session.length === 0) {
								content = 'Error connecting to remote device.';
							} else {
								content = 'Conection successful!';
							}
						}
						testResponse.setContent(content);
						testResponse.addButton([
							{
								'type': 'ok',
								'callback': function () {
									testResponse.close();
								}
							}
						]);
						testResponse.show();
					});
				});
				function getWidth() {
					var width = md.getContent().find('#interlock_rules_table_body').width() + 60;
					// if (width <= 30) {
					// 	width = 690;
					// }
					md.changeWidth(width.toString() + "px");
				}
				setTimeout(getWidth, 10);
			}
			reloadRulesTable();
		});

		md.getContent().find('#configModes').click(function () {
			md.changeWidth(560 + "px");
		});

		md.getContent().find('#firmwareModes').click(function () {
			md.changeWidth(560 + "px");
		});

		md.getContent().find('#btn_remote_interlock_test').click(function (returnMessage) {
			var sysdata = MessengerUtil.send('system_information', null, null, false);
			var https = 'http://';
			if (sysdata.network.ssl_enabled) {
				https = 'https://';
			}
			var url = https + addModal.getContent().find('#remoteInterlockInputIP')[0].value + '/hidlogin.fcgi';
			data = {
				'login': md.getContent().find('#remoteInterlockInputLogin')[0].value,
				'password': md.getContent().find('#remoteInterlockInputPassword')[0].value
			}
			var dataOut = null;
			var contents = {
				url: url,
				async: false,
				processData: false,
				type: 'POST',
				contentType: 'application/json',
				success: function (result) {
					dataOut = result;
				},
				error: function (result) {
					if (result.readyState != 4)
						dataOut = { status: result.status, error: 'Unexpected error' };
					else
						dataOut = !result.responseJSON ? JSON.parse(result.responseText) : result.responseJSON;

					Main.sessionFail(dataOut, null);
					console.log(dataOut);
				}
			};
			contents.data = JSON.stringify(data);
			$.ajax(contents);
			var testResponse = new Modal();
			testResponse.setTitle('Teste de conexão');
			var content = null;
			if (dataOut.error != undefined) {
				content = 'Error connecting to remote device.';
			} else {
				if (dataOut.session.length === 0) {
					content = 'Error connecting to remote device.';
				} else {
					content = 'Conection successful!';
				}
			}
			testResponse.setContent(content);
			testResponse.addButton([
				{
					'type': 'ok',
					'callback': function () {
						testResponse.close();
					}
				}
			]);
			testResponse.show();
		});
		showFirmwareModes();
		showResetCryptoKeySwitch(md.getContent().find('#chkSecurityModeActive').parent().hasClass('switch-on'));

		var fw_version = MessengerUtil.send('update_secbox_firmware_version');
		hex_fw_version = fw_version.fw_version.toString(16);
		md.getContent().find('#var_fw_version')[0].value = '2.' + hex_fw_version[0] + '.' + hex_fw_version[2];

		var secbox_serial = MessengerUtil.send('secbox_serial_number');
		md.getContent().find('#var_sb_serial')[0].value = secbox_serial.serial;

		function showFirmwareModes() {
			var secbox_is_active = MessengerUtil.send('secbox_is_active');
			if (secbox_is_active.isActive == true) {
				md.getContent().find('#firmwareModes').show();
			}
			else {
				md.getContent().find('#firmwareModes').hide();
			}
		}


		function showResetCryptoKeySwitch(security_mode) {
			if (security_mode) {
				md.getContent().find('#resetCryptoSwitch').show();
			}
			else {
				md.getContent().find('#resetCryptoSwitch').hide();
			}
		}

		function chkSecurityModeCallback() {
			var secbox_is_active = MessengerUtil.send('secbox_is_active');
			var security_mode = md.getContent().find('#chkSecurityModeActive').parent().hasClass('switch-on') ? '1' : '0';
			if (security_mode === '0' && data.sec_box.security_mode === '1') {
				default_crypto_key();
			} else if (security_mode === '1' && data.sec_box.security_mode === '0') {
				if (secbox_is_active.isActive == true) {
					var fw_new_version = MessengerUtil.send('update_secbox_firmware_new_version');
					if (fw_new_version.fw_new_version == 1) {
						random_crypto_key();
					} else if (fw_new_version.fw_new_version > 1) {
						var modal_sc_not_found = new Modal();
						modal_sc_not_found.setTitle('Firmware update');
						modal_sc_not_found.setContent('EAM V2 needs to be updated');
						modal_sc_not_found.show();
						setTimeout(function () { modal_sc_not_found.hide(); }, 2000);
						if (md.getContent().find('#ckResetCrypto').parent().hasClass('switch-on')) {
							md.getContent().find('#ckResetCrypto').parent().bootstrapSwitch('setState', false);
						} else {
							md.getContent().find('#chkSecurityModeActive').parent().bootstrapSwitch('setState', false);
						}
					}
				} else {
					var modal_sc_not_found = new Modal();
					modal_sc_not_found.setTitle('SecBox V2 not found');
					modal_sc_not_found.setContent('SecBox V2 was found');
					modal_sc_not_found.show();
					setTimeout(function () { modal_sc_not_found.hide(); }, 2000);
					if (md.getContent().find('#ckResetCrypto').parent().hasClass('switch-on')) {
						md.getContent().find('#ckResetCrypto').parent().bootstrapSwitch('setState', false);
					} else {
						md.getContent().find('#chkSecurityModeActive').parent().bootstrapSwitch('setState', false);
					}
				}
			}
		}

		function random_crypto_key() {
			var md2 = new Modal();
			md2.setTitle('Advanced communication');
			md2.setContent('In advanced communication, the EAM V2 will only communicate with this equipment. Do you wish to continue? Your device will restart.');
			md2.addButton([
				{
					'type': 'ok',
					'callback': function () {
						var data = MessengerUtil.send('set_configuration', {
							sec_box: {
								security_mode: '1'
							}
						});
						var time = 60;
						Main.sessionFail({ error: 'customError' }, function () {
							setInterval(function () {
								time--;
								if (time == 0)
									window.location = 'login.html';
								$('#countReboot').html(('00' + time).slice(-2));
							}, 1000);
						}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
						MessengerUtil.send('change_crypto_key_random');
						return true;
					}
				},
				{
					'type': 'cancel',
					'callback': function () {
						if (md.getContent().find('#ckResetCrypto').parent().hasClass('switch-on')) {
							md.getContent().find('#ckResetCrypto').parent().bootstrapSwitch('setState', false);
							md2.close();
						} else {
							md.getContent().find('#chkSecurityModeActive').parent().bootstrapSwitch('setState', false);
							md2.close();
						}
					}
				}
			]);
			md2.show();
		}

		function default_crypto_key() {
			var md3 = new Modal();
			md3.setTitle('Standard communication');
			md3.setContent('In standard communication mode, the EAM V2 can communicate with any device. Do you wish to continue? Your device will restart.');
			md3.addButton([
				{
					'type': 'ok',
					'callback': function () {
						var data = MessengerUtil.send('set_configuration', {
							sec_box: {
								security_mode: '0'
							}
						});
						var time = 60;
						Main.sessionFail({ error: 'customError' }, function () {
							setInterval(function () {
								time--;
								if (time == 0)
									window.location = 'login.html';
								$('#countReboot').html(('00' + time).slice(-2));
							}, 1000);
						}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
						var secbox_is_active = MessengerUtil.send('secbox_is_active');
						if (secbox_is_active.isActive == true) {
							MessengerUtil.send('change_crypto_key_default');
						} else {
							MessengerUtil.send('reset_crypto_key');
						}
						return true;
					}
				},
				{
					'type': 'cancel',
					'callback': function () {
						md.getContent().find('#chkSecurityModeActive').parent().bootstrapSwitch('setState', true);
						md3.close();
					}
				}
			]);
			md3.show();
		}

		function reset_crypto_key() {
			var md2 = new Modal();
			md2.setTitle('Advanced communication');
			md2.setContent('Renew advanced communication key. Do you wish to continue? Your device will restart.');
			md2.addButton([
				{
					'type': 'ok',
					'callback': function () {
						var fw_new_version = MessengerUtil.send('update_secbox_firmware_new_version');
						if (fw_new_version.fw_new_version == 1) {
							var data = MessengerUtil.send('set_configuration', {
								sec_box: {
									security_mode: '1'
								}
							});
							var time = 60;
							Main.sessionFail({ error: 'customError' }, function () {
								setInterval(function () {
									time--;
									if (time == 0)
										window.location = 'login.html';
									$('#countReboot').html(('00' + time).slice(-2));
								}, 1000);
							}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
							MessengerUtil.send('change_crypto_key_random');
							return true;
						} else if (fw_new_version.fw_new_version > 1) {
							var modal_sc_not_found = new Modal();
							modal_sc_not_found.setTitle('Firmware update');
							modal_sc_not_found.setContent('EAM V2 needs to be updated');
							modal_sc_not_found.show();
							setTimeout(function () { modal_sc_not_found.hide(); }, 2000);
							if (md.getContent().find('#ckResetCrypto').parent().hasClass('switch-on')) {
								md.getContent().find('#ckResetCrypto').parent().bootstrapSwitch('setState', false);
							} else {
								md.getContent().find('#chkSecurityModeActive').parent().bootstrapSwitch('setState', false);
							}
						}
					}
				},
				{
					'type': 'cancel',
					'callback': function () {
						md2.close();
					}
				}
			]);
			md2.show();
		}

		function update_secbox_firmware() {

			var fw_new_version = MessengerUtil.send('update_secbox_firmware_new_version');
			hex_fw_new_version = fw_new_version.fw_new_version.toString(16);
			var var_fw_new_version = '2.' + hex_fw_new_version[0] + '.' + hex_fw_new_version[2];

			var md3 = new Modal();
			md3.setTitle('Update firmware');
			md3.setContent('Update to version ' + var_fw_new_version + '?');

			md3.addButton([
				{
					'type': 'ok',
					'callback': function () {
						var updateFw = MessengerUtil.send('update_secbox_firmware');
						if (updateFw.isUpdated == true) {
							md3.close();
							var md4 = new Modal();
							md4.setTitle('Update firmware');
							md4.setContent('Firmware is already updated.');
							setTimeout(function () { md4.hide(); }, 2000)
							md4.show();
							return;
						}
						md3.close();
						var md4 = new Modal();
						md4.setContent('' +
							'<div id="message2">Updating...</div><br/>' +
							'<div class="progress">' +
							'<div class="progress-bar expbar2" style="color:#FFFFFF00;width:0;background-color:#35AA47" role="progressbar">.</div>' +
							'</div>'
						);
						md4.updateProgress = async function (value, message) {
							md4.getContent().find('#message2').text(message);
							md4.getContent().find('.expbar2').css({ width: value + '%' });

							await new Promise(function (resolve, reject) {
								setTimeout(resolve, 500);
							});

							if (value == 100) {
								setTimeout(function () { md4.hide(); }, 2000);
							}
						};
						md4.show();

						var updateInterval = setInterval(function () {
							var updateFwStatus = MessengerUtil.send('update_secbox_firmware_status');
							md4.updateProgress(0, "Updating. Wait");
							md4.updateProgress(updateFwStatus.bitsWritten, "Updating EAM V2. Please wait");
							if (updateFwStatus.bitsWritten == 100) {
								clearInterval(updateInterval);
								md4.updateProgress(updateFwStatus.bitsWritten, "EAM V2 successfully updated!");
							}
						}, 1000);

					}
				},
				{
					'type': 'cancel',
					'callback': function () {
						md3.close();
					}
				}
			]);

			md3.show();
		}
	});
}

var modal_turnstileEdit = $('#modal_turnstileEdit').clone().end().remove();
function openTurnstileModal(){
	var checkCatraEvent;
	var checkWiegandEvent;
	var data = MessengerUtil.send(
			'get_configuration',
			{
					'general' : ['exception_mode'],
					'sec_box': ['catra_role', 'catra_timeout', 'catra_collect_visitor_card', 'catra_side_to_enter']
			}
	);

	var md = new Modal();
	md.setTitle('Turnstile');
	md.setHTMLContent(modal_turnstileEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel',
			'callback': function () {
				clearInterval(checkWiegandEvent);
				clearInterval(checkCatraEvent);
				md.hide();
			}
		}
	]);

	var warning_modal = new Modal();
	warning_modal.setTitle('Turnstile');
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);

	function getTurnstileFirmwareVersion() {
		try {
			let fw_version = MessengerUtil.send('update_secbox_firmware_version');
			let hex_fw_version = fw_version.fw_version.toString(16);
			let int_fw_version = parseInt(hex_fw_version);
			if (int_fw_version == 0) {
				return 0;
			} else if (int_fw_version < 10) {
				return hex_fw_version;
			}
			return hex_fw_version[0]*10 + hex_fw_version[2];
		} catch (e) {
			return 0;
		}
	}

	function save(returnMessage) {
		var catraSideToEnter = 0;

		clearInterval(checkWiegandEvent);
		clearInterval(checkCatraEvent);
		var catraCollectVisitorCard = '0';
		if (md.getContent().find('#chkVisitorCardCollect').parent().bootstrapSwitch('status')) {
			catraCollectVisitorCard = '1';
		} else {
			catraCollectVisitorCard = '0';
		}
		var exception_mode = '';
		if (md.getContent().find('#exception_mode_emergency').is(':checked')) {
			exception_mode = 'emergency';
		}
		else if (md.getContent().find('#exception_mode_lock_down').is(':checked')) {
			exception_mode = 'lock_down';
		}
		var timeout = parseInt(md.getContent().find('#catraTimeout')[0].value)
		var catra_timeout = (isNaN(timeout) || timeout <= 0 || timeout >= 66) ? "" : (1000*parseInt(md.getContent().find('#catraTimeout')[0].value)).toString();
		if(catra_timeout === ""){
			return returnMessage({error: "Correctly enter the give up time!"});
		}
		if (md.getContent().find('#chkCatraSideToEnter').parent().bootstrapSwitch('status')) {
			catraSideToEnter = '0';
		} else {
			catraSideToEnter = '1';
		}
		var data = MessengerUtil.send(
			'set_configuration',
			{
				sec_box: { catra_collect_visitor_card: catraCollectVisitorCard, catra_timeout: catra_timeout, catra_side_to_enter: catraSideToEnter},
				general: { exception_mode }
			}
		)
		return returnMessage(data.error != undefined ? data.error : null);
	}

	if(data.sec_box.catra_role == '2'){
		warning_modal.show();
	}else{
		md.show(function(){
			md.getContent().find('#chkVisitorCardCollect').parent().bootstrapSwitch();
			md.getContent().find('#chkVisitorCardCollect').parent().bootstrapSwitch('setState', data.sec_box.catra_collect_visitor_card !== '0');
			md.getContent().find('#chkCatraSideToEnter').parent().bootstrapSwitch();
			md.getContent().find('#chkCatraSideToEnter').parent().bootstrapSwitch('setState', data.sec_box.catra_side_to_enter === '0');

			switch (data.general.exception_mode) {
				case "emergency":
					md.getContent().find('#exception_mode_emergency').attr('checked', 'checked');
					break;
				case "lock_down":
					md.getContent().find('#exception_mode_lock_down').attr('checked', 'checked');
					break;
				default:
					md.getContent().find('#exception_mode_disable').attr('checked', 'checked');
			}
			md.getContent().find('#chkUpdateFirmwareTS').click(function(){update_secbox_firmware() });

			md.getContent().find('#catraTimeout')[0].value = Math.round(data.sec_box.catra_timeout/1000);
			showTurnstileDiagnostics();
			showFirmwareModes();
			checkFirmwareVersion();

			function showTurnstileDiagnostics(){
				md.getContent().find('#component_diagnostics_turnistile').attr('checked', 'checked');
				md.getContent().find('#relay_diagnosticis_buttons').hide();
				md.getContent().find('#led_diagnosticis_buttons').hide();
				md.getContent().find('#wiegand_diagnosticis_buttons').hide();
				md.getContent().find('#turn_diagnosticis_buttons').hide();
				md.getContent().find('#BQC_diagnosticis_buttons').hide();

				md.getContent().find('#component_diagnostics_turnistile').parent().parent().on('change', function () {
					if (md.getContent().find('#component_diagnostics_turnistile').is(':checked')) {
						md.getContent().find('#turnistile_diagnosticis_buttons').show();
					} else {
						md.getContent().find('#turnistile_diagnosticis_buttons').hide();
					}
				});

				md.getContent().find('#component_diagnostics_relay').parent().parent().on('change', function () {
					if (md.getContent().find('#component_diagnostics_relay').is(':checked')) {
						md.getContent().find('#relay_diagnosticis_buttons').show();
					} else {
						md.getContent().find('#relay_diagnosticis_buttons').hide();
					}
				});

				md.getContent().find('#component_diagnostics_led').parent().parent().on('change', function () {
					if (md.getContent().find('#component_diagnostics_led').is(':checked')) {
						md.getContent().find('#led_diagnosticis_buttons').show();
					} else {
						md.getContent().find('#led_diagnosticis_buttons').hide();
					}
				});

				md.getContent().find('#component_diagnostics_BQC').parent().parent().on('change', function () {
					if (md.getContent().find('#component_diagnostics_BQC').is(':checked')) {
						var warning_fimware_version = new Modal();
						warning_fimware_version.setTitle('Turnstile');
						warning_fimware_version.setContent('Update the turnstile firmware to be able to control the BQC');
						warning_fimware_version.addButton([
							{
								'type' : 'ok'
							}
						]);
						if (getTurnstileFirmwareVersion() < 8) // Version should be greater then 4.0.8
							warning_fimware_version.show();
						else
							md.getContent().find('#BQC_diagnosticis_buttons').show();
					} else {
						md.getContent().find('#BQC_diagnosticis_buttons').hide();
					}
				});

				md.getContent().find('#component_diagnostics_wiegand').parent().parent().on('change', function () {
					if (md.getContent().find('#component_diagnostics_wiegand').is(':checked')) {
						md.getContent().find('#wiegand_diagnosticis_buttons').show();
						var lastWiegandTime = "";
						var cardNumberTextEl = md.getContent().find('#cardNumberTextTS');
						var wiegandEvent = function() {
							MessengerUtil.sendAsync('get_wiegand_card_read', {}, null, null, function(reply) {
								if (reply.last_read_time !== "" && reply.last_read_time !== lastWiegandTime) {
									lastWiegandTime = reply.last_read_time;
									let uid = reply.card_number.padStart(5, '0');
									cardNumberTextEl.text(reply.facility_code + "," + uid);
								}
							});
						}
						checkWiegandEvent = setInterval(wiegandEvent, 500);
					} else {
						md.getContent().find('#wiegand_diagnosticis_buttons').hide();
						$('#cardNumberTextTS').text('');
						clearInterval(checkWiegandEvent);
					}
				});

				md.getContent().find('#component_diagnostics_turn').parent().parent().on('change', function () {
					if (md.getContent().find('#component_diagnostics_turn').is(':checked')) {
						md.getContent().find('#turn_diagnosticis_buttons').show();
					} else {
						md.getContent().find('#turn_diagnosticis_buttons').hide();
						$('#turnDirectionText').text('');
					}
				});

				md.getContent().find('#chkDirectionClockwiseTS').click(function(){
					MessengerUtil.send('remote_turnstile_control', {action: 3});
				});

				md.getContent().find('#chkDirectionAntiClockwiseTS').click(function(){
					MessengerUtil.send('remote_turnstile_control', {action: 2});
				});

				md.getContent().find('#chkRelay1TS').click(function(){
					MessengerUtil.send('remote_turnstile_control', {action: 10});
				});

				md.getContent().find('#chkRelay2TS').click(function(){
					MessengerUtil.send('remote_turnstile_control', {action: 12});
				});

				md.getContent().find('#chkAuthorizedTS').click(function(){
					MessengerUtil.send('remote_led_control', {event: 0});
					setTimeout(function() { MessengerUtil.send('remote_led_control', {event: 2}); }, 3000);
				});

				md.getContent().find('#chkDeniedTS').click(function(){
					MessengerUtil.send('remote_led_control', {event: 1});
					setTimeout(function() { MessengerUtil.send('remote_led_control', {event: 2}); }, 3000);
				});

				md.getContent().find('#chkDefaultTS').click(function(){
					MessengerUtil.send('remote_led_control', {event: 2});
				});

				md.getContent().find('#chkBQCOpenTS').click(function(){
					MessengerUtil.send('remote_active_BQC');
				});

				md.getContent().find('#chkAllowTurnTS').click(function(){
					MessengerUtil.send('remote_turnstile_control', {action: 4});
					MessengerUtil.send('turnstile_event_state', {event_action:"reset_state"});
					var catraEvent = function() {
						MessengerUtil.sendAsync('turnstile_event_state', {event_action:"turn_state"}, null, null, function(reply){
							var eventState = reply.event_state
							if(eventState != 0){
								switch (eventState) {
									case 1:
										$('#turnDirectionTextTS').text('Blocked right');
										break;
									case 2:
										$('#turnDirectionTextTS').text('Blocked left');
										break;
									case 3:
										$('#turnDirectionTextTS').text('Counter clockwise');
										break;
									case 4:
										$('#turnDirectionTextTS').text('Clockwise');
										break;
									case 5:
										$('#turnDirectionTextTS').text('Give up');
										break;
									default:
										$('#turnDirectionTextTS').text('');
								}
								clearInterval(checkCatraEvent);
							}
						});
					}
					checkCatraEvent = setInterval(catraEvent, 500);
				});
			}

			function checkFirmwareVersion(){
				var fw_version = MessengerUtil.send('update_secbox_firmware_version');
				hex_fw_version = fw_version.fw_version.toString(16);
				int_fw_version = parseInt(hex_fw_version);
				if(int_fw_version < 10){
					md.getContent().find('#var_fw_version_ts')[0].value = '4.0.' + hex_fw_version;
				}else{
					md.getContent().find('#var_fw_version_ts')[0].value = '4.' + hex_fw_version[0] + '.' + hex_fw_version[2];
				}
			}

			function showFirmwareModes(){
				var secbox_is_active = MessengerUtil.send('secbox_is_active');
				if(secbox_is_active.isActive == true){
					var fw_new_version = MessengerUtil.send('update_secbox_firmware_new_version');
					if(fw_new_version.fw_new_version == 0){
						md.getContent().find('#var_fw_status')[0].value = 'Firmware not found';
						md.getContent().find('#var_fw_status')[0].style.color = 'Red';
						md.getContent().find('#chkUpdateFirmwareTS').hide();
					}else if(fw_new_version.fw_new_version == 1){
						md.getContent().find('#var_fw_status')[0].value = 'iDBlock Next is alredy updated';
						md.getContent().find('#var_fw_status')[0].style.color = 'Green';
						md.getContent().find('#chkUpdateFirmwareTS').hide();
					}else if(data.sec_box.catra_role === '2'){
						md.getContent().find('#var_fw_status')[0].value = 'iDBlock Next must be updated, use the primary iDFace';
						md.getContent().find('#var_fw_status')[0].style.color = 'Red';
						md.getContent().find('#chkUpdateFirmwareTS').hide();
					}else{
						md.getContent().find('#var_fw_status')[0].value = 'iDBlock Next must be updated';
						md.getContent().find('#var_fw_status')[0].style.color = 'Red';
						md.getContent().find('#chkUpdateFirmwareTS').show();
					}
				} else{
					md.getContent().find('#turnstile_need_update').hide();
					md.getContent().find('#var_fw_status')[0].value = 'Main board not found';
					md.getContent().find('#var_fw_status')[0].style.color = 'Red';
				}
			}

			function update_secbox_firmware() {
				var fw_new_version = MessengerUtil.send('update_secbox_firmware_new_version');
				hex_fw_new_version = fw_new_version.fw_new_version.toString(16);
				int_fw_new_version = parseInt(hex_fw_new_version);

				if(int_fw_new_version < 10){
					var var_fw_new_version = '4.0.' + hex_fw_new_version;
				}else{
					var var_fw_new_version = '4.' + hex_fw_new_version[0] + '.' + hex_fw_new_version[2];
				}

				var md3 = new Modal();
				md3.setTitle('Update firmware');
				md3.setContent('Update to version ' + var_fw_new_version + '?');

				md3.addButton([
					{
						'type' : 'ok',
						'callback': function(){
							var updateFw = MessengerUtil.send('update_secbox_firmware');
							if(updateFw.isUpdated == true){
								md3.close();
								var md4 = new Modal();
								md4.setTitle('Update firmware');
								md4.setContent('iDBlock Next is alredy updated.');
								setTimeout(function() { md4.hide(); }, 2000)
								md4.show();
								return;
							}
							md3.close();
							var md4 = new Modal();
							md4.setContent('' +
								'<div id="message2">Updating...</div><br/>' +
								'<div class="progress">' +
										'<div class="progress-bar expbar2" style="color:#FFFFFF00;width:0;background-color:#35AA47" role="progressbar">.</div>' +
								'</div>'
							);
							md4.updateProgress = async function(value, message) {
								md4.getContent().find('#message2').text(message);
								md4.getContent().find('.expbar2').css({ width: value + '%' });

								await new Promise(function(resolve, reject) {
									setTimeout(resolve, 500);
								});

								if (value == 100) {
									setTimeout(function() { md4.hide(); }, 2000);
								}
							};
							md4.show();

							var updateInterval =	setInterval(function(){
								var updateFwStatus = MessengerUtil.send('update_secbox_firmware_status');
								md4.updateProgress(0, "Updating. Wait");
								md4.updateProgress(updateFwStatus.bitsWritten, "Updating iDBlock Next. Wait");
								if(updateFwStatus.bitsWritten == 100){
									clearInterval(updateInterval);
									md4.updateProgress(updateFwStatus.bitsWritten, "iDBlock Next successfully updated!");
									checkFirmwareVersion();
									md.getContent().find('#var_fw_status')[0].value = 'iDBlock Next is alredy updated';
									md.getContent().find('#var_fw_status')[0].style.color = 'Green';
									md.getContent().find('#chkUpdateFirmwareTS').hide();
								}
							}, 1000);
						}
					},
					{
						'type' : 'cancel',
						'callback': function(){
							md3.close();
						}
					}
				]);

				md3.show();
			}
		});
	}
}

var modal_wiegandEdit = $('#modal_wiegandEdit').clone().end().remove();
function openWiegandModal() {
	const clock_time_format = MessengerUtil.send('get_configuration', { general: ['clock_12h_format', 'month_day_year_format'] }).general
	const clock_format_message = clock_time_format.clock_12h_format;
	const date_format_message = clock_time_format.month_day_year_format;

	var facilityCodeStart = 0;
	var facilityCodeLength = 0;

	var cardNumberStartBit = 0;
	var cardNumberLength = 0;

	var issueCodeStartBit = 0;
	var issueCodeLength = 0;

	var invertedFacility = 0;
	var invertedCard = 0;

	var wiegandLength = 0;

	var evenParity1 = 0;
	var evenParity2 = 0;
	var oddParity1 = 0;
	var oddParity2 = 0;
	var evenParitySum1 = "";
	var evenParitySum2 = "";
	var oddParitySum1 = "";
	var oddParitySum2 = "";

	var parityBitOrder = "";

	var cardValue = 0;

	var md = new Modal();
	md.setTitle('Wiegand Settings');
	var osdp_info = MessengerUtil.send(
		'get_configuration',
		{
			'osdp': [
				'enabled'
			]
		}
	);

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.setHTMLContent(modal_wiegandEdit);
		if (osdp_info.osdp.enabled == '1') {
			md.getContent().find('#tab1_TS').removeClass('active');
			md.getContent().find('#tab2_TS').addClass('active');
			md.getContent().find('#configurations2TS').parent().addClass('active');
			md.getContent().find('#configurationsTS').hide();
			md.getContent().find('#diagnosticsTS').hide();
		} else {
			md.getContent().find('#configurationsTS').parent().addClass('active');
		}
		md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel',
			'callback': cancel
		}
		]);

		var warning_modal = new Modal();
		warning_modal.setTitle(md.getTitle());
		warning_modal.setContent('Functionality available only for equipment in primary mode');
		warning_modal.addButton([
			{
				'type' : 'ok'
			}
		]);

		if(Main.isiDBlockNextSecondary()) {
			warning_modal.show();
		} else {
			md.setHTMLContent(modal_wiegandEdit);
		}
		if (osdp_info.osdp.enabled == '1') {
			md.getContent().find('#tab1_TS').removeClass('active');
			md.getContent().find('#tab2_TS').addClass('active');
			md.getContent().find('#configurations2TS').parent().addClass('active');
			md.getContent().find('#configurationsTS').hide();
			md.getContent().find('#diagnosticsTS').hide();
			md.getContent().find('#configurations3TS').hide();
		} else {
			md.getContent().find('#configurationsTS').parent().addClass('active');
		}
	}

	function disable_OSDP(returnMessage) {
		let data = MessengerUtil.send('set_configuration', {
			'osdp': {
				'enabled': '0'
			}
		});

		drawRelaysMenu();
		var rebootAlert = new Modal();
		rebootAlert.setTitle('OSDP Settings');
		rebootAlert.setContent('Rebooting device');
		rebootAlert.show();
		setTimeout(function() {
			var time = 60;
			MessengerUtil.sendAsync('reboot', null, null, false);
			Main.sessionFail({error: 'customError'}, function(){
				setInterval(function(){
					time--;
					if(time == 0)
						window.location = 'login.html';
					$('#countReboot').html(('00' + time).slice(-2));
				}, 1000);

			}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
		}, 10000);
		return returnMessage(data.error != undefined ? data.error : null);
	}

	function updateWiegand() {
		wiegandLength = parseInt(document.getElementById("wiegand-length").value, 10);

		facilityCodeStart = parseInt(document.getElementById("facility-bits-start").value, 10);
		facilityCodeLength = parseInt(document.getElementById("facility-bits").value, 10);
		invertedFacility = document.getElementById("chkInvertFacility").checked ? '1' : '0';
	
		cardNumberStartBit = parseInt(document.getElementById("card-number-bits-start").value, 10);
		cardNumberLength = parseInt(document.getElementById("card-number-bits").value, 10);
		invertedCard = document.getElementById("chkInvertCard").checked ? '1' : '0';

		issueCodeStartBit = parseInt(document.getElementById("issue-code-bits-start").value, 10);
		issueCodeLength = parseInt(document.getElementById("issue-code-bits").value, 10);

		evenParity1 =  parseInt(document.getElementById('even-parity-bit-1').value, 10);
		evenParity2 =  parseInt(document.getElementById('even-parity-bit-2').value, 10);
		oddParity1 =  parseInt(document.getElementById('odd-parity-bit-1').value, 10);
		oddParity2 =  parseInt(document.getElementById('odd-parity-bit-2').value, 10);

		evenParitySum1 =  document.getElementById('even-parity-sum-bits-1').value;
		evenParitySum2 =  document.getElementById('even-parity-sum-bits-2').value;
		oddParitySum1 =  document.getElementById('odd-parity-sum-bits-1').value;
		oddParitySum2 =  document.getElementById('odd-parity-sum-bits-2').value;

		parityBitOrder = document.getElementById('parity-bit-order').value;

		const parities = [evenParity1, evenParity2, oddParity1, oddParity2];
		let parityLength = parities.filter(parity => parity > 0).length;

		if (wiegandLength < 26) {
			alert('Less than 26 bit is not allowed')
			return
		} else if(wiegandLength > 64){
			alert('Less than 66 bit is not allowed')
			return
		} else if(facilityCodeStart < 0 || facilityCodeLength < 0){
			alert('Facility code less than zero is not allowed')
			return
		} else if(cardNumberStartBit < 0 || cardNumberLength <= 0){
			alert('Card numbers less than or equal to zero are not allowed')
			return
		}

		if(wiegandLength < facilityCodeLength + cardNumberLength + parityLength){
			alert('The sum of the facility code plus card number plus parity cannot be less than the number of bits added')
			return
		} else if(facilityCodeStart > cardNumberStartBit){
			alert('The Facility code must appear before the card number')
			return
		} else if(facilityCodeStart + facilityCodeLength > cardNumberStartBit){
			alert('The Facility code cannot override the card number')
			return
		} else if(evenParity1 > wiegandLength || evenParity2 > wiegandLength) {
			alert('The even parity bit cannot be greater than the number of bits')
			return
		} else if(oddParity1 > wiegandLength || oddParity2 > wiegandLength) {
			alert('The odd parity bit cannot be greater than the number of bits')
			return
		} else if(facilityCodeStart != 0 && ((evenParity1 > facilityCodeStart && evenParity1 < (cardNumberStartBit + cardNumberLength)) ||
											 (evenParity2 > facilityCodeStart && evenParity2 < (cardNumberStartBit + cardNumberLength)))) {
			alert('The even parity bit cannot be between the card number and the facility code')
			return
		} else if(facilityCodeStart == 0 && ((evenParity1 > cardNumberStartBit && evenParity1 < (cardNumberStartBit + cardNumberLength)) ||
											 (evenParity2 > cardNumberStartBit && evenParity2 < (cardNumberStartBit + cardNumberLength)))) {
			alert('The even parity bit cannot be between the card number')
			return
		} else if(facilityCodeStart != 0 && ((oddParity1 > facilityCodeStart && oddParity1 < (cardNumberStartBit + cardNumberLength)) ||
											 (oddParity2 > facilityCodeStart && oddParity2 < (cardNumberStartBit + cardNumberLength)))) {
			alert('The odd parity bit cannot be between the card number and the facility code')
			return
		} else if(facilityCodeStart == 0 && ((oddParity1 > cardNumberStartBit && oddParity1 < (cardNumberStartBit + cardNumberLength)) ||
											 (oddParity2 > cardNumberStartBit && oddParity2 < (cardNumberStartBit + cardNumberLength)))) {
			alert('The odd parity bit cannot be between the card number')
			return
		}

		updateShowAutomaticFields(facilityCodeStart, facilityCodeLength, cardNumberStartBit, cardNumberLength, issueCodeStartBit, issueCodeLength, 
			evenParity1, evenParity2, oddParity1, oddParity2, evenParitySum1, evenParitySum2, oddParitySum1, oddParitySum2, wiegandLength, parityBitOrder);

		updateShowBits(facilityCodeStart, facilityCodeLength, cardNumberStartBit, cardNumberLength, issueCodeStartBit, issueCodeLength, evenParity1, 
			evenParity2, oddParity1, oddParity2, invertedFacility, invertedCard, wiegandLength, '')
	}

	function updateEvenParityNumSelection(selection){
		if(selection == 0 && parseInt(md.getContent().find('#selectOddParityNumOfBits').val()) == 0) {
			md.getContent().find('#parity-calculation-order').hide();
			md.getContent().find('#parity-calculation-order-line').hide();
			md.getContent().find('#parity-calculation-order-label').hide();
			md.getContent().find('#parity-calculation-order-manual').hide();
		}

		switch (selection) {
			case 0:
				md.getContent().find('#has_even_parity_bit_line').hide();
				md.getContent().find('#has_even_parity_bit_label').hide();
				md.getContent().find('#has_even_parity_bit').hide();
				md.getContent().find('#has_even_parity_bit_sum').hide();
				md.getContent().find('#has_even_parity_bit_2').hide();
				md.getContent().find('#has_even_parity_bit_sum_2').hide();
				document.getElementById('even-parity-bit-1').value = 0
				document.getElementById('even-parity-bit-2').value = 0
				document.getElementById('even-parity-sum-bits-1').value = ""
				document.getElementById('even-parity-sum-bits-2').value = ""
				document.getElementById('parity-bit-order').value = ""
				break;
			case 1:
				md.getContent().find('#has_even_parity_bit_line').show();
				md.getContent().find('#has_even_parity_bit_label').show();
				md.getContent().find('#has_even_parity_bit').show();
				md.getContent().find('#has_even_parity_bit_sum').show();
				md.getContent().find('#has_even_parity_bit_2').hide();
				md.getContent().find('#has_even_parity_bit_sum_2').hide();
				document.getElementById('even-parity-bit-1').value = 0
				document.getElementById('even-parity-bit-2').value = 0
				document.getElementById('even-parity-sum-bits-1').value = ""
				document.getElementById('even-parity-sum-bits-2').value = ""
				document.getElementById('parity-bit-order').value = ""
				md.getContent().find('#parity-calculation-order-line').hide();
				md.getContent().find('#parity-calculation-order-label').hide();
				md.getContent().find('#parity-calculation-order-manual').hide();
				break;
			case 2:
				md.getContent().find('#has_even_parity_bit_line').show();
				md.getContent().find('#has_even_parity_bit_label').show();
				md.getContent().find('#has_even_parity_bit').show();
				md.getContent().find('#has_even_parity_bit_sum').show();
				md.getContent().find('#has_even_parity_bit_2').show();
				md.getContent().find('#has_even_parity_bit_sum_2').show();
				document.getElementById('even-parity-bit-2').value = 0
				document.getElementById('even-parity-sum-bits-2').value = ""
				document.getElementById('parity-bit-order').value = ""
				break;
			default:
				md.getContent().find('#has_even_parity_bit_line').hide();
				md.getContent().find('#has_even_parity_bit_label').hide();
				md.getContent().find('#has_even_parity_bit').hide();
				md.getContent().find('#has_even_parity_bit_sum').hide();
				md.getContent().find('#has_even_parity_bit_2').hide();
				md.getContent().find('#has_even_parity_bit_sum_2').hide();
				break;
		}
	}

	function updateOddParityNumSelection(selection){
		if(selection == 0 && parseInt(md.getContent().find('#selectEvenParityNumOfBits').val()) == 0) {
			md.getContent().find('#parity-calculation-order').hide();
			md.getContent().find('#parity-calculation-order-line').hide();
			md.getContent().find('#parity-calculation-order-label').hide();
			md.getContent().find('#parity-calculation-order-manual').hide();
		}

		switch (selection) {
			case 0:
				md.getContent().find('#has_odd_parity_bit_line').hide();
				md.getContent().find('#has_odd_parity_bit_label').hide();
				md.getContent().find('#has_odd_parity_bit').hide();
				md.getContent().find('#has_odd_parity_bit_sum').hide();
				md.getContent().find('#has_odd_parity_bit_2').hide();
				md.getContent().find('#has_odd_parity_bit_sum_2').hide();
				document.getElementById('odd-parity-bit-1').value = 0
				document.getElementById('odd-parity-bit-2').value = 0
				document.getElementById('odd-parity-sum-bits-1').value = ""
				document.getElementById('odd-parity-sum-bits-2').value = ""
				document.getElementById('parity-bit-order').value = ""
				break;
			case 1:
				md.getContent().find('#has_odd_parity_bit_line').show();
				md.getContent().find('#has_odd_parity_bit_label').show();
				md.getContent().find('#has_odd_parity_bit').show();
				md.getContent().find('#has_odd_parity_bit_sum').show();
				md.getContent().find('#has_odd_parity_bit_2').hide();
				md.getContent().find('#has_odd_parity_bit_sum_2').hide();
				document.getElementById('odd-parity-bit-2').value = 0
				document.getElementById('odd-parity-sum-bits-2').value = ""
				document.getElementById('parity-bit-order').value = ""
				break;
			case 2:
				md.getContent().find('#has_odd_parity_bit_line').show();
				md.getContent().find('#has_odd_parity_bit_label').show();
				md.getContent().find('#has_odd_parity_bit').show();
				md.getContent().find('#has_odd_parity_bit_sum').show();
				md.getContent().find('#has_odd_parity_bit_2').show();
				md.getContent().find('#has_odd_parity_bit_sum_2').show();
				break;
			default:
				md.getContent().find('#has_odd_parity_bit_line').hide();
				md.getContent().find('#has_odd_parity_bit_label').hide();
				md.getContent().find('#has_odd_parity_bit').hide();
				md.getContent().find('#has_odd_parity_bit_sum').hide();
				md.getContent().find('#has_odd_parity_bit_2').hide();
				md.getContent().find('#has_odd_parity_bit_sum_2').hide();
				break;
		}
	}

	function isAscendingOrder(input) {
		const numbers = input.split(",").map(num => parseInt(num.trim(), 10));
		
		for (let i = 0; i < numbers.length - 1; i++) {
			if (numbers[i] >= numbers[i + 1]) {
			return false;
			}
		}
		return true;
	}

	function updateShowAutomaticFields(facilityStart, facilityLength, cardStart, cardLength, issueStart, issueLength, 
		evenParity1, evenParity2, oddParity1, oddParity2, evenParitySum1, evenParitySum2, oddParitySum1, oddParitySum2, wiegandLength, parityBitOrder) {

		document.getElementById('facility-bits-start').value = facilityStart;
		document.getElementById('facility-bits').value = facilityLength;
		document.getElementById('card-number-bits-start').value = cardStart;
		document.getElementById('card-number-bits').value = cardLength;
		document.getElementById('issue-code-bits-start').value = issueStart;
		document.getElementById('issue-code-bits').value = issueLength;
		document.getElementById('wiegand-length').value = wiegandLength;

		if(issueLength == 0){
			md.getContent().find('#issue-code-text').hide()
			md.getContent().find('#issue-code-line').hide()
			md.getContent().find('#issue-code-label').hide()
			md.getContent().find('#issue-code-configuration').hide()
		} else {
			md.getContent().find('#issue-code-text').show()
			md.getContent().find('#issue-code-line').show()
			md.getContent().find('#issue-code-label').show()
			md.getContent().find('#issue-code-configuration').show()
		}

		if(wiegandLength != 0) {
			if(evenParity1 == 0){
				md.getContent().find('#has_even_parity_bit_line').hide()
				md.getContent().find('#has_even_parity_bit_label').hide()
				md.getContent().find('#has_even_parity_bit').hide()
				md.getContent().find('#has_even_parity_bit_sum').hide()
			} else {
				md.getContent().find('#has_even_parity_bit_line').show()
				md.getContent().find('#has_even_parity_bit_label').show()
				md.getContent().find('#has_even_parity_bit').show()
				md.getContent().find('#has_even_parity_bit_sum').show()
			}

			if(oddParity1 == 0){
				md.getContent().find('#has_odd_parity_bit_line').hide()
				md.getContent().find('#has_odd_parity_bit_label').hide()
				md.getContent().find('#has_odd_parity_bit').hide()
				md.getContent().find('#has_odd_parity_bit_sum').hide()
			} else {
				md.getContent().find('#has_odd_parity_bit_line').show()
				md.getContent().find('#has_odd_parity_bit_label').show()
				md.getContent().find('#has_odd_parity_bit').show()
				md.getContent().find('#has_odd_parity_bit_sum').show()
			}
	
			if(evenParity2 == 0){
				md.getContent().find('#has_even_parity_bit_2').hide()
				md.getContent().find('#has_even_parity_bit_sum_2').hide()
			} else {
				md.getContent().find('#has_even_parity_bit_2').show()
				md.getContent().find('#has_even_parity_bit_sum_2').show()
			}
	
			if(oddParity2 == 0){
				md.getContent().find('#has_odd_parity_bit_2').hide()
				md.getContent().find('#has_odd_parity_bit_sum_2').hide()
			} else {
				md.getContent().find('#has_odd_parity_bit_2').show()
				md.getContent().find('#has_odd_parity_bit_sum_2').show()
			}

			var evenSum = evenParity1 != 0 ? 1 : 0
			evenSum = evenParity2 != 0 ? evenSum + 1 : evenSum
			
			var oddSum = oddParity1 != 0 ? 1 : 0
			oddSum = oddParity2 != 0 ? oddSum + 1 : oddSum

			md.getContent().find('#selectEvenParityNumOfBits').val(evenSum).change();
			md.getContent().find('#selectOddParityNumOfBits').val(oddSum).change();

			updateEvenParityNumSelection(evenSum)
			updateOddParityNumSelection(oddSum)

			if(evenSum + oddSum != 0) {
				if(!md.getContent().find('#chkWiegandBitsMode').is(':checked'))
					md.getContent().find('#parity-calculation-order').show();
				md.getContent().find('#parity-calculation-order-line').show();
				md.getContent().find('#parity-calculation-order-label').show();
				md.getContent().find('#parity-calculation-order-manual').show();
				md.getContent().find('#parity-bit-order').prop('disabled', parseInt(md.getContent().find('#selectParityCalculationOrder').val()) == "0");
			} else {
				md.getContent().find('#parity-calculation-order').hide();
				md.getContent().find('#parity-calculation-order-line').hide();
				md.getContent().find('#parity-calculation-order-label').hide();
				md.getContent().find('#parity-calculation-order-manual').hide();
			}
		} else {
			md.getContent().find('#has_even_parity_bit_line').show()
			md.getContent().find('#has_even_parity_bit_label').show()
			md.getContent().find('#has_even_parity_bit').show()
			md.getContent().find('#has_even_parity_bit_sum').show()
			md.getContent().find('#has_odd_parity_bit_line').show()
			md.getContent().find('#has_odd_parity_bit_label').show()
			md.getContent().find('#has_odd_parity_bit').show()
			md.getContent().find('#has_odd_parity_bit_sum').show()

			md.getContent().find('#selectEvenParityNumOfBits').val(0).change();
			md.getContent().find('#selectOddParityNumOfBits').val(0).change();
			updateEvenParityNumSelection(0)
			updateOddParityNumSelection(0)
			md.getContent().find('#parity-calculation-order').hide();
			md.getContent().find('#selectParityCalculationOrder').val("0").change();
			md.getContent().find('#parity-calculation-order-manual').hide();
			md.getContent().find('#parity-bit-order').prop('disabled', true);
		}

		document.getElementById('even-parity-bit-1').value = evenParity1
		document.getElementById('even-parity-bit-2').value = evenParity2
		document.getElementById('odd-parity-bit-1').value = oddParity1
		document.getElementById('odd-parity-bit-2').value = oddParity2
		document.getElementById('even-parity-sum-bits-1').value = evenParitySum1
		document.getElementById('even-parity-sum-bits-2').value = evenParitySum2
		document.getElementById('odd-parity-sum-bits-1').value = oddParitySum1
		document.getElementById('odd-parity-sum-bits-2').value = oddParitySum2
		document.getElementById('parity-bit-order').value = parityBitOrder

		if(!md.getContent().find('#chkWiegandBitsMode').is(':checked')) {
			if(isAscendingOrder(parityBitOrder)) {
				md.getContent().find('#selectParityCalculationOrder').val("0").change();
				md.getContent().find('#parity-bit-order').prop('disabled', true);
			} else {
				md.getContent().find('#selectParityCalculationOrder').val("1").change();
				md.getContent().find('#parity-bit-order').prop('disabled', false);
			}
		}
	}

	function updateShowBits(facilityCodeStart, facilityCodeLength, cardNumberStartBit, cardNumberLength, issueCodeStartBit, issueCodeLength,
		 evenParity1, evenParity2, oddParity1, oddParity2, invertedFacility, invertedCard, wiegandLength, cardValue) {

		var wiegandDisplay = cardValue != '' ? document.getElementById("wiegand-display-diagnostic") : document.getElementById("wiegand-display");
		wiegandDisplay.innerHTML = "";

		// Generate bits
		let i = 1;
		let facilityCount = 1;
		let cardNumberCount = 1;
		let issueCodeCount = 1;
		let binaryIssueCode = (md.getContent().find('#inputDefaultIssueCode')[0].value >>> 0).toString(2).padStart(issueCodeLength, '0');
		if(cardValue != '' && wiegandLength == 64){
			cardValue = cardValue + binaryIssueCode
		}

		for (i; i <= wiegandLength; i++) {
			const bitContainer = document.createElement("div");
			bitContainer.classList.add("bit-container");

			const bitCountElement = document.createElement("div");
			bitCountElement.classList.add("bit-count");
			bitCountElement.textContent = i;

			const bitElement = document.createElement("div");
			bitElement.classList.add("bit");

			if (i >= facilityCodeStart && facilityCount <= facilityCodeLength) {
				bitElement.classList.add("facility");
				if (invertedFacility == '1') {
					bitElement.textContent = cardValue != '' ? cardValue[i - 1] : (facilityCodeLength - facilityCount + 1);
				} else {
					bitElement.textContent = cardValue != '' ? cardValue[i - 1] : facilityCount;
				}
				facilityCount++;
			} else if (i >= cardNumberStartBit && cardNumberCount <= cardNumberLength) {
				bitElement.classList.add("card-number");
				if (invertedCard == '1') {
					bitElement.textContent = cardValue != '' ? cardValue[i - 1] : (cardNumberLength - cardNumberCount + 1);
				} else {
					bitElement.textContent = cardValue != '' ? cardValue[i - 1] : cardNumberCount;
				}
				cardNumberCount++;
			} else if (i >= issueCodeStartBit && issueCodeCount <= issueCodeLength) {
				bitElement.classList.add("issue-code");
				bitElement.textContent = cardValue != '' ? cardValue[i - 1] : issueCodeCount;
				issueCodeCount++;
			} else if (i == evenParity1 || i == evenParity2) {
				bitElement.classList.add("parity-even");
				bitElement.textContent = cardValue != '' ? cardValue[i - 1] : i;
			} else if (i == oddParity1 || i == oddParity2) {
				bitElement.classList.add("parity-odd");
				bitElement.textContent = cardValue != '' ? cardValue[i - 1] : i;
			} else {
				bitElement.textContent = cardValue != '' ? cardValue[i - 1] : i;
			}

			bitContainer.appendChild(bitCountElement);
			bitContainer.appendChild(bitElement);
		
			wiegandDisplay.appendChild(bitContainer);
		}
	}

	function parseParitySum(paritySum) {
		const numbers = paritySum.split(",").map(num => parseInt(num.trim(), 10)).sort((a, b) => a - b);
		
		let ranges = [];
		let start = numbers[0];
		let end = numbers[0];
		
		for (let i = 1; i < numbers.length; i++) {
			if (numbers[i] === end + 1) {
			end = numbers[i];
			} else {
			ranges.push(`${start}:${end}`);
			start = numbers[i];
			end = numbers[i];
			}
		}
		
		ranges.push(`${start}:${end}`);

		return ranges.join(", ");
	}

	function generatePermutations(array) {
		if (!Array.isArray(array)) {
			return [];
		}

		if (array.length === 0) {
			return [];
		}

		var result = [];
		for (var i = 0; i < array.length; i++) {
			var current = array[i];
			var remaining = array.slice(0, i).concat(array.slice(i + 1));
			var subPermutations = generatePermutations(remaining);
			
			for (var j = 0; j < subPermutations.length; j++) {
				result.push([current].concat(subPermutations[j]));
			}
		}
		return result;
	}
	
	function sanityCheckParity() {
		var parityValues = [evenParity1, evenParity2, oddParity1, oddParity2].filter(value => value !== 0);
		
		if (parityValues.length === 0) return false;
	
		if (parseInt(md.getContent().find('#selectParityCalculationOrder').val()) === 0) {
			parityValues.sort(function(a, b) { return a - b; });
			currentValue = parityValues.join(",");
		} else {
			currentValue = document.getElementById('parity-bit-order').value.trim();
		}

		let permutations = [parityValues];
		for(let i = 0; i < parityValues.length - 1; i++) {
			let len = permutations.length;
			for(let j = 0; j < len; j++) {
				for(let k = i + 1; k < parityValues.length; k++) {
					let newPerm = [...permutations[j]];
					[newPerm[i], newPerm[k]] = [newPerm[k], newPerm[i]];
					permutations.push(newPerm);
				}
			}
		}
		
		return [permutations.some(perm => perm.join(",") === String(currentValue)), currentValue]
	}

	function sanityCheckParitySum() {
		if ((evenParity1 != 0 && evenParitySum1 == "") || (evenParity2 != 0 && evenParitySum2 == "") ||
			(oddParity1 != 0 && oddParitySum1 == "") || (oddParity2 != 0 && oddParitySum2 == "")){
				return false
			}
		return true
	}

	function save_custom_data() {
		updateWiegand()
		const facilityField = `F[${facilityCodeStart}:${facilityCodeStart + facilityCodeLength - 1}]`;
		const cardField = `C[${cardNumberStartBit}:${cardNumberStartBit + cardNumberLength - 1}]`;
		const format = `${facilityField}, ${cardField}`;
	
		var parities = ""
		var evenParity1String = ""

		if(!sanityCheckParitySum()) {
			return [false, 'When adding parity, it is necessary to inform the bits to be added' ]
		}
		
		var evenParity1String = evenParity1 != 0 ? `E(${evenParity1})[${parseParitySum(evenParitySum1)}]` : "";
		var oddParity1String = oddParity1 != 0 ? `O(${oddParity1})[${parseParitySum(oddParitySum1)}]` : "";
		var evenParity2String = evenParity2 != 0 ? `E(${evenParity2})[${parseParitySum(evenParitySum2)}]` : "";
		var oddParity2String = oddParity2 != 0 ? `O(${oddParity2})[${parseParitySum(oddParitySum2)}]` : "";

		if (evenParity1String !== "") {
			parities += evenParity1String;
		  }
		  if (evenParity2String !== "") {
			parities += (parities ? ", " : "") + evenParity2String;
		  }
		  if (oddParity1String !== "") {
			parities += (parities ? ", " : "") + oddParity1String;
		  }
		  if (oddParity2String !== "") {
			parities += (parities ? ", " : "") + oddParity2String;
		  }

		var parityOrderElement  = sanityCheckParity();

		if(parities != "" && !parityOrderElement[0]) {
			return [false , 'Review the bit order of the parity calculation, if you do not know how to use it, leave it in manual mode']
		}

		MessengerUtil.send('modify_objects', {
			"object": "wiegand_modes",
			"values": {
				"size": wiegandLength,
				"format": format,
				"parities": parities,
				"inverted_facility": md.getContent().find('#chkInvertFacility').is(':checked') ? 1 : 0,
				"parities_calculation_order": parityOrderElement[1],
				"inverted_card": md.getContent().find('#chkInvertCard').is(':checked') ? 1 : 0
			},
			"where": {
				"wiegand_modes": {
					"id": 1
				}
			}
		})

		return [true,""]
	}

	var checkWiegandEvent;
	clearInterval(checkWiegandEvent);

	function cancel(returnMessage) {
		clearInterval(checkWiegandEvent);
		md.close()
	}

	function save(returnMessage) {
		let maxIssueCodeValue = Math.pow(2, issueCodeLength)
		if(issueCodeLength != 0 && (md.getContent().find('#inputDefaultIssueCode')[0].value >= maxIssueCodeValue ||
			md.getContent().find('#inputBiometricMismatchIssueCode')[0].value >= maxIssueCodeValue)) {
			return returnMessage("Issue code nao pode ter um valor maior ou igual ao configurado: " + maxIssueCodeValue);
		}
		clearInterval(checkWiegandEvent);

		if(md.getContent().find('#inputReaderFeedbackTimeout')[0].value < 1000 && 
												md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().hasClass('switch-on')){
			returnMessage('Minimum waiting time must be 1000 ms');
			return;
		}

		var outMode = '';

		if (md.getContent().find('#card_outmode').is(':checked')) {
			outMode = 'CARD';
		}
		if (md.getContent().find('#relay_card_outmode').is(':checked')) {
			if (md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().hasClass('switch-on')) {
				outMode = 'RELAY_CARD_WITH_READER_FEEDBACK';
			} else {
				outMode = 'RELAY_CARD';
			}
		}
		if (md.getContent().find('#users_card_outmode').is(':checked')) {
			outMode = 'USERS_CARD';
		}

		var isPassthroughMode =
			(outMode === 'RELAY_CARD' || outMode === 'RELAY_CARD_WITH_READER_FEEDBACK');

		md.getContent()
			.find('#wiegandSizeTitle')
			.text(isPassthroughMode ? 'Formato de face:' : 'Tamanho wiegand:');

		var pin_mode = '';
		var pin_format = '';
		if (md.getContent().find('#standalone_mode').is(':checked')) pin_mode = 'standalone';
		if (md.getContent().find('#buffered_mode').is(':checked')) pin_mode = 'buffered';
		if (md.getContent().find('#pinoncard_mode').is(':checked')) pin_mode = 'pinoncard';

		if (md.getContent().find('#standard_format').is(':checked')) pin_format = 'standard';
		if (md.getContent().find('#dorado_format').is(':checked')) pin_format = 'dorado';
		if (md.getContent().find('#ascii_format').is(':checked')) pin_format = 'ascii';

		var new_format_wiegand_mode = md.getContent().find('#chkWiegandBitsMode').is(':checked') ? md.getContent().find('#selectWiegandFormat').val() : "custom"

		if(!md.getContent().find('#chkWiegandBitsMode').is(':checked')){
			var save_return = save_custom_data()
			if(!save_return[0])
				return returnMessage(save_return[1])
		} 

		var isPassthroughMode =
			(outMode === 'RELAY_CARD' || outMode === 'RELAY_CARD_WITH_READER_FEEDBACK');

		var configToSave = {
			sec_box: {
				out_mode: outMode,
				wiegand_out_size: new_format_wiegand_mode,
				face_passthrough_source: md.getContent().find('#user_card_data_source').is(':checked') ? 'USER_CARD' : 'USER_ID',
				face_passthrough_no_card_send_code: md.getContent().find('#chkNoCardSendDeniedCode').parent().hasClass('switch-on') ? '1' : '0'
			},
			general: {
				denied_transaction_code: md.getContent().find('#inputDeniedTransactionCode')[0].value,
				send_code_when_not_identified: md.getContent().find('#chkNotIdentified').parent().hasClass('switch-on') ? '1' : '0',
				send_code_when_not_authorized: md.getContent().find('#chkNotAuthorized').parent().hasClass('switch-on') ? '1' : '0',
				reader_feedback_timeout: md.getContent().find('#inputReaderFeedbackTimeout')[0].value,
				pin_max_size: md.getContent().find('#inputMaxSizePin')[0].value,
				pin_passthrough_mode: pin_mode,
				pin_passthrough_format: pin_format,
				pin_with_parity: md.getContent().find('#chkWithParity').parent().hasClass('switch-on') ? '1' : '0'
			},
			hid_reader: {
				format_wiegand: '1',
			},
			osdp: {
				wiegand_size: new_format_wiegand_mode,
			},
			wiegand: {
				wiegand_format_size: new_format_wiegand_mode,
				default_issue_code: md.getContent().find('#inputDefaultIssueCode')[0].value,
				biometric_mismatch_issue_code: md.getContent().find('#inputBiometricMismatchIssueCode')[0].value
			},
		};

		if (isPassthroughMode) {
			configToSave.sec_box.face_bypass_format = new_format_wiegand_mode;
		}

		var data = MessengerUtil.send('set_configuration', configToSave);

		drawRelaysMenu();
		return returnMessage(data.error != undefined ? data.error : null);
	}

	if(!Main.isiDBlockNextSecondary()) {
		md.show(function () {
			var data = MessengerUtil.send('get_configuration', {
				sec_box: [
					'mode',
					'out_mode',
					'face_passthrough_source',
					'face_passthrough_no_card_send_code'
				],
				general : [
					'denied_transaction_code',
					'send_code_when_not_identified',
					'send_code_when_not_authorized',
					'reader_feedback_timeout',
					'pin_max_size',
					'pin_passthrough_mode',
					'pin_passthrough_format',
					'pin_with_parity'
				],
				wiegand: [
					'wiegand_format_size',
					'default_issue_code',
					'biometric_mismatch_issue_code'
				],
			});

			var isPassthroughMode =
			(data.sec_box.out_mode === 'RELAY_CARD' || data.sec_box.out_mode === 'RELAY_CARD_WITH_READER_FEEDBACK');

		md.getContent()
			.find('#wiegandSizeTitle')
			.text(isPassthroughMode ?
				'Face format:' : 'Wiegand size:');

		md.getContent().find('#chkNotIdentified').parent().bootstrapSwitch();
			md.getContent().find('#chkNotAuthorized').parent().bootstrapSwitch();
			md.getContent().find('#chkNoCardSendDeniedCode').parent().bootstrapSwitch();
			md.getContent().find('#chkWiegandBitsMode').parent().bootstrapSwitch();
			md.getContent().find('#chkInvertFacility').parent().bootstrapSwitch();
			md.getContent().find('#chkInvertCard').parent().bootstrapSwitch();
			md.getContent().find('#chkWithParity').parent().bootstrapSwitch();
			md.getContent().find('#chkWithParity').parent().bootstrapSwitch('setState', data.general.pin_with_parity === '1');
			md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().bootstrapSwitch();
			md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().bootstrapSwitch('setState', data.sec_box.out_mode === 'RELAY_CARD_WITH_READER_FEEDBACK');

			if (md.getContent().find('#chkWiegandBitsMode').is(':checked')) {
				md.getContent().find('#wiegandManualConfiguration').hide()
				md.getContent().find('#wiegandManual').hide()
				md.getContent().find('#wiegandAutomatic').show()
			} else {
				md.getContent().find('#wiegandManualConfiguration').show()
				md.getContent().find('#wiegandManual').show()
				md.getContent().find('#wiegandAutomatic').hide()
			}

			switch (data.sec_box.out_mode) {
				case "CARD":
					md.getContent().find('#card_outmode').attr('checked', 'checked');
					md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().bootstrapSwitch('setState', false);
					break;
				case "RELAY_CARD":
					md.getContent().find('#relay_card_outmode').attr('checked', 'checked');
					md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().bootstrapSwitch('setState', false);
					break;
				case "USERS_CARD":
					md.getContent().find('#users_card_outmode').attr('checked', 'checked');
					md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().bootstrapSwitch('setState', false);
					break;
				case "RELAY_CARD_WITH_READER_FEEDBACK":
					md.getContent().find('#relay_card_outmode').attr('checked', 'checked');
					md.getContent().find('#user_id_data_source').attr('checked', 'checked');
					md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().bootstrapSwitch('setState', true);
					break;
				default:
					md.getContent().find('#id_outmode').attr('checked', 'checked');
					md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().bootstrapSwitch('setState', false);
			}

			var faceSource = data.sec_box.face_passthrough_source || 'USER_CARD';
			if (faceSource === 'USER_ID') {
				md.getContent().find('#user_id_data_source').attr('checked', 'checked');
				md.getContent().find('#face_no_card_send_code_group').hide();
			} else {
				md.getContent().find('#user_card_data_source').attr('checked', 'checked');
				md.getContent().find('#face_no_card_send_code_group').show();
			}
			md.getContent().find('#chkNoCardSendDeniedCode').parent().bootstrapSwitch('setState', data.sec_box.face_passthrough_no_card_send_code === '1');

			md.getContent().find('input[name="face_data_source"]').change(function() {
				if (md.getContent().find('#user_card_data_source').is(':checked')) {
					md.getContent().find('#face_no_card_send_code_group').show();
				} else {
					md.getContent().find('#face_no_card_send_code_group').hide();
				}
			});

			switch (data.general.pin_passthrough_mode) {
			case "standalone":
				md.getContent().find('#standalone_mode').attr('checked', 'checked');
				break;
			case "buffered":
				md.getContent().find('#dorado_format').prop('disabled', true);
				md.getContent().find('#buffered_mode').attr('checked', 'checked');
				break;
			case "pinoncard":
				md.getContent().find('#pinoncard_mode').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#standalone_mode').attr('checked', 'checked');
				break;
			}

			switch (data.general.pin_passthrough_format) {
				case "standard":
					md.getContent().find('#standard_format').attr('checked', 'checked');
					break;
				case "dorado":
					md.getContent().find('#dorado_format').attr('checked', 'checked');
					break;
				case "ascii":
					md.getContent().find('#ascii_format').attr('checked', 'checked');
					break;
				default:
					md.getContent().find('#standard_format').attr('checked', 'checked');
					break;
			}
			md.getContent().find('#inputMaxSizePin')[0].value = data.general.pin_max_size;
			md.getContent().find('#var_max_size')[0].value = md.getContent().find('#inputMaxSizePin')[0].value;

			const wiegand_sizes = [	
				"custom",
				"26",
				"32",
				"34",
				"35",
				"37(H10302)",
				"37(H10304)",
				"40",
				"42",
				"48",
				"56",
				"64",
				"66"
			]

			if(!wiegand_sizes.includes(data.wiegand.wiegand_format_size)){
				data.wiegand.wiegand_format_size = "26"
			}

			md.getContent().find('#inputDeniedTransactionCode')[0].value = data.general.denied_transaction_code;
			md.getContent().find('#chkNotIdentified').parent().bootstrapSwitch('setState', data.general.send_code_when_not_identified != "0");
			md.getContent().find('#chkNotAuthorized').parent().bootstrapSwitch('setState', data.general.send_code_when_not_authorized != "0");
			md.getContent().find('#chkWiegandBitsMode').parent().bootstrapSwitch('setState', data.wiegand.wiegand_format_size != "custom" ? true : false);
	
		var selectorValue = isPassthroughMode
			? (data.sec_box.face_bypass_format || data.wiegand.wiegand_format_size)
			: data.wiegand.wiegand_format_size;

		md.getContent()
			.find('#selectWiegandFormat')
			.val(selectorValue)
			.change();
	
		md.getContent().find('#inputDefaultIssueCode')[0].value = data.wiegand.default_issue_code;
			md.getContent().find('#inputBiometricMismatchIssueCode')[0].value = data.wiegand.biometric_mismatch_issue_code;
			md.getContent().find('#inputReaderFeedbackTimeout')[0].value = data.general.reader_feedback_timeout;

			md.getContent().find('input[name="secbox-outmode"]').change(function() {
			if (md.getContent().find('#relay_card_outmode').is(':checked')) {
					md.getContent().find('#relay_card_with_reader_feedback_outmode_checkbox').show();
					md.getContent().find('#face_data_source').show();
			} else {
					md.getContent().find('#relay_card_with_reader_feedback_outmode_checkbox').hide();
					md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().bootstrapSwitch('setState', false);
					md.getContent().find('#inputReaderFeedbackTimeoutGroup').hide();
					md.getContent().find('#face_data_source').hide();
			}
			});

			md.getContent().find('input[name="pin-mode"]').change(function() {
				if (md.getContent().find('#buffered_mode').is(':checked')) {
					if (md.getContent().find('#dorado_format').is(':checked')) {
						md.getContent().find('#standard_format').attr('checked', 'checked');
					}
					md.getContent().find('#dorado_format').prop('disabled', true);
				} else {
					md.getContent().find('#dorado_format').prop('disabled', false);
				}
			});

			if (md.getContent().find('#relay_card_outmode').is(':checked')) {
					md.getContent().find('#relay_card_with_reader_feedback_outmode_checkbox').show();
					md.getContent().find('#face_data_source').show();
			} else {
					md.getContent().find('#relay_card_with_reader_feedback_outmode_checkbox').hide();
					md.getContent().find('#relay_card_with_reader_feedback_outmode').parent().bootstrapSwitch('setState', false);
					md.getContent().find('#inputReaderFeedbackTimeoutGroup').hide();
					md.getContent().find('#face_data_source').hide();
			}

			md.getContent().find('#relay_card_with_reader_feedback_outmode').change(function() {
			if (md.getContent().find('#relay_card_with_reader_feedback_outmode').is(':checked')) {
					md.getContent().find('#inputReaderFeedbackTimeoutGroup').show();
			} else {
					md.getContent().find('#inputReaderFeedbackTimeoutGroup').hide();
			}
			});

			md.getContent().find('#relay_card_with_reader_feedback_outmode').is(':checked') ? md.getContent().find('#inputReaderFeedbackTimeoutGroup').show() :
																							md.getContent().find('#inputReaderFeedbackTimeoutGroup').hide();

			const all_wiegand_modes = MessengerUtil.send('load_objects', 
				{
					object: 'wiegand_modes', 
				}
			)

			function parse_card_read_info(wiegand_mode_to_show){
				const wiegand_info_for_mode = all_wiegand_modes.wiegand_modes.find(mode => mode.name === wiegand_mode_to_show);

				const countParityEvenFields = (parityString) => {
					return (parityString.match(/E/g) || []).length;
				};

				const countParityOddFields = (parityString) => {
					return (parityString.match(/O/g) || []).length;
				};

				const parseField = (field) => {
					const match = field.match(/\[(\d+):(\d+)\]/);
					if (match) {
						const start = parseInt(match[1], 10);
						const end = parseInt(match[2], 10);
						return { start, length: end - start + 1 };
					} else if (field.match(/\[(\d+)\]/)) {
						const bit = parseInt(field.match(/\[(\d+)\]/)[1], 10);
						return { start: bit, length: 1 };
					}
					return null;
				};

				function parseBitPattern(parityString) {
					// Initialize result objects
					const result = {
						evenParitiesPosition: [],
						evenParitiesSum: [],
						oddParitiesPosition: [],
						oddParitiesSum: []
					};
					
					// Clean up the input string and split into parts
					const cleanedString = parityString.replace(/\s+/g, ' ').trim();
					
					// Use regex to find all patterns
					const patternRegex = /([EO])\((\d+)\)\[([\d:,\s]+?)\]/g;
					let match;
					
					while ((match = patternRegex.exec(cleanedString)) !== null) {
						const [_, type, position, rangesStr] = match;
						
						// Process ranges
						const ranges = rangesStr.split(',').map(range => range.trim());
						const numbers = new Set();
						
						ranges.forEach(range => {
						const [start, end] = range.split(':').map(Number);
						for (let i = start; i <= end; i++) {
							numbers.add(i);
						}
						});
						
						const numbersArray = Array.from(numbers).sort((a, b) => a - b);
						const numbersString = numbersArray.join(',');
						
						if (type === 'E') {
							result.evenParitiesPosition.push(Number(position));
							result.evenParitiesSum.push(numbersString || '');
						} else {
							result.oddParitiesPosition.push(Number(position));
							result.oddParitiesSum.push(numbersString || '');
						}
					}

					if (!result.evenParitiesPosition.includes(0)) {
						result.evenParitiesPosition.push(0);
						result.evenParitiesSum.push('');
					}

					if (!result.oddParitiesPosition.includes(0)) {
						result.oddParitiesPosition.push(0);
						result.oddParitiesSum.push('');
					}

					return result;
				}

				const facilityField = wiegand_info_for_mode.format.match(/F\[\d+:\d+\]/);
				const cardField = wiegand_info_for_mode.format.match(/C\[\d+:\d+\]/);
				const issueField = wiegand_info_for_mode.format.match(/I\[\d+:\d+\]/);

				const facility = facilityField ? parseField(facilityField[0]) : null;
				const card = cardField ? parseField(cardField[0]) : null;
				const issue = issueField ? parseField(issueField[0]) : null;

				const result = parseBitPattern(wiegand_info_for_mode.parities);

				facilityCodeStart = facility ? facility.start : 0;
				facilityCodeLength = facility ? facility.length : 0;
				cardNumberStartBit = card ? card.start : 0;
				cardNumberLength = card ? card.length : 0;
				issueCodeStartBit = issue ? issue.start : 0;
				issueCodeLength = issue ? issue.length : 0;

				invertedFacility = wiegand_info_for_mode.inverted_facility;
				invertedCard = wiegand_info_for_mode.inverted_card;
				wiegandLength = wiegand_info_for_mode.size;

				evenParity1 = result.evenParitiesPosition[0] ? result.evenParitiesPosition[0] : 0;
				evenParity2 = result.evenParitiesPosition[1] ? result.evenParitiesPosition[1] : 0;
				oddParity1 = result.oddParitiesPosition[0] ? result.oddParitiesPosition[0] : 0;
				oddParity2 = result.oddParitiesPosition[1] ? result.oddParitiesPosition[1] : 0;

				evenParitySum1 = result.evenParitiesSum[0] ? result.evenParitiesSum[0] : "";
				evenParitySum2 = result.evenParitiesSum[1] ? result.evenParitiesSum[1] : "";
				oddParitySum1 = result.oddParitiesSum[0] ? result.oddParitiesSum[0] : "";
				oddParitySum2 = result.oddParitiesSum[1] ? result.oddParitiesSum[1] : "";

				parityBitOrder = wiegand_info_for_mode.parities_calculation_order

				md.getContent().find('#chkInvertFacility').parent().bootstrapSwitch('setState', invertedFacility != "0");
				md.getContent().find('#chkInvertCard').parent().bootstrapSwitch('setState', invertedCard != "0");

				updateShowAutomaticFields(facilityCodeStart, facilityCodeLength, cardNumberStartBit, cardNumberLength, issueCodeStartBit, issueCodeLength,
					evenParity1, evenParity2, oddParity1, oddParity2, evenParitySum1, evenParitySum2, oddParitySum1, oddParitySum2, wiegandLength, parityBitOrder);

				updateShowBits(facilityCodeStart, facilityCodeLength, cardNumberStartBit, cardNumberLength, issueCodeStartBit, issueCodeLength,
					evenParity1, evenParity2, oddParity1, oddParity2, invertedFacility, invertedCard, wiegandLength, '');
			}

			function formatLastReadTime(dateStr) {
				var dateTime = ""
				dateStr = dateStr.replace(/[\[\]]/g, "");
	
				const [year, month, dayAndTime] = dateStr.split("-");
				const [day, time] = dayAndTime.split("T");
	
				let [hours, minutes, seconds] = time.split(":");
	
				if(date_format_message == '1') {
					dateTime = `${month}/${day}/${year} ~ `
				} else {
					dateTime = `${day}/${month}/${year} ~ `
				}
				if(clock_format_message == '1'){
					let period = "am";
	
					hours = parseInt(hours, 10);
					if (hours >= 12) {
						period = "pm";
						if (hours > 12) hours -= 12;
					} else if (hours === 0) {
						hours = 12;
					}
					dateTime += `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${period}`;
				} else {
					dateTime += `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
				}
	
				return dateTime;
			}

			var wiegandEvent = function() {
				MessengerUtil.sendAsync('get_wiegand_card_read', {}, null, null, function(reply) {
					cardValue = reply.card_read_value
					bitsRead = reply.card_read_num_bits
					facilityRead = reply.facility_code
					cardIdRead = reply.card_number
					parities = reply.parities
					lastReadTime = reply.last_read_time
					document.getElementById('wiegand-read-total-bits-expected').value = wiegandLength;

					if(cardValue != ""){
						document.getElementById('wiegand-read-total-bits').value = bitsRead;
						document.getElementById('wiegand-read-facility').value = facilityRead;
						document.getElementById('wiegand-read-card-id').value = cardIdRead;
						document.getElementById('wiegand-read-time').value = formatLastReadTime(lastReadTime);

						if(evenParity1 != 0 || evenParity2 != 0 || oddParity1 != 0 || oddParity2 != 0) {
							md.getContent().find("#show-parity").show()
							document.getElementById('parities-bit-value').value = parities == 1 ? 'Check' : 'Failed';
						} else {
							md.getContent().find("#show-parity").hide()
						}

						if (bitsRead > wiegandLength) {
							updateShowBits(facilityCodeStart, facilityCodeLength, cardNumberStartBit, cardNumberLength, issueCodeStartBit, issueCodeLength,
								 evenParity1, evenParity2, oddParity1, oddParity2, invertedFacility, invertedCard, bitsRead, cardValue);
						} else {
							updateShowBits(facilityCodeStart, facilityCodeLength, cardNumberStartBit, cardNumberLength, issueCodeStartBit, issueCodeLength,
								evenParity1, evenParity2, oddParity1, oddParity2, invertedFacility, invertedCard, wiegandLength, cardValue);
						}
					}
				});
				return
			}

			const observer = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
						let cardValue = ""
						let bitsRead = 0
						let facilityRead = 0
						let cardIdRead = 0
						let parities = false

						const element = mutation.target;
						if (element.classList.contains('active')) {
							checkWiegandEvent = setInterval(wiegandEvent, 500);
						} else {
							clearInterval(checkWiegandEvent);
						}
					}
				});
			});

			const targetElement = document.querySelector('#tab4_TS');
			const config = { 
				attributes: true,
				attributeFilter: ['class']
			};
			observer.observe(targetElement, config);

			function update_show_fields(){
				// Automatico
				if (md.getContent().find('#chkWiegandBitsMode').is(':checked')) {
					md.getContent().find('#wiegandManual').hide()
					md.getContent().find('#wiegandAutomatic').show()
					md.getContent().find('#wiegandAutomaticConfiguration').show()
					md.getContent().find('#updateBits').hide()

					md.getContent().find('#wiegandManualReverseFacility').hide()
					md.getContent().find('#wiegandManualReverseCard').hide()

					md.getContent().find('#select-number-of-parities-line').hide()
					md.getContent().find('#select-number-of-parities-even').hide()
					md.getContent().find('#select-number-of-parities-odd').hide()
					md.getContent().find('#parity-calculation-order').hide()

					md.getContent().find('#odd-parity-bit').prop('disabled', true);
					md.getContent().find('#even-parity-bit').prop('disabled', true);
					md.getContent().find('#odd-parity-start').prop('disabled', true);
					md.getContent().find('#odd-parity-end').prop('disabled', true);
					md.getContent().find('#even-parity-start').prop('disabled', true);
					md.getContent().find('#even-parity-end').prop('disabled', true);

					md.getContent().find('#facility-bits-start').prop('disabled', true);
					md.getContent().find('#facility-bits').prop('disabled', true);
					md.getContent().find('#card-number-bits-start').prop('disabled', true);
					md.getContent().find('#card-number-bits').prop('disabled', true);
					md.getContent().find('#issue-code-bits-start').prop('disabled', true);
					md.getContent().find('#issue-code-bits').prop('disabled', true);

					md.getContent().find('#even-parity-bit-1').prop('disabled', true);
					md.getContent().find('#even-parity-bit-2').prop('disabled', true);
					md.getContent().find('#odd-parity-bit-1').prop('disabled', true);
					md.getContent().find('#odd-parity-bit-2').prop('disabled', true);
					md.getContent().find('#even-parity-sum-bits-1').prop('disabled', true);
					md.getContent().find('#even-parity-sum-bits-2').prop('disabled', true);
					md.getContent().find('#odd-parity-sum-bits-1').prop('disabled', true);
					md.getContent().find('#odd-parity-sum-bits-2').prop('disabled', true);
					md.getContent().find('#parity-bit-order').prop('disabled', true);

					if (data.wiegand.wiegand_format_size != "custom") {
						parse_card_read_info(data.wiegand.wiegand_format_size)
						md.getContent().find('#selectWiegandFormat').val(data.wiegand.wiegand_format_size).change();
					} else {
						parse_card_read_info("26")
						md.getContent().find('#selectWiegandFormat').val("26").change();
					}

				// Manual
				} else {
					md.getContent().find('#wiegandManual').show()
					md.getContent().find('#wiegandAutomatic').hide()
					md.getContent().find('#updateBits').show()
					md.getContent().find('#wiegandAutomaticConfiguration').hide()

					md.getContent().find('#wiegandManualReverseFacility').show()
					md.getContent().find('#wiegandManualReverseCard').show()

					md.getContent().find('#select-number-of-parities-line').show()
					md.getContent().find('#select-number-of-parities-even').show()
					md.getContent().find('#select-number-of-parities-odd').show()
					md.getContent().find('#parity-calculation-order').show()

					md.getContent().find('#odd-parity-bit').prop('disabled', false);
					md.getContent().find('#even-parity-bit').prop('disabled', false);
					md.getContent().find('#odd-parity-start').prop('disabled', false);
					md.getContent().find('#odd-parity-end').prop('disabled', false);
					md.getContent().find('#even-parity-start').prop('disabled', false);
					md.getContent().find('#even-parity-end').prop('disabled', false);

					md.getContent().find('#facility-bits-start').prop('disabled', false);
					md.getContent().find('#facility-bits').prop('disabled', false);
					md.getContent().find('#card-number-bits-start').prop('disabled', false);
					md.getContent().find('#card-number-bits').prop('disabled', false);
					md.getContent().find('#parity-bits').prop('disabled', false);

					md.getContent().find('#even-parity-bit-1').prop('disabled', false);
					md.getContent().find('#even-parity-bit-2').prop('disabled', false);
					md.getContent().find('#odd-parity-bit-1').prop('disabled', false);
					md.getContent().find('#odd-parity-bit-2').prop('disabled', false);
					md.getContent().find('#even-parity-sum-bits-1').prop('disabled', false);
					md.getContent().find('#even-parity-sum-bits-2').prop('disabled', false);
					md.getContent().find('#odd-parity-sum-bits-1').prop('disabled', false);
					md.getContent().find('#odd-parity-sum-bits-2').prop('disabled', false);
					md.getContent().find('#parity-bit-order').prop('disabled', false);

					parse_card_read_info("custom")
				}
			}

			update_show_fields()

			parse_card_read_info(data.wiegand.wiegand_format_size)

			md.getContent().find('#selectWiegandFormat').on('change', function () {
				parse_card_read_info(md.getContent().find('#selectWiegandFormat').val())
			});

			md.getContent().find('#chkWiegandBitsMode').on('change', function () {
				update_show_fields()
			});

			md.getContent().find('#selectEvenParityNumOfBits').on('change', function () {
				updateEvenParityNumSelection(parseInt(md.getContent().find('#selectEvenParityNumOfBits').val()))
			});

			md.getContent().find('#selectOddParityNumOfBits').on('change', function () {
				updateOddParityNumSelection(parseInt(md.getContent().find('#selectOddParityNumOfBits').val()))
			});

			md.getContent().find('#selectParityCalculationOrder').on('change', function () {
				if(parseInt(md.getContent().find('#selectParityCalculationOrder').val()) == 0){
					md.getContent().find('#parity-bit-order').prop('disabled', true);
				} else {
					md.getContent().find('#parity-bit-order').prop('disabled', false);
				}
			});

			document.getElementById('updateBits').addEventListener('click', function() {
				updateWiegand();
			});
		});
	}
}

function generateRandomScbk(){
  let hexString = '';
  const hexChars = '0123456789abcdef';

  for (let i = 0; i < 32; i++) {
      const randomIndex = Math.floor(Math.random() * 16);
      hexString += hexChars[randomIndex];
  }

  $('#inputModuleScbk').val(hexString);
}

function toggleVisibilityScbkHex(){
	var eyeIcon = document.getElementById("scbk_hex-eye");
	var passwordInput = document.getElementById("inputModuleScbk");

	if (passwordInput.type === "password") {
		passwordInput.type = "text";
		eyeIcon.classList.remove("icon-eye-open");
		eyeIcon.classList.add("icon-eye-close");
	} else {
		passwordInput.type = "password";
		eyeIcon.classList.remove("icon-eye-close");
		eyeIcon.classList.add("icon-eye-open");
	}
}

function handleKeyAMapping() {
	const element = document.getElementById("keyAMapping");
	const err = document.getElementById("keyAError");

	if (!element) return '';

	const raw = element.value.trim();

	if (err) err.textContent = "";

	if (!raw) return '';

	if (!/^[A-Za-z]{1,3}$/.test(raw)) {
		if (err) err.textContent = "Type 1 to 3 letters (A-Z)";
		return '';
	}

	const mapped = raw.toUpperCase();
	element.value = mapped;

	return mapped;
}

function handleKeyBMapping() {
	const element = document.getElementById("keyBMapping");
	const err = document.getElementById("keyBError");

	if (!element) return '';

	const raw = element.value.trim();

	if (err) err.textContent = "";

	if (!raw) return '';

	if (!/^[A-Za-z]{1,3}$/.test(raw)) {
		if (err) err.textContent = "Type 1 to 3 letters (A-Z)";
		return '';
	}

	const mapped = raw.toUpperCase();
	element.value = mapped;

	return mapped;
}

function handleKeyCMapping() {
	const element = document.getElementById("keyCMapping");
	const err = document.getElementById("keyCError");

	if (!element) return '';

	const raw = element.value.trim();

	if (err) err.textContent = "";

	if (!raw) return '';

	if (!/^[A-Za-z]{1,3}$/.test(raw)) {
		if (err) err.textContent = "Type 1 to 3 letters (A-Z)";
		return '';
	}

	const mapped = raw.toUpperCase();
	element.value = mapped;

	return mapped;
}

function handleKeyDMapping() {
	const element = document.getElementById("keyDMapping");
	const err = document.getElementById("keyDError");

	if (!element) return '';

	const raw = element.value.trim();

	if (err) err.textContent = "";

	if (!raw) return '';

	if (!/^[A-Za-z]{1,3}$/.test(raw)) {
		if (err) err.textContent = "Type 1 to 3 letters (A-Z)";
		return '';
	}

	const mapped = raw.toUpperCase();
	element.value = mapped;

	return mapped;
}

var modal_osdpEdit = $('#modal_osdpEdit').clone().end().remove();
function openOSDPModal() {
	var md = new Modal();
	md.setTitle('OSDP Settings');
	md.setHTMLContent(modal_osdpEdit);
	md.addButton([
		{
			'type': 'save',
			'callback': save
		},
		{
			'type': 'cancel'
		}
	]);

	function validateInputs (data) {
		var result = [];
		if ('address' in data) {
			if (data.address.length === 0 || isNaN(data.address) ||
			 parseInt(data.address) >= 127 || parseInt(data.address) < 0) {
				result.push('Insert a valid address value');
			}
		}
		return result;
	}

	async function askReboot() {
		var response = false;
		await new Promise(function(resolve, reject) {
			var warning = new Modal();
			warning.setTitle('Reboot is needed');
			warning.setContent('It is necessary to restart the device after applying the configurations. Do you want to proceed?');
			warning.addButton([
				{
					'type' : 'ok',
					'callback': function(){
						response = true;
						warning.close();
						resolve();
					}
				},
				{
					'type' : 'cancel',
					'callback': function(){
						response = false;
						warning.close();
						resolve();
					}
				}
			]);
			warning.show();
		});
		return response;
	}

	async function save(returnMessage) {
		let enabled = md.getContent().find('#chkOsdpEnabled').parent().hasClass('switch-on') ? '1' : '0';
		let pd_address = md.getContent().find('#inputModuleAddress')[0].value;
		let card_read_report_format = md.getContent().find('#card_read_report_radio_list').find('input[type="radio"]:checked').val();
		let new_wiegand_size_format = md.getContent().find('#osdp_wiegand_size_radio_list').find('input[type="radio"]:checked').val();
		let enforce_secure_channel = md.getContent().find('#chkEnforceSecureChannel').parent().hasClass('switch-on') ? '1' : '0';
		let installation_mode = md.getContent().find('#chkInstallationMode').parent().hasClass('switch-on');
		let osdp_text_enabled = md.getContent().find('#chkOsdpText').parent().hasClass('switch-on') ? '1' : '0';
		let special_function_keys_enabled = md.getContent().find('#chkSpecialFunctionKeys').parent().hasClass('switch-on') ? '1' : '0';
		let baud_rate = md.getContent().find('#selectBaudRate option:selected').val();
		let out_mode = md.getContent().find('#osdp_out_mode_list').find('input[type="radio"]:checked').val();
		let face_passthrough_source = md.getContent().find('#osdp_user_card_data_source').is(':checked') ? 'USER_CARD' : 'USER_ID';

		var reboot = false
		var osdpConfig = MessengerUtil.send(
			'get_configuration',
			{
				'osdp': [
					'enabled',
					'baud_rate'
				]
			}
		).osdp;
		if (!(enabled == '1' && osdpConfig.enabled == '1') || (baud_rate != osdpConfig.baud_rate)) {
			reboot = await askReboot();
			if (!reboot) {
				return returnMessage("Configuration cancelled");
			}
		}

		var result = validateInputs({
			address: pd_address
		});

		if (result.length) {
			returnMessage('Invalid input value<br>' + result);
			return;
		}
		var pin_mode = '';
		if (md.getContent().find('#osdp_standalone_mode').is(':checked')) pin_mode = 'standalone';
		if (md.getContent().find('#osdp_buffered_mode').is(':checked')) pin_mode = 'buffered';
    	
		var new_key = md.getContent().find('#inputModuleScbk').val();
		if(new_key.trim().length != 32){
			returnMessage("The key must have 32 digits");
			return;
		}

		const hexRegex = /^[0-9a-fA-F]+$/;
		if(!hexRegex.test(new_key)){
			returnMessage("The key must be in hexadecimal, it can only contain the characters 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, a, b, c, d, e, f");
			return;
		}

		MessengerUtil.send('set_osdp_installation_mode', {'enable': installation_mode});
		if(!installation_mode) {
		MessengerUtil.send('osdp_scbk', {'scbk': new_key});
		}

		// Collect key mappings
		const keyA = handleKeyAMapping();
		const keyB = handleKeyBMapping();
		const keyC = handleKeyCMapping();
		const keyD = handleKeyDMapping();

		var isPassthroughMode = (out_mode === '2');

		var configToSave = {
			'osdp': {
				'enabled': enabled,
				'pd_address': pd_address,
				'card_read_report_format': card_read_report_format,
				'enforce_secure_channel': enforce_secure_channel,
				'baud_rate': baud_rate,
				'out_mode': out_mode,
				'wiegand_size': new_wiegand_size_format,
				'special_function_keys_enabled': special_function_keys_enabled,
				'face_passthrough_source': face_passthrough_source,
				'key_a_mapping': keyA,
				'key_b_mapping': keyB,
				'key_c_mapping': keyC,
				'key_d_mapping': keyD,
				'osdp_text_enabled': osdp_text_enabled,
			},
			'sec_box': {
				'wiegand_out_size': new_wiegand_size_format,
			},
			'wiegand': {
				'wiegand_format_size': new_wiegand_size_format,
			},
			'general': {
				'pin_max_size': md.getContent().find('#inputMaxSizePinOsdp')[0].value,
				'pin_passthrough_mode': pin_mode,
				'pin_passthrough_format': 'ascii',
			},
		};

		if (isPassthroughMode) {
			configToSave.osdp.face_bypass_format = new_wiegand_size_format;
			configToSave.sec_box.face_bypass_format = new_wiegand_size_format;
		}

		let data = MessengerUtil.send('set_configuration', configToSave);

		drawRelaysMenu();
		if (reboot) {
			var rebootAlert = new Modal();
			rebootAlert.setTitle('OSDP Settings');
			rebootAlert.setContent('Rebooting device');
			rebootAlert.show();
			setTimeout(function() {
				var time = 60;
				MessengerUtil.sendAsync('reboot', null, null, false);
				Main.sessionFail({error: 'customError'}, function() {
					setInterval(function () {
						time--;
						if (time == 0)
							window.location = 'login.html';
						$('#countReboot').html(('00' + time).slice(-2));
					}, 1000);

				}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
			}, 10000);
		}
		return returnMessage(data.error != undefined ? data.error : null);
	}

	md.show(function () {
		const card_read_report_format_mappings = {
			"raw": "#raw",
			"wiegand": "#wiegand",
			"ascii": "#ascii"
		};

		const wiegand_size_mappings = {
			"custom": "#osdp_manual_size",
			"26": "#osdp_w26_size",
			"32": "#osdp_w32_size",
			"34": "#osdp_w34_size",
			"35": "#osdp_w35_size",
			"37(H10302)": "#osdp_w37_10302_size",
			"37(H10304)": "#osdp_w37_10304_size",
			"40": "#osdp_w40_size",
			"42": "#osdp_w42_size",
			"48": "#osdp_w48_size",
			"56": "#osdp_w56_size",
			"64": "#osdp_w64_size",
			"66": "#osdp_w66_size"
		};

		const output_mode_mappings = {
			"0": "#id_outmode",
			"1": "#auth_card_outmode",
			"2": "#any_card_outmode"
		}

    	function update_scbk_edit() {
			var enable = !(md.getContent().find('#chkOsdpEnabled').parent().hasClass('switch-on') && 
			md.getContent().find('#chkEnforceSecureChannel').parent().hasClass('switch-on') == '1' && 
			!md.getContent().find('#chkInstallationMode').parent().hasClass('switch-on'));
			md.getContent().find('#inputModuleScbk').prop('disabled', enable);
			md.getContent().find('#btnModuleScbk').prop('disabled', enable);
		}

		md.getContent().find('#chkOsdpEnabled').parent().bootstrapSwitch();
		md.getContent().find('#chkEnforceSecureChannel').parent().bootstrapSwitch();
		md.getContent().find('#chkInstallationMode').parent().bootstrapSwitch();
		md.getContent().find('#chkOsdpText').parent().bootstrapSwitch();
		md.getContent().find('#chkSpecialFunctionKeys').parent().bootstrapSwitch();
		md.getContent().find('#chkAutoKeypad').parent().bootstrapSwitch();

		var data = MessengerUtil.send(
			'get_configuration',
			{
				'osdp': [
					'enabled',
					'pd_address',
					'baud_rate',
					'card_read_report_format',
					'enforce_secure_channel',
					'out_mode',
					'special_function_keys_enabled',
					'face_passthrough_source',
					'key_a_mapping',
					'key_b_mapping',
					'key_c_mapping',
					'key_d_mapping',
					'osdp_text_enabled',
				],
				'wiegand': [
					'wiegand_format_size',
				],
				'general' : [
					'pin_max_size',
					'pin_passthrough_mode',
					'pin_passthrough_format',
				]
			}
		);

		switch (data.general.pin_passthrough_mode) {
			case "standalone":
				md.getContent().find('#osdp_standalone_mode').attr('checked', 'checked');
				break;
			case "buffered":
				md.getContent().find('#osdp_buffered_mode').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#osdp_standalone_mode').attr('checked', 'checked');
				break;
		}

		md.getContent().find('#inputMaxSizePinOsdp')[0].value = data.general.pin_max_size;
		md.getContent().find('#var_max_size_osdp')[0].value = md.getContent().find('#inputMaxSizePinOsdp')[0].value;

		if (data.osdp.enabled != '1') {
			md.getContent().find('#pin-passthrough-config').hide();
		}

		document.getElementById("keyAMapping").value = data.osdp.key_a_mapping;
		document.getElementById("keyBMapping").value = data.osdp.key_b_mapping;
		document.getElementById("keyCMapping").value = data.osdp.key_c_mapping;
		document.getElementById("keyDMapping").value = data.osdp.key_d_mapping;

		var scbk = MessengerUtil.send('osdp_scbk', {});

		var faceSource = data.osdp.face_passthrough_source || 'USER_CARD';
		if (faceSource === 'USER_ID') {
			md.getContent().find('#osdp_user_id_data_source').attr('checked', 'checked');
		} else {
			md.getContent().find('#osdp_user_card_data_source').attr('checked', 'checked');
		}

		switch (data.general.pin_passthrough_mode) {
			case "standalone":
				md.getContent().find('#osdp_standalone_mode').attr('checked', 'checked');
				break;
			case "buffered":
				md.getContent().find('#osdp_buffered_mode').attr('checked', 'checked');
				break;
			default:
				md.getContent().find('#osdp_standalone_mode').attr('checked', 'checked');
				break;
		}

		md.getContent().find('#inputMaxSizePinOsdp')[0].value = data.general.pin_max_size;
		md.getContent().find('#var_max_size_osdp')[0].value = md.getContent().find('#inputMaxSizePinOsdp')[0].value;

		if (data.osdp.enabled != '1') {
			md.getContent().find('#pin-passthrough-config').hide();
		}

		var scbk = MessengerUtil.send('osdp_scbk', {});
		var installation_mode = MessengerUtil.send('get_osdp_installation_mode', {});

		md.getContent().find('#chkOsdpEnabled').parent().bootstrapSwitch('setState', data.osdp.enabled == '1');
		md.getContent().find('#chkEnforceSecureChannel').parent().bootstrapSwitch('setState', data.osdp.enforce_secure_channel == '1');
		md.getContent().find('#chkInstallationMode').parent().bootstrapSwitch('setState', installation_mode.installation_mode);
		md.getContent().find('#chkSpecialFunctionKeys').parent().bootstrapSwitch('setState', data.osdp.special_function_keys_enabled == '1');
		md.getContent().find('#chkOsdpText').parent().bootstrapSwitch('setState', data.osdp.osdp_text_enabled == '1');

		md.getContent().find('#inputModuleAddress')[0].value = data.osdp.pd_address;
		md.getContent().find('#selectBaudRate').val(data.osdp.baud_rate).change();

		update_scbk_edit()
		md.getContent().find('#inputModuleScbk').val(scbk.scbk);

		let card_read_report_format = card_read_report_format_mappings[data.osdp.card_read_report_format];
		if (card_read_report_format != undefined) {
			md.getContent().find(card_read_report_format).attr('checked', 'checked');
		} else {
			md.getContent().find('#raw').attr('checked', 'checked');
		}

		var isPassthroughMode =
			(data.osdp.out_mode === '2');

		let output_mode = output_mode_mappings[data.osdp.out_mode]
		if (isPassthroughMode) {
			md.getContent().find(output_mode).attr('checked', 'checked');
			md.getContent().find('#osdp_face_data_source').show();
		} else if (output_mode != undefined) {
			md.getContent().find(output_mode).attr('checked', 'checked');
			md.getContent().find('#osdp_face_data_source').hide();
		} else {
			md.getContent().find('#id_outmode').attr('checked', 'checked');
			md.getContent().find('#osdp_face_data_source').hide();
		}

		md.getContent()
			.find('#osdpWiegandSizeTitle')
			.text(isPassthroughMode ?
				'Face format:' : 'Wiegand size:');

		var wiegandSelectorValue = isPassthroughMode
			? (data.osdp.face_bypass_format || data.wiegand.wiegand_format_size)
			: data.wiegand.wiegand_format_size;

		let wiegand_size_format = wiegand_size_mappings[wiegandSelectorValue];
		if (wiegand_size_format != undefined) {
			md.getContent().find(wiegand_size_format).attr('checked', 'checked');
		} else {
			md.getContent().find('#osdp_w26_size').attr('checked', 'checked');
		}

    	md.getContent().find('#chkEnforceSecureChannel').parent().parent().on('switch-change', function (e, data) {
			update_scbk_edit();
		});

		md.getContent().find('#chkOsdpEnabled').parent().parent().on('switch-change', function (e, data) {
			update_scbk_edit();
			if (!md.getContent().find('#chkOsdpEnabled').parent().hasClass('switch-on')) {
				return;
			}

			let confirmation_modal = new Modal();
			confirmation_modal.setTitle("Attention");
			let content = "When enabling the OSDP feature, communication with the EAM will not work, and the equipment will start acting as a Peripheral Device (PD) in the OSDP interface.";
			confirmation_modal.setContent(content);
			confirmation_modal.addButton([
				{
					'type': 'ok',
				},
			]);

			confirmation_modal.show();
		});

		md.getContent().find('#chkInstallationMode').parent().parent().on('switch-change', function (e, data) {
			update_scbk_edit();
			if (!md.getContent().find('#chkInstallationMode').parent().hasClass('switch-on')) {
				return;
			}

			let confirmation_modal = new Modal();
			confirmation_modal.setTitle("Attention");
			let content = "When enabling Install Mode, it will remain enabled until one of the three conditions below occurs: " + "<br> <ul><li>" + "Key exchange" + "</li><li>" + "After 30 minutes " + "</li><li>" + "Device restart" + "</li></ul>";
			confirmation_modal.setContent(content);
			confirmation_modal.addButton([
				{
					'type': 'ok',
				},
			]);

			md.getContent().find('#pin-passthrough-config').show();
			confirmation_modal.show();
		});
		const osdpFmtRadios = document.querySelectorAll('input[name="osdp-fmt"]');
		const osdpWiegandsizeRadios = document.querySelectorAll('input[name="osdp-wiegandsize"]');
		function changeCheck() {
			// Check if the "wiegand" radio button is selected
			const wiegandRadio = document.getElementById("wiegand");
			const isWiegandSelected = wiegandRadio.checked;

			// Disable or enable the "osdp-wiegandsize" radios based on the selection
			osdpWiegandsizeRadios.forEach(function(wiegandsizeRadio) {
				wiegandsizeRadio.disabled = !isWiegandSelected;
			});
		}

		// Add an event listener to the "osdp-fmt" radios
		osdpFmtRadios.forEach(function(radio) {
			radio.addEventListener("change", changeCheck );
		});
		changeCheck();
		new Validate($(md.getContent()), validateInputs);
	});
}

var modal_rfidEdit = $('#modal_rfidEdit').clone().end().remove();
function openRfidModal(){
	var md = new Modal();
	md.setTitle('Configurações ASK');
	md.setHTMLContent(modal_rfidEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	function set_rfid_sizes(ask_site_code_size, ask_user_code_size) {
		md.getContent().find('#lstSiteCodeSize').val(ask_site_code_size);
		if (ask_site_code_size === "8") {
			md.getContent().find('#userCodeSize40').hide();
		}	else {
			md.getContent().find('#userCodeSize40').show();
		}
		md.getContent().find('#lstUserCodeSize').val(ask_user_code_size);
	}

	function save(returnMessage) {
		let site_code_size = md.getContent().find('#lstSiteCodeSize').val();
		let user_code_size = md.getContent().find('#lstUserCodeSize').val();

		if (user_code_size == null || Number.isNaN(user_code_size) || site_code_size == null || Number.isNaN(site_code_size)) {
			site_code_size = "8";
			user_code_size = "16";
			set_rfid_sizes(site_code_size, user_code_size);
		}

		let data = MessengerUtil.send('set_configuration',{
			rfid: {
				ask_site_code_size: site_code_size,
				ask_user_code_size: user_code_size,
				ask_site_code_shift: user_code_size,
			}
		});

		return returnMessage(data.error !== undefined ? data.error : null);
	}

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function(){
			let data = MessengerUtil.send('get_configuration', {
				rfid: ['ask_site_code_size', 'ask_user_code_size']
			});

			set_rfid_sizes(data.rfid.ask_site_code_size, data.rfid.ask_user_code_size);

			md.getContent().find('#lstSiteCodeSize').on('change', function () {
				if ($(this).val() === "8") {
					if (md.getContent().find('#lstUserCodeSize').val() === "40") {
						md.getContent().find('#lstUserCodeSize').val("16");
					}
					md.getContent().find('#userCodeSize40').hide();
				} else {
					md.getContent().find('#userCodeSize40').show();
				}
			});
		});
	}
}

var modal_mifareEdit = $('#modal_mifareEdit').clone().end().remove();
function openMifareModal(){
	var md = new Modal();
	md.setTitle('Mifare Settings');
	md.setHTMLContent(modal_mifareEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	function save(returnMessage) {
		var byteOrder = '';

		if (md.getContent().find('#default_byteorder').is(':checked')) {
			byteOrder = '';
		} else if (md.getContent().find('#w26_byteorder').is(':checked')) {
			byteOrder = 'W_26';
		} else if (md.getContent().find('#lsb64_byteorder').is(':checked')) {
			byteOrder = 'LSB_64';
		} else if (md.getContent().find('#lsb_byteorder').is(':checked')) {
			byteOrder = 'LSB';
		} else if (md.getContent().find('#lsbw26_byteorder').is(':checked')) {
			byteOrder = 'LSB_W_26';
		}

		var data = MessengerUtil.send('set_configuration',{
			mifare: { byte_order: byteOrder }
		});

		return returnMessage(data.error != undefined ? data.error : null);
	}

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function(){
			var data = MessengerUtil.send('get_configuration', {
				mifare: ['byte_order']
			});

			switch (data.mifare.byte_order) {
				case "W_26":
					md.getContent().find('#w26_byteorder').attr('checked','checked');
					break;
				case "LSB_64":
					md.getContent().find('#lsb64_byteorder').attr('checked','checked');
					break;
				case "LSB":
					md.getContent().find('#lsb_byteorder').attr('checked','checked');
					break;
				case "LSB_W_26":
					md.getContent().find('#lsbw26_byteorder').attr('checked','checked');
					break;
				default:
					md.getContent().find('#default_byteorder').attr('checked','checked');
					break;
			}
		});
	}
}

var bluetoothStatusUpdateLabels = false
function bluetoothStatus(md, status) {
	if (status == 2) {
		md.getContent().find('#var_omnikey_blestatus').html('<font color="#00FF00">Active</font>');
		var ble_timer = setInterval(function (){
			clearInterval(ble_timer)
			var bledata = MessengerUtil.send('get_hid_ble_status', null, null, false);
			bluetoothStatus(md, bledata.status)
		}, 1000);
	}
	if (!bluetoothStatusUpdateLabels) {
		bluetoothStatusUpdateLabels = true
		var data = MessengerUtil.send('get_hid_module_data', null, null, false);
		md.getContent().find('#var_omnikey_model').html(data.model);
		md.getContent().find('#var_omnikey_sn').html(data.serial_number);
		md.getContent().find('#var_omnikey_fwversion').html(data.fw_version);
	  }
	else if (status == 1) {
		bluetoothStatusUpdateLabels = false
		md.getContent().find('#var_omnikey_blestatus').html('<font color="#00BBFF">Rebooting...</font>');
		var ble_timer = setInterval(function (){
			clearInterval(ble_timer)
			var bledata = MessengerUtil.send('get_hid_ble_status', null, null, false);
			bluetoothStatus(md, bledata.status)
		}, 1000);
	}
	else {
		md.getContent().find('#var_omnikey_blestatus').html('<font color="#FF0000">Disabled</font>');
	}
}

var md_global;
function restartBluetooth() {
	MessengerUtil.send('hid_ble_restart');
	bluetoothStatus(md_global, 1)
}

function updateModule() {
	var warning_modal = new Modal();
	warning_modal.setTitle('Module update');
	  warning_modal.setContent('Attention. The update takes about 10 minutes and cannot be canceled. Do you want to continue?');
	  warning_modal.addButton([
		  {
			  'type' : 'ok',
		'callback' : function () {
		  warning_modal.clearButtons()
				  warning_modal.setContent('' +
			'<div id="message_hid">Updating...</div><br/>' +
			'<div class="progress">' +
			'<div class="progress-bar expbar_hid" style="color:#FFFFFF00;width:0;background-color:#35AA47" role="progressbar">.</div>' +
			'</div>'
		  );
		  warning_modal.updateProgress = async function (value) {
			// warning_modal.getContent().find('#message_hid').text(message);
			warning_modal.getContent().find('.expbar_hid').css({ width: value + '%' });
		
			await new Promise(function (resolve, reject) {
			  setTimeout(resolve, 500);
			});
		  };
  
		  var updateInterval = setInterval(function () {
			var updateFwStatus = MessengerUtil.send('hid_update_fw_status');
			warning_modal.updateProgress(updateFwStatus.progress);
			if(updateFwStatus.step == "error") {
			  clearInterval(updateInterval);
			  warning_modal.addButton([
				{
				  'type' : 'ok'
				}
			  ]);
			  warning_modal.getContent().find('#message_hid').text('Error updating module');
			}
			else if (updateFwStatus.progress == 100) {
			  clearInterval(updateInterval);
			  warning_modal.addButton([
				{
				  'type' : 'ok'
				}
			  ]);
			  restartBluetooth()
			  warning_modal.getContent().find('#message_hid').text('Module updated successfully');
			}
		  }, 1000);
		  MessengerUtil.send('hid_update_fw_start');
		}
		  },
	  {
			  'type' : 'cancel'
		  }
	  ]);
	warning_modal.show()
  }

var modal_hidEdit = $('#modal_hidEdit').clone().end().remove();
function openHIDModal(){
	var checkCardEvent;
	var md = new Modal();
	md_global = md;
	md.setTitle('HID Settings');
	md.setHTMLContent(modal_hidEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel',
			'callback' : function () {
				clearInterval(checkCardEvent)
				md.hide();
			}
		}
	]);

	function save(returnMessage) {
		let card_process = md.getContent().find('#card_read_process').find('input[type="radio"]:checked').val();
		let csn_msb = md.getContent().find('#card_read_csn').find('input[type="radio"]:checked').val();
		let card_read_pacs = md.getContent().find('#card_read_pacs').find('input[type="radio"]:checked').val();
		let format_wiegand = (card_read_pacs == 1) ? '1' : '0';
		let format_indala_b1 = (card_read_pacs == 2) ? '1' : '0';

		var res = MessengerUtil.send('set_configuration', {
			hid_reader: {
				format_wiegand: format_wiegand,
				format_indala_b1: format_indala_b1,
				card_process: card_process,
				csn_msb: csn_msb
			}
		});
		return returnMessage(res.error != undefined ? res.error : null);
	}

	md.show(function(){
		var forwardSerialConfig = MessengerUtil.send('get_configuration', {
			hid_reader: ['forward_serial_enabled']
		});
		var isForwardSerialEnabled = (forwardSerialConfig.hid_reader.forward_serial_enabled == '1');

		window.currentForwardSerialStatus = isForwardSerialEnabled;

		if (isForwardSerialEnabled) {
			md.getContent().find('.hid-config-tab').hide();
			md.getContent().find('#forwardSerialTab').addClass('active');
			md.getContent().find('#tab5_TS').addClass('active');
			md.getContent().find('#tab1_TS').removeClass('active');
			md.getContent().find('#forwardSerialButtonText').text('Disable forwarding');

			md.getContent().closest('.modal').find('.btn-save').hide();
		} else {
			md.getContent().find('.hid-config-tab').show();
			md.getContent().find('#forwardSerialTab').removeClass('active');
			md.getContent().find('#tab5_TS').removeClass('active');
			md.getContent().find('#forwardSerialButtonText').text('Enable forwarding');
		}

		if (!isForwardSerialEnabled) {
			var data = MessengerUtil.send('get_hid_module_data', null, null, false);
			md.getContent().find('#var_omnikey_model').html(data.model);
			md.getContent().find('#var_omnikey_sn').html(data.serial_number);
			md.getContent().find('#var_omnikey_fwversion').html(data.fw_version);
			var btnLabel = md.getContent().find('#updateFw').html() + " " + data.file_fw_version;
			md.getContent().find('#updateFw').html(btnLabel)

			var bledata = MessengerUtil.send('get_hid_ble_status', null, null, false);
			bluetoothStatus(md, bledata.status)

			checkCardEvent = setInterval(function(){
				var carddata = MessengerUtil.send('get_hid_last_card', null, null, false);
				md.getContent().find('#var_omnikey_csn').html(carddata.csn);
				md.getContent().find('#var_omnikey_pac').html(carddata.pac);
				md.getContent().find('#var_omnikey_cardtype').html(carddata.type);
				md.getContent().find('#var_omnikey_pacbit').html(carddata.bits);
			}, 1000);

					data = MessengerUtil.send('get_configuration', {
				hid_reader: ['format_wiegand', 'format_indala_b1', 'card_process', 'csn_msb']
			});

			if (data.hid_reader.card_process == 0) {
				md.getContent().find('#card_read_pacs_only').attr('checked','checked');
			} else if (data.hid_reader.card_process == 1) {
				md.getContent().find('#card_read_csn_only').attr('checked','checked');
			} else if (data.hid_reader.card_process == 2) {
				md.getContent().find('#card_read_csn_to_mifare').attr('checked','checked');
			}
			if (data.hid_reader.format_indala_b1 == 1) {
				md.getContent().find('#card_read_aba').attr('checked','checked');
			} else if (data.hid_reader.format_wiegand == 1) {
				md.getContent().find('#card_read_wiegand').attr('checked','checked');
			} else {
				md.getContent().find('#card_read_raw').attr('checked','checked');
			}

			if (data.hid_reader.csn_msb == 0) {
				md.getContent().find('#card_read_lsb').attr('checked','checked');
			} else {
				md.getContent().find('#card_read_msb').attr('checked','checked');
			}
		}
	});
}

function toggleForwardSerial() {
	var enable = !window.currentForwardSerialStatus;

	try {
		var result = MessengerUtil.send('forward_serial_enable', {
			enable: enable
		});

		if (result.success) {
			window.currentForwardSerialStatus = enable;

			if (md_global) {
				md_global.hide();
			}

			if (enable) {
				alertModal('Serial forwarding enabled successfully.', '', '');
			} else {
				alertModal('Serial forwarding disabled successfully.', '', '');
			}

			setTimeout(function() {
				openHIDModal();
			}, 500);
		} else {
			alertModal('Error changing serial forwarding.', '', '');
		}
	} catch (error) {
		console.error('Error toggling forward serial:', error);
		alertModal('Error changing serial forwarding.', '', '');
	}
}

var modal_Attendance = $('#modal_Attendance').clone().end().remove();
function openAttendanceModal() {
	var md = new Modal();
	md.setTitle('Attendance Mode');
	md.setHTMLContent(modal_Attendance);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	function save(returnMessage) {
		var attendanceMode = md.getContent().find('#ckAttendanceMode').is(':checked');
		var logType = md.getContent().find('#ckLogType').is(':checked');
		var attendance_id_timeout = md.getContent().find('#att_timeout').val();
		var attendanceButtonsSize = md.getContent().find('input[name="attendance_button_size"]:checked').val();

		if (validateTimeout({att_timeout: attendance_id_timeout}).length){
			returnMessage('Inform a valid time');
			return;
		}

		const result = MessengerUtil.send(
			'set_configuration',
			{
				general: { 
					attendance_mode: attendanceMode ? "1" : "0",
					attendance_buttons_size: attendanceButtonsSize || "0"
				},
				identifier: { log_type: logType ? "1" : "0", attendance_id_timeout: String(Number(attendance_id_timeout)*1000)}
			}
		)

		if (result.error) {
			returnMessage(result.error);
		}

		window.location.reload();
		return returnMessage(null);
	}

	function updateLogTypeLabel() {
		if (md.getContent().find('#ckAttendanceMode').parent().hasClass('switch-on')) {
			md.getContent().find('#logTypeText').text('Register Status');
		} else {
			md.getContent().find('#logTypeText').text('Access Types');
		}
	}

	function showTimeout() {
		if (md.getContent().find('#ckLogType').parent().hasClass('switch-on')) {
			md.getContent().find('#attendanceTimeout').show();
		} else {
			md.getContent().find('#attendanceTimeout').hide();
		}
	}

	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function() {
			var data = MessengerUtil.send(
			'get_configuration',
			{
				general: ['attendance_mode', 'attendance_buttons_size'],
				identifier: ['log_type', 'attendance_id_timeout']
			}
			);

			md.getContent().find('#ckAttendanceMode').parent().bootstrapSwitch();
			md.getContent().find('#ckAttendanceMode').parent().bootstrapSwitch('setState', data.general.attendance_mode == '1');
			md.getContent().find('#ckAttendanceMode').parent().parent().on('switch-change', function(e, data) { updateLogTypeLabel(); });
			md.getContent().find('#ckLogType').parent().bootstrapSwitch();
			md.getContent().find('#ckLogType').parent().bootstrapSwitch('setState', data.identifier.log_type == '1');
			md.getContent().find('#ckLogType').parent().parent().on('switch-change', function(e, data) { showTimeout(); });
			md.getContent().find('#att_timeout').val(data.identifier.attendance_id_timeout/1000);
			md.getContent().find('input[name="attendance_button_size"][value="' + (data.general.attendance_buttons_size || '0') + '"]').prop('checked', true);
			md.getContent().find('#logTypeSwitch').show();
			showTimeout();
			updateLogTypeLabel();
			new Validate($('#attendanceTimeout'), validateTimeout);
		});
	}

	function validateTimeout(data){
		var result = [];
		if('att_timeout' in	data){
			if(parseInt(data.att_timeout) === 0)
				return [];

			if(ValidateUtil.isEmpty(data.att_timeout) || !ValidateUtil.isNumber(data.att_timeout)) {
				result.push('Inform a valid time');
			}
		}
		return result;
	}
}

var modal_btnholeEdit = $('#modal_btnholeEdit').clone().end().remove();
function openBtnholeModal(){
	var currentDev = Main.currentDevice();
		var portal_1 = new portals();
		portal_1.load({
			'async' : false,
			'object' : currentDev,
			'where' : [{
				'object' : 'portal_script_parameters' ,
				'field' : 'script_parameter_id',
				'value' : 3,
				'operator' : '!='
			}]
		});
		var portal_2 = new portals();
		portal_2.load({
			'async' : false,
			'object' : currentDev,
			'where' : [{
				'object' : 'portal_script_parameters' ,
				'field' : 'script_parameter_id',
				'value' : 3
			}]
		});

	var md = new Modal();
	md.setTitle('Sensors and Buttons');
	md.setHTMLContent(modal_btnholeEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	function save(returnMessage) {
		var btn1En = 0;
		var btn1Idle = 0;
		var btn2En = 0;
		var btn2Idle = 0;
		var bellEn = 0
		var bellRelay = 0;
		var sirenEn = 0
		var sirenRelay = 0;
		var relay1En = 0;
		var relay2En = 0;
		var relay1Timeout;
		var relay2Timeout;
		var relay1AutoClose = 0;
		var relay2AutoClose = 0;
		var doorSensor1En = 0;
		var doorSensor1Idle = 0;
		var doorSensor2En = 0;
		var doorSensor2Idle = 0;
		var dataActions = [];

		if(md.getContent().find("#inputRelay1Timeout").val() === "" || md.getContent().find("#inputRelay2Timeout").val() === ""){

			return {error: "Do not leave any fields blank!"}
		}

		//preencho as variáeis acima com os valores atuais retirados da tela.
		if(md.getContent().find('#chkButtonhole1Active').parent().hasClass('switch-on')){
			btn1En = 1;
		}
		if(md.getContent().find('#chkButtonhole2Active').parent().hasClass('switch-on')){
			btn2En = 1;
		}
		if(md.getContent().find('#chkButtonhole1NO').parent().hasClass('switch-on')){
			btn1Idle = 1;
		}
		if(md.getContent().find('#chkButtonhole2NO').parent().hasClass('switch-on')){
			btn2Idle = 1;
		}

		if(md.getContent().find('#chkSensor1Active').parent().hasClass('switch-on')){
			doorSensor1En = 1;
		}
		if(md.getContent().find('#chkSensor1NO').parent().hasClass('switch-on')){
			doorSensor1Idle = 1;
		}
		if(md.getContent().find('#chkSensor2Active').parent().hasClass('switch-on')){
			doorSensor2En = 1;
		}
		if(md.getContent().find('#chkSensor2NO').parent().hasClass('switch-on')){
			doorSensor2Idle = 1;
		}

		if(md.getContent().find('#chkQtdDoorControl').parent().hasClass('switch-on')){
			if(md.getContent().find('#Opt1_Relay').parent().hasClass('switch-on')){
				relay1En = 1;
				relay1Timeout = md.getContent().find('#Opt1_DoorTimeout').val();
				dataActions.push({'action_id' : 1,	'portal_id' : portal_1.id });
				dataActions.push({'action_id' : 1,	'portal_id' : portal_2.id });
				if(md.getContent().find('#Opt1_RelayAutoClose').parent().hasClass('switch-on')){
					relay1AutoClose = 1;
				}
			}else{
				relay2En = 1;
				relay2Timeout = md.getContent().find('#Opt1_DoorTimeout').val();
				dataActions.push({'action_id' : 2,	'portal_id' : portal_1.id });
				dataActions.push({'action_id' : 2,	'portal_id' : portal_2.id });
				if(md.getContent().find('#Opt1_RelayAutoClose').parent().hasClass('switch-on')){
					relay2AutoClose = 1;
				}
			}


			if(md.getContent().find('#Opt1_Siren').is(':checked')){
				sirenEn = 1;
				if(relay1En === 1){
					sirenRelay = 2;
					relay2En = 1;
				}
				else{
					sirenRelay = 1;
					relay1En = 1;
				}
			}else if(md.getContent().find('#Opt1_Bell').is(':checked')){
				bellEn = 1;
				if(relay1En === 1){
					bellRelay = 2;
					relay2En = 1;
					relay2Timeout = md.getContent().find('#Opt1_BellTimeout').val();
				}
				else{
					bellRelay = 1;
					relay1En = 1;
					relay1Timeout = md.getContent().find('#Opt1_BellTimeout').val();
				}
			}

		}else{

			if(md.getContent().find('#Opt2_Comportamento').parent().hasClass('switch-on')){
				dataActions.push({'action_id' : 1,	'portal_id' : portal_1.id });
				dataActions.push({'action_id' : 1,	'portal_id' : portal_2.id });
				dataActions.push({'action_id' : 2,	'portal_id' : portal_1.id });
				dataActions.push({'action_id' : 2,	'portal_id' : portal_2.id });
			}else{
				if(md.getContent().find('#Opt2_DoorRelay').parent().hasClass('switch-on')){
					dataActions.push({'action_id' : 1,	'portal_id' : portal_1.id });
					dataActions.push({'action_id' : 2,	'portal_id' : portal_2.id });
				}else{
					dataActions.push({'action_id' : 2,	'portal_id' : portal_1.id });
					dataActions.push({'action_id' : 1,	'portal_id' : portal_2.id });
				}
			}

			relay1Timeout = md.getContent().find('#Opt2_DoorTimeout_1').val();
			if(md.getContent().find('#Opt2_Relay1AutoClose').parent().hasClass('switch-on')){
				relay1AutoClose = 1;
			}
			relay2Timeout = md.getContent().find('#Opt2_DoorTimeout_2').val();
			if(md.getContent().find('#Opt2_Relay2AutoClose').parent().hasClass('switch-on')){
				relay2AutoClose = 1;
			}

		}

		/*var isInputValuesOk = verifyRelayTimeoutInput (md.getContent().find('#inputRelay1Timeout')[0].value, md.getContent().find('#inputRelay2Timeout')[0].value);

		if(!isInputValuesOk){
			return {error: "valor inserido no tempo dos relês inválido(Deve estar entre 0 e 600000)"}
		}*/

		var ajaxResponse;
		var data = MessengerUtil.send('set_configuration', {
			general: {
				buttonhole1_enabled: btn1En.toString(),
				buttonhole1_idle: btn1Idle.toString(),
				buttonhole2_enabled: btn2En.toString(),
				buttonhole2_idle: btn2Idle.toString(),

				door_sensor1_enabled: doorSensor1En.toString(),
				door_sensor2_enabled: doorSensor2En.toString(),
				door_sensor1_idle: (doorSensor1Idle ^ 1).toString(),
				door_sensor2_idle: (doorSensor2Idle ^ 1).toString(),

				relay1_enabled: '1',//relay1En.toString(),
				relay2_enabled: '1',//relay2En.toString(),
				relay1_timeout: ((parseInt(relay1Timeout) || 3) * 1000).toString(),
				relay2_timeout: ((parseInt(relay2Timeout) || 3) * 1000).toString(),
				relay1_auto_close: relay1AutoClose.toString(),
				relay2_auto_close: relay2AutoClose.toString(),

				bell_enabled: bellEn.toString(),
				bell_relay: bellRelay.toString()
			}
		});

		if(data.error != undefined)
			ajaxResponse = data.error
		else
			ajaxResponse = null;

		MessengerUtil.send('set_configuration',{
			'alarm': {
				'siren_enabled': sirenEn.toString(),
				'siren_relay': sirenRelay.toString()
			 }
		});

		MessengerUtil.send('destroy_objects', {
			'object' : 'portal_actions',
			'where' : {
				'portal_actions' : {
					'portal_id' : [portal_1.id, portal_2.id],
					'action_id' : [1, 2]
				}
			}
		});

		MessengerUtil.send('create_objects', {
			'object' : 'portal_actions',
			'values' : dataActions
		});


		/*var dataPortalAction = MessengerUtil.send('load_objects', {
			'object' : 'portal_actions',
			'where' : {
				'portal_actions' : {
					'portal_id' : [-1, -2],
					'action_id' : [1, 2]
				}
			}
		}).portal_actions;*/

		drawRelaysMenu();

		return	returnMessage(ajaxResponse);
	}

	md.show(function(){
		var data = MessengerUtil.send('get_configuration', {general: ['buttonhole1_enabled', 'buttonhole1_idle', 'buttonhole2_enabled', 'buttonhole2_idle', 'relay1_enabled', 'relay2_enabled',	'relay1_timeout', 'relay2_timeout', 'relay1_auto_close', 'relay2_auto_close', 'door_sensor1_enabled', 'door_sensor2_enabled', 'door_sensor1_idle', 'door_sensor2_idle', 'bell_enabled', 'bell_relay']}).general;
		md.getContent().find('#chkButtonhole1Active').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonhole1Active').parent().bootstrapSwitch('setState', data.buttonhole1_enabled == "1");
		md.getContent().find('#chkButtonhole1NO').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonhole1NO').parent().bootstrapSwitch('setState', data.buttonhole1_idle == "1");
		md.getContent().find('#chkButtonhole2Active').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonhole2Active').parent().bootstrapSwitch('setState', data.buttonhole2_enabled == "1");
		md.getContent().find('#chkButtonhole2NO').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonhole2NO').parent().bootstrapSwitch('setState', data.buttonhole2_idle == "1");
		md.getContent().find('#chkRelay1Active').parent().bootstrapSwitch();
		md.getContent().find('#chkRelay1Active').parent().bootstrapSwitch('setState', data.relay1_enabled == "1");
		md.getContent().find('#chkRelay2Active').parent().bootstrapSwitch();
		md.getContent().find('#chkRelay2Active').parent().bootstrapSwitch('setState', data.relay2_enabled == "1");
		md.getContent().find('#chkSensor1Active').parent().bootstrapSwitch();
		md.getContent().find('#chkSensor1Active').parent().bootstrapSwitch('setState', data.door_sensor1_enabled == "1");
		md.getContent().find('#chkSensor2Active').parent().bootstrapSwitch();
		md.getContent().find('#chkSensor2Active').parent().bootstrapSwitch('setState', data.door_sensor2_enabled == "1");
		md.getContent().find('#chkSensor1NO').parent().bootstrapSwitch();
		md.getContent().find('#chkSensor1NO').parent().bootstrapSwitch('setState', data.door_sensor1_idle == "0");
		md.getContent().find('#chkSensor2NO').parent().bootstrapSwitch();
		md.getContent().find('#chkSensor2NO').parent().bootstrapSwitch('setState', data.door_sensor2_idle == "0");

		md.getContent().find('.button-previous').click(function() {
			md.getContent().find('.button-next').show();
			var prev = md.getContent().find('.navbar li.active');
			do{
				prev = prev.prev();
			}while(!prev.is(':visible'))
			if(prev.hasClass('first'))
				$(this).hide();
			prev.find('a').click();
		}).hide();
		md.getContent().find('.button-next').click(function() {
			md.getContent().find('.button-previous').show();
			var next = md.getContent().find('.navbar li.active');
			do{
				next = next.next();
			}while(!next.is(':visible'))
			if(next.hasClass('last'))
				$(this).hide();
			next.find('a').click();
		});

		md.getContent().find('.navbar li a').click(function(event) {
			if($(this).parent().hasClass('last'))
				md.getContent().find('.button-next').hide();
			else
				md.getContent().find('.button-next').show();

			if($(this).parent().hasClass('first'))
				md.getContent().find('.button-previous').hide();
			else
				md.getContent().find('.button-previous').show();

		});

		var data2 = MessengerUtil.send('get_configuration', { 'alarm': ['siren_enabled', 'siren_relay'] }).alarm;

		var dataPortalAction = MessengerUtil.send('load_objects', {
			'object' : 'portal_actions',
			'where' : {
				'portal_actions' : {
					'portal_id' : [portal_1.id, portal_2.id],
					'action_id' : [1, 2]
				}
			}
		}).portal_actions;



		var objRelay ={
			'siren_relay' : parseInt(data2.siren_relay),
			'siren_enabled' : parseInt(data2.siren_enabled),
			'bell_relay' : parseInt(data.bell_relay),
			'bell_enabled' : parseInt(data.bell_enabled),
			'relay' : {
				'1' : {
					'enabled' : parseInt(data.relay1_enabled),
					'timeout' : (parseInt(data.relay1_timeout) / 1000) || 3,
					'auto_close' : parseInt(data.relay1_auto_close),
					'portals' : []
				},
				'2' : {
					'enabled' : parseInt(data.relay2_enabled),
					'timeout' : (parseInt(data.relay2_timeout) / 1000) || 3,
					'auto_close' : parseInt(data.relay2_auto_close),
					'portals' : []
				}
			}
		};

		dataPortalAction.forEach(function(row){
			objRelay.relay[row.action_id].portals.push(row.portal_id);
		});

		for(var key in objRelay.relay){
			var relay = objRelay.relay[key];
			var controla = null;
			var ativacao = relay.timeout + ' seconds';
			var identificacao = null;

			if(objRelay.bell_enabled == 1){
				if(objRelay.bell_relay == key)
					controla = 'Bell';
			}else if(objRelay.siren_enabled == 1){
				if(objRelay.siren_relay == key){
					controla = 'Siren';
					ativacao = 'Undetermined';
				}
			}

			relay.portals.forEach(function(portal_id){
				if(controla === null)
					controla ='One door';
				if(identificacao === null){
					if(portal_id == portal_2.id)
						identificacao = 'Wiegand'
					else
						identificacao = 'Local';
				}
				else
					identificacao = 'Local and Wiegand';
			});

			if(identificacao === null)
				identificacao = 'none';

			if(controla === null)
				controla = 'Nothing';

			md.getContent().find('#tab1').append(
				'<div class="control-group span6">' +
					'<h3>Relay ' + key + ' </h3>' + '<br />' +
					'Controls: <b>' + controla + '</b><br />' +
					'Activate: <b>' + ativacao + '</b><br />' +
					'Identification: <b>' + identificacao +	'</b><br />' +
				'</div>'
			);
		}

		//md.getContent().find('.navbar ul li.opt_1').hide();
		md.getContent().find('.navbar ul li.opt_2').hide();

		md.getContent().find('#chkQtdDoorControl').parent().bootstrapSwitch();
		md.getContent().find('#chkQtdDoorControl').parent().parent().on('switch-change', function (e, data) {
				if(data.value === true){
				md.getContent().find('.navbar ul li.opt_2').hide();
				md.getContent().find('.navbar ul li.opt_1').show();
			}else{
					md.getContent().find('.navbar ul li.opt_1').hide();
					md.getContent().find('.navbar ul li.opt_2').show();

					if(md.getContent().find('#Opt2_Comportamento').parent().bootstrapSwitch('status') === false){
						md.getContent().find('.navbar ul li.opt_2_1').show();
						md.getContent().find('.navbar ul li#Relay_Tab_7 .number').html('5');
				}else{
					md.getContent().find('.navbar ul li.opt_2_1').hide();
					md.getContent().find('.navbar ul li#Relay_Tab_7 .number').html('4');
				}
			}
		});
		md.getContent().find('#chkQtdDoorControl').parent().bootstrapSwitch('setState',
			objRelay.relay['1'].portals.length === 2 && objRelay.relay['2'].portals.length === 0
				||
			objRelay.relay['2'].portals.length === 2 && objRelay.relay['1'].portals.length === 0
		);



		md.getContent().find('#Opt1_Relay').parent().bootstrapSwitch();
		if(objRelay.relay['1'].portals.length === 2){
			md.getContent().find('#Opt1_Relay').parent().bootstrapSwitch('setState', true);
			md.getContent().find('#Opt1_DoorTimeout').val(objRelay.relay['1'].timeout);
			md.getContent().find('#Opt1_BellTimeout').val(objRelay.relay['2'].timeout);
			md.getContent().find('#Opt1_RelayAutoClose').parent().bootstrapSwitch();
			md.getContent().find('#Opt1_RelayAutoClose').parent().bootstrapSwitch('setState', objRelay.relay['1'].auto_close === 1);
		}else{
			md.getContent().find('#Opt1_Relay').parent().bootstrapSwitch('setState', false);
			md.getContent().find('#Opt1_DoorTimeout').val(objRelay.relay['2'].timeout);
			md.getContent().find('#Opt1_BellTimeout').val(objRelay.relay['1'].timeout);
			md.getContent().find('#Opt1_RelayAutoClose').parent().bootstrapSwitch();
			md.getContent().find('#Opt1_RelayAutoClose').parent().bootstrapSwitch('setState', objRelay.relay['2'].auto_close === 1);
		}

		if(objRelay.bell_enabled === 1)
			md.getContent().find('#Opt1_Bell').attr('checked','checked');
		else if(objRelay.siren_enabled)
			md.getContent().find('#Opt1_Siren').attr('checked','checked');
		else
			md.getContent().find('#Opt1_Nothing').attr('checked','checked');


		md.getContent().find('#Opt2_Comportamento').parent().bootstrapSwitch();
		md.getContent().find('#Opt2_Comportamento').parent().parent().on('switch-change', function (e, data) {
			if(md.getContent().find('#chkQtdDoorControl').parent().bootstrapSwitch('status'))
				return false;
				if(data.value === false){
					md.getContent().find('.navbar ul li.opt_2_1').show();
					md.getContent().find('.navbar ul li#Relay_Tab_7 .number').html('5');
			}else{
				md.getContent().find('.navbar ul li.opt_2_1').hide();
				md.getContent().find('.navbar ul li#Relay_Tab_7 .number').html('4');
			}
		});
		if(objRelay.relay['1'].portals.length === 2 && objRelay.relay['2'].portals.length === 2)
			md.getContent().find('#Opt2_Comportamento').parent().bootstrapSwitch('setState', true);
		else
			md.getContent().find('#Opt2_Comportamento').parent().bootstrapSwitch('setState', false);

		md.getContent().find('#Opt2_DoorRelay').parent().bootstrapSwitch();
		md.getContent().find('#Opt2_DoorRelay').parent().bootstrapSwitch('setState', objRelay.relay['1'].portals.indexOf(-1) >= 0);

		md.getContent().find('#Opt2_DoorTimeout_1').val(objRelay.relay['1'].timeout);
		md.getContent().find('#Opt2_Relay1AutoClose').parent().bootstrapSwitch();
		md.getContent().find('#Opt2_Relay1AutoClose').parent().bootstrapSwitch('setState', objRelay.relay['1'].auto_close === 1)
		md.getContent().find('#Opt2_DoorTimeout_2').val(objRelay.relay['2'].timeout);
		md.getContent().find('#Opt2_Relay2AutoClose').parent().bootstrapSwitch();
		md.getContent().find('#Opt2_Relay2AutoClose').parent().bootstrapSwitch('setState', objRelay.relay['2'].auto_close === 1)

	});
}

var modal_relayEdit = $('#modal_relayEdit').clone().end().remove();
function openRelayModal(){
	var md = new Modal();
	md.setTitle('Relays');
	md.setHTMLContent(modal_relayEdit);
	md.addButton([
		{
			'type' : 'save',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	var warning_modal = new Modal();
	warning_modal.setTitle('Relays');
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);

	function save(returnMessage) {
		var relay1Status = '0';
		var relay2Status = '0';
		var relay1Dir = 'right';
		var relay2Dir = 'right';

		if (md.getContent().find('#chkRelay1Status').parent().hasClass('switch-on')) {
			relay1Status = '1';
		}

		if (md.getContent().find('#chkRelay2Status').parent().hasClass('switch-on')) {
			relay2Status = '1';
		}

		if (md.getContent().find('#chkRelay1Dir').parent().hasClass('switch-on')) {
			relay1Dir = 'left';
		}

		if (md.getContent().find('#chkRelay2Dir').parent().hasClass('switch-on')) {
			relay2Dir = 'left';
		}

		const data = MessengerUtil.send(
			'set_configuration',
			{
				sec_box: {
					catra_relay_1_enabled: relay1Status,
					catra_relay_2_enabled: relay2Status,
					catra_relay_1_enable_direction: relay1Dir,
					catra_relay_2_enable_direction: relay2Dir
				}
			}
		);

		if (data.error) {
			return returnMessage(data.error);
		} else {
			return returnMessage(null);
		}
	}

	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show(function(){
			var data = MessengerUtil.send('get_configuration', {
				sec_box: ['catra_relay_1_enabled', 'catra_relay_2_enabled', 'catra_relay_1_enable_direction', 'catra_relay_2_enable_direction']
			});

			md.getContent().find('#chkRelay1Status').parent().bootstrapSwitch();
			md.getContent().find('#chkRelay1Status').parent().bootstrapSwitch('setState', data.sec_box.catra_relay_1_enabled === '1');
			md.getContent().find('#chkRelay2Status').parent().bootstrapSwitch();
			md.getContent().find('#chkRelay2Status').parent().bootstrapSwitch('setState', data.sec_box.catra_relay_2_enabled === '1');
			md.getContent().find('#chkRelay1Dir').parent().bootstrapSwitch();
			md.getContent().find('#chkRelay1Dir').parent().bootstrapSwitch('setState', data.sec_box.catra_relay_1_enable_direction === 'left');
			md.getContent().find('#chkRelay2Dir').parent().bootstrapSwitch();
			md.getContent().find('#chkRelay2Dir').parent().bootstrapSwitch('setState', data.sec_box.catra_relay_2_enable_direction === 'left');

			if (md.getContent().find('#chkRelay1Status').parent().bootstrapSwitch('status')) {
				md.getContent().find('#relay1DirBtn').show();
			} else {
				md.getContent().find('#relay1DirBtn').hide();
			}

			if (md.getContent().find('#chkRelay2Status').parent().bootstrapSwitch('status')) {
				md.getContent().find('#relay2DirBtn').show();
			} else {
				md.getContent().find('#relay2DirBtn').hide();
			}

			md.getContent().find('#chkRelay1Status').parent().parent().on('switch-change', function (e, data) {
				if (md.getContent().find('#chkRelay1Status').parent().bootstrapSwitch('status')) {
					md.getContent().find('#relay1DirBtn').show();
				} else {
					md.getContent().find('#relay1DirBtn').hide();
				}
			});

			md.getContent().find('#chkRelay2Status').parent().parent().on('switch-change', function (e, data) {
				if (md.getContent().find('#chkRelay2Status').parent().bootstrapSwitch('status')) {
					md.getContent().find('#relay2DirBtn').show();
				} else {
					md.getContent().find('#relay2DirBtn').hide();
				}
			});

		});
	}
}

function verifyMask(maskedString){
	var ipformat =	/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
	if(maskedString.match(ipformat))
	{
		return true;
	}
	else
	{
		return false;
	}
}

var modal_Reboot = $('#modal_Reboot').clone().end().remove();
function rebootDevice(){
	var md = new Modal();
	md.setTitle('Reboot');
	md.setHTMLContent(modal_Reboot);
	md.addButton([
		{
			'type' : 'save',
			'text' : 'Save and Reboot',
			'callback': save_and_reboot
		},
		{
			'type' : 'ok',
			'text' : 'Reboot',
			'callback': reboot
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show(function() {
		var data = MessengerUtil.send('get_configuration', {
			general: [ 'auto_reboot', 'auto_reboot_hour', 'auto_reboot_minute', 'auto_reboot_days' ]
		});

		md.getContent().find('#input_auto_reboot').parent().bootstrapSwitch();
		md.getContent().find('#input_auto_reboot').parent().bootstrapSwitch('setState', data.general.auto_reboot === '1');
		md.getContent().find('#input_reboot_hour')[0].value = ((data.general.auto_reboot_hour).length === 1) ?
			"0" + data.general.auto_reboot_hour : data.general.auto_reboot_hour;
		md.getContent().find('#input_reboot_minute')[0].value = ((data.general.auto_reboot_minute).length === 1) ?
			"0" + data.general.auto_reboot_minute : data.general.auto_reboot_minute;

		md.getContent().find('#chkSunday').parent().bootstrapSwitch();
		md.getContent().find('#chkSunday').parent().bootstrapSwitch('setState', data.general.auto_reboot_days[0] === '1');
		md.getContent().find('#chkMonday').parent().bootstrapSwitch();
		md.getContent().find('#chkMonday').parent().bootstrapSwitch('setState', data.general.auto_reboot_days[1] === '1');
		md.getContent().find('#chkTuesday').parent().bootstrapSwitch();
		md.getContent().find('#chkTuesday').parent().bootstrapSwitch('setState', data.general.auto_reboot_days[2] === '1');
		md.getContent().find('#chkWednesday').parent().bootstrapSwitch();
		md.getContent().find('#chkWednesday').parent().bootstrapSwitch('setState', data.general.auto_reboot_days[3] === '1');
		md.getContent().find('#chkThursday').parent().bootstrapSwitch();
		md.getContent().find('#chkThursday').parent().bootstrapSwitch('setState', data.general.auto_reboot_days[4] === '1');
		md.getContent().find('#chkFriday').parent().bootstrapSwitch();
		md.getContent().find('#chkFriday').parent().bootstrapSwitch('setState', data.general.auto_reboot_days[5] === '1');
		md.getContent().find('#chkSaturday').parent().bootstrapSwitch();
		md.getContent().find('#chkSaturday').parent().bootstrapSwitch('setState', data.general.auto_reboot_days[6] === '1');
	});

	function reboot() {
		var md2 = new Modal();
		md2.setTitle('Reboot');
		md2.setContent('Are you sure you want to reboot the device?');
		md2.addButton([
			{
				'type' : 'ok',
				'callback': function(){
					var time = 60;
					Main.sessionFail({error : 'customError'}, function(){
						setInterval(function(){
							time--;
							if(time == 0)
								window.location = 'login.html';
							$('#countReboot').html(('00' + time).slice(-2));
						}, 1000);

					}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
					MessengerUtil.sendAsync('reboot', null, null, false);
					return true;
				}
			},
			{
				'type' : 'cancel'
			}
		]);
		md2.show();
	}

	function save_and_reboot(returnMessage) {
		var reboot_hour = parseInt(md.getContent().find('#input_reboot_hour')[0].value, 10);
		var reboot_minute = parseInt(md.getContent().find('#input_reboot_minute')[0].value, 10);
		var reboot_days = (md.getContent().find('#chkSunday').parent().hasClass('switch-on') ? '1' : '0') +
						  (md.getContent().find('#chkMonday').parent().hasClass('switch-on') ? '1' : '0') +
						  (md.getContent().find('#chkTuesday').parent().hasClass('switch-on') ? '1' : '0') +
						  (md.getContent().find('#chkWednesday').parent().hasClass('switch-on') ? '1' : '0') +
						  (md.getContent().find('#chkThursday').parent().hasClass('switch-on') ? '1' : '0') +
						  (md.getContent().find('#chkFriday').parent().hasClass('switch-on') ? '1' : '0') +
						  (md.getContent().find('#chkSaturday').parent().hasClass('switch-on') ? '1' : '0')
		if (reboot_days == "0000000") {
			reboot_days = "1111111";
		}

		if (isNaN(reboot_hour) || reboot_hour < 0 || reboot_hour > 23) {
			return returnMessage("Invalid hour (must be between 0 and 23)");
		}
		if (isNaN(reboot_minute) || reboot_minute < 0 || reboot_minute > 59) {
			return returnMessage("Invalid minute (must be between 0 and 59)");
		}

		var data = MessengerUtil.send(
			'set_configuration',
			{
				general: {
					auto_reboot: md.getContent().find('#input_auto_reboot').parent().hasClass('switch-on') ? '1' : '0',
					auto_reboot_hour: reboot_hour.toString(),
					auto_reboot_minute: reboot_minute.toString(),
					auto_reboot_days: reboot_days
				}
			}
		)
		if (data.error !== undefined) {
			return returnMessage(data.error);
		}
		reboot();
		return returnMessage(null);
	}
}

function rebootAndCalibrate(){
	var md = new Modal();
	md.setTitle('Calibrate Screen');
	md.setContent('Are you sure you want to reboot the device in calibration mode?');
	md.addButton([
		{
			'type' : 'ok',
			'callback': function(){
				var time = 60;
				Main.sessionFail({error : 'customError'}, function(){
					setInterval(function(){
						time--;
						if(time == 0)
							window.location = 'login.html';
						$('#countReboot').html(('00' + time).slice(-2));
					}, 1000);

				}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
				MessengerUtil.sendAsync('reset_and_calibrate', null, null, false);
				return true;
			}
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show();
}

function updateFirmware(){
	var md = new Modal();
	md.setTitle('Firmware Update');
	md.setContent('Are you sure you wish to reboot the equipment in Firware Update Mode?');
	md.addButton([
		{
			'type' : 'ok',
			'callback': function(){
				var time = 30;
				Main.sessionFail(
					{error : 'customError'},
					function () {
						var data = MessengerUtil.send('system_information', null, null, false);
						setInterval(function(){
							window.location = 'http://' + data.network.ip + ':' + data.network.web_server_port;
						}, 30000);
						setInterval(function(){
							time--;
							$('#countReboot').html(('00' + time).slice(-2));
						}, 1000);
					},
					'Update!',
					'Firmware Update',
					'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.',
					true
				);
				MessengerUtil.sendAsync('reboot_recovery', null, null, false);
				return true;
			}
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show();
}

function transform255to65000(stringVal){
	return ( Math.round(65535 * parseInt(stringVal) / 255)).toString();
}

function transform65000to255(stringVal){
	return Math.round(255 * parseInt(stringVal) / 65535);
}

function verifyRGBNumber(rgbInput){
	if((isNaN(parseInt(rgbInput.value)) && rgbInput.value!= "") || rgbInput.value > 255 || rgbInput.value < 0){
		rgbInput.value = 0;
		//window.alert("O valor deve estar entre 0 e 255!")
	}
}

function verifyRelayTimeoutInput (relay1_timeout, relay2_timeout){
	if(relay1_timeout == "" || isNaN(parseInt(relay1_timeout)) || parseInt(relay1_timeout) > 600000 || relay2_timeout == "" || parseInt(relay2_timeout) > 600000 || isNaN(parseInt(relay2_timeout)))
		return false;
	return true;
}

function parseDateXmlToWeb(strdate){
	if(strdate == '')
		return null;
	else
		return new Date(strdate.substr(4,4), ('00' + (parseInt(strdate.substr(2,2))-1)).slice(-2),	strdate.substr(0,2)) ;
}

function parseDateWebToXml(strdate){
	strdate = strdate.replace('/', '').replace('/', '');
	return strdate.substr(0,2) + strdate.substr(2,2) + strdate.substr(4,4);
}

function removeAdmins(){
	var md = new Modal();
	md.setTitle('Remove Admins');
	md.setContent('Are you sure you want to remove all administrators?');
	md.addButton([
		{
			'type' : 'ok',
			'callback': function(){
				MessengerUtil.send('delete_admins', null, null, false);
				md.close();
			}
		},
		{
			'type' : 'cancel'
		}
	]);
	var warning_modal = new Modal();
	warning_modal.setTitle(md.getTitle());
	warning_modal.setContent('Functionality available only for equipment in primary mode');
	warning_modal.addButton([
		{
			'type' : 'ok'
		}
	]);
	if(Main.isiDBlockNextSecondary()) {
		warning_modal.show();
	} else {
		md.show();
	}
}

function getFormatedDate() {
	const todayDate = new Date();
	var day = todayDate.getDate();
	if (day <= 9) {
		day = '0' + day;
	}
	var month = todayDate.getMonth() + 1;
	if (month <= 9) {
		month = '0' + month;
	}
	var hour = todayDate.getHours();
	if(hour <= 9) {
		hour = '0' + hour;
	}
	var minute = todayDate.getMinutes();
	if(minute <= 9) {
		minute = '0' + minute;
	}

	var date = day + '-' + month +
		'-' + todayDate.getFullYear() + '_' + hour + '-' + minute;

	return date;
}

function openAcfwLog(){
	var md = new Modal();
	md.setTitle('Diagnostic Logs');
	md.setContent('Do you want to export diagnostic logs?');
	md.addButton([
		{
			'type' : 'ok',
			'callback': function(){
				var date = getFormatedDate();
				var dataSystem = MessengerUtil.send('system_information', null, null, false);
				var fileName = 'ACFW_log_V' + dataSystem.version + '_' +
					dataSystem.serial.replace('/', '-') + '_' + date + '.zip';
				var xhr = new XMLHttpRequest();
				xhr.open('POST', '/get_ac_log.fcgi', true);
				xhr.responseType = 'arraybuffer';
				xhr.onload = function() {
					if (xhr.status === 200) {
						var blob = new Blob([xhr.response], { type: 'application/zip' });
						var url = window.URL.createObjectURL(blob);
						var a = document.createElement('a');
						a.href = url;
						a.download = fileName;
						a.style.display = 'none';
						document.body.appendChild(a);
						a.click();
						window.URL.revokeObjectURL(url);
						document.body.removeChild(a);
					}
				};
				xhr.send();
				md.close();
			}
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show();
}

function openAuditLogs(){
	var md = new Modal();
	md.setTitle('Export Audit Logs');
	md.setHTMLContent($('#modal_auditLogs'));
	md.addButton([
		{
			'type' : 'save',
			'callback': function(returnMessage){
				var configIncluded = md.getContent().find('#chkButtonIncludeConfig').parent().hasClass('switch-on') ? 1 : 0;
				var apiIncluded = md.getContent().find('#chkButtonIncludeAPI').parent().hasClass('switch-on') ? 1 : 0;
				var usbIncluded = md.getContent().find('#chkButtonIncludeUSB').parent().hasClass('switch-on') ? 1 : 0;
				var networkIncluded = md.getContent().find('#chkButtonIncludeNetwork').parent().hasClass('switch-on') ? 1 : 0;
				var timeIncluded = md.getContent().find('#chkButtonIncludeTime').parent().hasClass('switch-on') ? 1 : 0;
				var onlineIncluded = md.getContent().find('#chkButtonIncludeOnline').parent().hasClass('switch-on') ? 1 : 0;
				var menuIncluded = md.getContent().find('#chkButtonIncludeMenu').parent().hasClass('switch-on') ? 1 : 0;
				var bootIncluded = md.getContent().find('#chkButtonIncludeBoot').parent().hasClass('switch-on') ? 1 : 0;
				var pushIncluded = md.getContent().find('#chkButtonIncludePush').parent().hasClass('switch-on') ? 1 : 0;

				var data = MessengerUtil.send('export_audit_logs', {
					config: configIncluded,
					api: apiIncluded,
					usb: usbIncluded,
					network: networkIncluded,
					time: timeIncluded,
					online: onlineIncluded,
					menu: menuIncluded,
					boot: bootIncluded,
					push: pushIncluded
				});
				if (data.error !== undefined) {
					return returnMessage(data.error);
				}
				var date = getFormatedDate();
				var dataSystem = MessengerUtil.send('system_information', null, null, false);
				var dataFirmware = dataSystem.version
				var dataSerial = dataSystem.serial;
				dataSerial = dataSerial.replace('/','-');
				var fileName = 'Audit_Logs_' + 'V' + dataFirmware + '_' + dataSerial + '_' + date + '.txt';
				saveTextAsFile(fileName, data);
				return returnMessage(null);
			}
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show(function(){
		md.getContent().find('#chkButtonIncludeConfig').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonIncludeConfig').parent().bootstrapSwitch('setState', true);
		md.getContent().find('#chkButtonIncludeAPI').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonIncludeAPI').parent().bootstrapSwitch('setState', true);
		md.getContent().find('#chkButtonIncludeUSB').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonIncludeUSB').parent().bootstrapSwitch('setState', true);
		md.getContent().find('#chkButtonIncludeNetwork').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonIncludeNetwork').parent().bootstrapSwitch('setState', true);
		md.getContent().find('#chkButtonIncludeTime').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonIncludeTime').parent().bootstrapSwitch('setState', true);
		md.getContent().find('#chkButtonIncludeOnline').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonIncludeOnline').parent().bootstrapSwitch('setState', true);
		md.getContent().find('#chkButtonIncludeMenu').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonIncludeMenu').parent().bootstrapSwitch('setState', true);
		md.getContent().find('#chkButtonIncludeBoot').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonIncludeBoot').parent().bootstrapSwitch('setState', true);
		md.getContent().find('#chkButtonIncludePush').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonIncludePush').parent().bootstrapSwitch('setState', true);
	});
}

function reset_to_factory_default(){
	var md = new Modal();
	md.setTitle('Restore Factory Settings');
	md.setHTMLContent($('#modal_resetEdit'));
	md.addButton([
		{
			'type' : 'ok',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);
	md.show(function(){
		md.getContent().find('#chkButtonKeepNet').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonKeepNet').parent().bootstrapSwitch('setState', false);
		md.getContent().find("#chkButtonKeepNet").parent().parent().on('switch-change', function(e, data) {
			if (data.value) {
				md.getContent().find('#chkButtonKeepAll').parent().bootstrapSwitch('setState', !data.value);
			}
		});

		md.getContent().find('#chkButtonKeepAll').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonKeepAll').parent().bootstrapSwitch('setState', false);
		md.getContent().find("#chkButtonKeepAll").parent().parent().on('switch-change', function(e, data) {
			if (data.value) {
				md.getContent().find('#chkButtonKeepNet').parent().bootstrapSwitch('setState', !data.value);
			}
		});
		md.getContent().find('#chkButtonResetLicense').parent().bootstrapSwitch();
		md.getContent().find('#chkButtonResetLicense').parent().bootstrapSwitch('setState', false);
		md.getContent().find("#chkButtonResetLicense").parent().parent().on('switch-change', function(e, data) {
			if (data.value) {
				md.getContent().find('#chkButtonKeepAll').parent().bootstrapSwitch('setState', !data.value);
			}
		});
	});

	function save () {
		let keep_network_info = md.getContent().find('#chkButtonKeepNet').parent().bootstrapSwitch('status')? true : false;
		let keep_all_config = md.getContent().find('#chkButtonKeepAll').parent().bootstrapSwitch('status') ? true : false;
		let reset_license = md.getContent().find('#chkButtonResetLicense').parent().bootstrapSwitch('status')? true : false;
		let data = MessengerUtil.send(
			'reset_to_factory_default',
			{
				'keep_network_info': keep_network_info,
				'keep_all_config': keep_all_config,
				'reset_license': reset_license
			}
		);
		md.close();
		let rebootAlert = new Modal();
		rebootAlert.setTitle('Restore factory settings');
		rebootAlert.setContent('Rebooting device');
		rebootAlert.show();
		setTimeout(function () {
			let time = 60;
			Main.sessionFail({error: 'customError'}, function () {
				setInterval(function () {
					time--;
					if (time === 0)
						window.location = 'login.html';
					$('#countReboot').html(('00' + time).slice(-2));
				}, 1000);

			}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
		}, 10000);
	}
}
var energyData;
var modal_screenEnergy = $('#modal_screenEnergy').clone().end().remove();
function openEnergyModal(){
	var md = new Modal();
	md.setTitle('Power settings');
	md.setHTMLContent(modal_screenEnergy);
	md.addButton([
		{
			'type' : 'ok',
			'callback': save
		},
		{
			'type' : 'cancel'
		}
	]);

	md.show(function(){
		var data = MessengerUtil.send('get_energy_data');
		energyData = data;
		var ratioUpdate = function() {
			var allMax = 0.0
			var allCur = 0.0
			for (let item of data.itens) {
				allMax += data[item].max * data[item].weigth
				allCur += parseInt(md.getContent().find('#energy_' + item)[0].value) * data[item].weigth
			}
			var ratio = parseInt((allCur / allMax) * 100);
			md.getContent().find('#energy_use').css({ width: ratio + '%' });
		};
		var onModeChanged = function() {
			var mode = "default"
			var disable = true
			if (md.getContent().find('#energy_mode_0').is(':checked')) {
				data.mode = '0'
				mode = "default"
			} else if (md.getContent().find('#energy_mode_1').is(':checked')) {
				data.mode = '1'
				mode = "source_2a"
			} else if (md.getContent().find('#energy_mode_2').is(':checked')) {
				data.mode = '2'
				mode = "poe_locker"
			} else {
				data.mode = '3'
				mode = "custom"
				disable = false
			}

			for (let item of data.itens) {
				var item_data = data[item]
				var value = parseInt(item_data.max) * parseFloat(item_data[mode])
				md.getContent().find('#energy_' + item).attr('disabled', disable);
				md.getContent().find('#energy_' + item).attr('max', parseInt(item_data.max));
				md.getContent().find('#energy_' + item)[0].value = value
				md.getContent().find('#var_energy_' + item)[0].value = value
			}
			ratioUpdate();

		};
		md.getContent().find('#energy_display').on('input', ratioUpdate);
		md.getContent().find('#energy_sound').on('input', ratioUpdate);
		md.getContent().find('#energy_ir').on('input', ratioUpdate);
		md.getContent().find('#energy_led').on('input', ratioUpdate);
		md.getContent().on('change', 'input[name=energy_mode]', onModeChanged);
		var mode = "#energy_mode_" + data.mode;
		md.getContent().find(mode).attr('checked','checked');
		onModeChanged();
	});

	function save () {
		var warning = new Modal();
		warning.setTitle('Confirmation');
		warning.setContent('The current brightness/volume/intensity settings may be changed if the current value is greater than the new maximum. Continue?');
		warning.addButton([
			{
				'type': 'ok',
				'callback': function () {
					var data = energyData;
					for (let item of data.itens) {
						var value = parseFloat(md.getContent().find('#energy_' + item)[0].value) / parseFloat(data[item].max)
						data[item].custom = value.toString();
					}
					var param = {}
					param['general'] = {}
					param['general']['energy_display_custom'] = data.display.custom;
					param['general']['energy_sound_custom'] = data.sound.custom;
					param['general']['energy_ir_custom'] = data.ir.custom;
					param['general']['energy_led_custom'] = data.led.custom;
					param['face_module'] = {}
					var value = data.ir.custom * data.ir.max * 10
					param['face_module']['led_ir_brightness'] = value.toString();


					if ((parseFloat(data.display.custom) * parseFloat(data.display.max)) < data.brightness) {
						var value = data.display.custom * data.display.max
						param['general']['screen_brightness'] = value.toString();
					}
					if ((parseFloat(data.sound.custom) * parseFloat(data.sound.max)) < data.volume) {
						var value = data.sound.custom * data.display.max;
						param['pjsip'] = {}
						param['pjsip']['speaker_volume'] = value.toString();
					}
					if ((parseFloat(data.led.custom) * parseFloat(data.led.max)) < (data.led_white / 10)) {
						var value = data.led.custom * data.led.max * 10;
						param['led_white'] = {}
						param['led_white']['brightness'] = value.toString();
					}
					param['general']['energy_mode'] = data.mode;

					MessengerUtil.send('set_configuration', param);
					warning.close();
					var md2 = new Modal();
					md2.setContent("Settings saved!");
					md2.addButton([
						{
							'type' : 'ok',
							'callback' : function () {
								md.close();
								md2.close();
							}
						}
					]);
					md2.show();
				}
			},
			{
				'type': 'cancel',
				'callback': function () {
					warning.close();
				}
			}
		]);
		warning.show();
	}
}

function dateFormatCorrect(strDate){
	if(strDate.length != 10)
		return false;

	var dateFormat = /^(0?[1-9]|[12][0-9]|3[01])[\/\-](0?[1-9]|1[012])[\/\-]\d{4}$/;
	if(strDate.match(dateFormat))
		return true;
	return false;
}

function timeFormatCorrect(strTime, clock12hFormat){
	var timeFormat = /^(?:2[0-3]|[01][0-9]):[0-5][0-9]:[0-5][0-9]$/;
	if (clock12hFormat) {
		timeFormat = /^(?:1[0-2]|0[1-9]):[0-5][0-9]:[0-5][0-9] [AP]M$/;
	}
	if(strTime.match(timeFormat))
		return true;
	return false;
}

function disableInterface(){
	var md2 = new Modal();
	md2.setTitle('Disable Web Interface');
	md2.setContent('Attention! When saving this configuration the Web interface will become inaccessible.'
        + '<br> Use the display menu or the API to reactivate the Web interface if necessary');
	md2.addButton([
		{
			'type' : 'ok',
			'callback': function(){
				MessengerUtil.send('set_configuration', {
					general: {web_server_enabled: '0'}
				});
				var time = 60;
				Main.sessionFail({error : 'customError'}, function(){
					setInterval(function(){
						time--;
						if(time == 0)
							window.location = 'login.html';
						$('#countReboot').html(('00' + time).slice(-2));
					}, 1000);

				}, 'Wait!', 'Rebooting Equipment', 'Wait <span id="countReboot">' + ('00' + time).slice(-2) + '</span> seconds for the equipment to reboot.', true);
				MessengerUtil.sendAsync('reboot', null, null, false);
				return true;
			}
		},
		{
			'type' : 'cancel'
		}
	]);
	md2.show();
}
