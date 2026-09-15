var cameraStatus = 0;
var video;
var btFoto = null;
var lDefChange = true;
var canvas;
var lstLoadedTemplates = [];
var lstLoadedFaceTemplates = [];
var lstLoadedDuressTemlates = [];
var totalCount = 0;
var totalCountFace = 0;
var totalDuressCount = 0;
var md;
var imgShown;
var closeAndRefreshTable = false;
var auto;
var initialTime = 5;
var timerCapture;
var identificationThreshold = 0;

function refreshCount(){
	md.getContent().find('#num_fingerprint').val(('00' + totalCount).slice(-2));
	md.getContent().find('#num_duress_fingerprint').val(('00' + totalDuressCount).slice(-2));
	md.getContent().find('#num_face').val(('00' + totalCount).slice(-2));
}

function refreshCountFace() {
	if (totalCountFace > 0) {
		md.getContent().find('#face_ok').show();
		md.getContent().find('#face_not_ok').hide();
	}
	else {
		md.getContent().find('#face_ok').hide();
		md.getContent().find('#face_not_ok').show();
	}
}

function refreshUserFace() {
	var uid = $('#id').val();
	$('#foto').attr('src', '/user_get_image.fcgi?user_id=' + uid);
	closeAndRefreshTable = true;
}

function toggleVisibilityPIN () {
	var eyeIcon = document.getElementById("pin_entry-eye");
	var PINInput = document.getElementById("pin_entry_text");

	if (PINInput.type === "password") {
		PINInput.type = "text";
		eyeIcon.classList.remove("icon-eye-open");
		eyeIcon.classList.add("icon-eye-close");
	} else {
		PINInput.type = "password";
		eyeIcon.classList.remove("icon-eye-close");
		eyeIcon.classList.add("icon-eye-open");
	}
}

function toggleAdvancedFaceConfigs() {
	var advConfigs = $('#advanced-face-configs');
	if (advConfigs.css('display') === 'none') {
		advConfigs.show();
	}
	else {
		advConfigs.hide();
	}
}

function getFaceIdentificationThreshold() {
  const identification_strictness_threshold = 3000;
  var thresholdConfig = MessengerUtil.send(
    "get_configuration",
    {
      face_id : ['identification_score_threshold', 'identification_score_threshold_strict']
    }, null, true
  );
  var dataLoad = MessengerUtil.send(
    "load_objects",
    {
      "object": "users",
      "fields": ["COUNT(*)"],
      "where": [
          {
            "object": "users",
            "field": "image_timestamp",
            "operator": "<>",
            "value": 0,
          }
      ]
    }, null, true
  );
  if (dataLoad.users[0]['COUNT(*)'] > identification_strictness_threshold) {
    return parseFloat(thresholdConfig.face_id.identification_score_threshold_strict);
  }
  else {
    return parseFloat(thresholdConfig.face_id.identification_score_threshold);
  }
}

function loadCustomThreshold(user_id) {
  var result = MessengerUtil.send(
    "load_objects",
    {
      'object' : 'custom_thresholds',
      'fields' : ['threshold'],
      'where' : [{
        'object' : 'custom_thresholds',
        'field' : 'user_id',
        'value' : user_id
      }]
    }, null, true
  );
  return (result.custom_thresholds.length > 0) ? result.custom_thresholds[0].threshold : 0;
}

function initCustomThreshold(currentValue) {
  identificationThreshold = getFaceIdentificationThreshold() * 1000;
  $('#curCustomThreshold').html("Value: " + (currentValue ? currentValue : identificationThreshold));
  var slider = $('#inputCustomThreshold');
  slider.attr('min', identificationThreshold);
  slider.attr('max', 2000);
  slider.attr('value', currentValue);
  slider.on("input change", function() {
    $('#curCustomThreshold').html("Value: " + this.value);
  });
}

var _type_all = false;

BeforeLoad(function () {
	var queryString = {};
	window.location.search.substr(1).split('&').forEach(function(param){
		var args = param.split('=');
		if(args.length === 2)
			queryString[args[0]] = args[1];
	});

	_type_all = queryString['all'] == 'true';
	$("#BREADCRUMB").attr("nivel", 'usuIdaccess');

});

LoadPage(function(){
	//initUsersPage();
	var PINTab = $('#users_pin').clone().end().remove();
  	var biometricModalTab = $('#template_devices').clone().end().remove();
	var faceModalTab = $('#face_template_devices').clone().end().remove();
	var webLoginModalTab = $('#web_login').clone().end().remove();
	var openingTimesTab = $('#opening_times').clone().end().remove();

	var data = MessengerUtil.send(
		'get_configuration',
		{
			'identifier': ['multi_factor_authentication'],
			'osdp': ['enabled', 'out_mode'],
			'sec_box': ['out_mode'],

		}
	);
	
	var passthroughOn;
	if (data.osdp.enabled === '1') {
		passthroughOn = data.osdp.out_mode === '2';
	} else {
		passthroughOn =data.sec_box.out_mode === 'RELAY_CARD' || data.sec_box.out_mode === 'RELAY_CARD_WITH_READER_FEEDBACK';
	}

	var showOnlyToC = passthroughOn && data.identifier.multi_factor_authentication === "2";

	var tbl = new Table($('#tbl_teste'), _type_all ? users : default_user,
		{
			'modal' :{
				'open' : function(modal){
					var deletedTemplates = false;
					var deletedDuressTemplates = false;
					md = modal;

					// Enable tab and get user's PIN, if it exists
					modal.addHTMLTab(PINTab);
					var data = MessengerUtil.send(
						"load_objects",
						{
							'object' : 'pins',
							'fields' : ['value'],
							'where' : [{
								'object' : 'pins',
								'field' : 'user_id',
								'value' : modal.getObject().id
							}]
						}, null, true
					);
					if (data.pins.length > 0) {
						modal.getContent().find('#pin_entry_text')[0].value = data.pins[0].value;
					}
					modal.getContent().find('#pin_entry_text').on("change keyup paste click", function(){
						var pin_value = modal.getContent().find('#pin_entry_text')[0].value;
						if (pin_value === undefined || pin_value === null) {
							$('#pin_validation_error_text').show();
						} else if (pin_value === "" || (!isNaN(pin_value) && parseInt(pin_value) >= 0 && pin_value !== "001818")) {
							// PIN validated (a priori). This eliminates decimal numbers (if applicable)
							modal.getContent().find('#pin_entry_text')[0].value = (pin_value.split('.')[0] || pin_value);
							$('#pin_validation_error_text').hide();
						} else {
							$('#pin_validation_error_text').show();
						}
					});

					modal.addHTMLTab(faceModalTab);
					if(Main.hasBiometricIhm()) {
						modal.addHTMLTab(biometricModalTab);
					}
					modal.getContent().find('#chkEnrollmode').parent().bootstrapSwitch();
					modal.getContent().find('#chkEnrollmode').parent().bootstrapSwitch('setState', auto == '0');
					modal.getContent().find('#txtCountdown')[0].value = initialTime;
					initCustomThreshold(loadCustomThreshold(modal.getObject().id));

					if (auto !=='0'){
						modal.getContent().find('#countdownsetup').show('slow');
						timerCapture = parseInt(modal.getContent().find('#txtCountdown')[0].value);
					}

					modal.getContent().find('#chkEnrollmode').parent().parent().on('switch-change', function (e, data) {
						if (modal.getContent().find('#chkEnrollmode').parent().bootstrapSwitch('status')) {
							modal.getContent().find('#countdownsetup').hide('slow');
							auto = modal.getContent().find('#chkEnrollmode').parents().hasClass('switch-on') ? '0' : '1';
							timerCapture = parseInt(modal.getContent().find('#txtCountdown')[0].value);
						} else {
							modal.getContent().find('#countdownsetup').show('slow');
							auto = modal.getContent().find('#chkEnrollmode').parents().hasClass('switch-on') ? '0' : '1';
						}
					});
					modal.getContent().find('#countdownsetup').on("change keyup paste click", function(){
						timerCapture = parseInt(modal.getContent().find('#txtCountdown')[0].value);
					});

					if (Main.isServer())
						modal.addHTMLTab(webLoginModalTab);

					template_number = 0;
					$templates = [];
					totalCount = 0;
					totalDuressCount = 0;
					for (var key in modal.getObject().templates) {
						var template = modal.getObject().templates[key];
						if (template.finger_type == 1)
							totalDuressCount++;
						else
							totalCount++;
					}
					refreshCount();
					lstLoadedTemplates = [];
					lstLoadedFaceTemplates = [];
					lstLoadedDuressTemlates = [];

					var lstMyTemplates = modal.getObject().templates;
					for(var key in lstMyTemplates){
						var template = lstMyTemplates[key];
						if (template.finger_type === 1)
							lstLoadedDuressTemlates.push({
								'isNew' : false,
								'add' : true,
								'object' : template
							});
						else
							lstLoadedTemplates.push({
								'isNew' : false,
								'add' : true,
								'object' : template
							});
					}

					var lstMyFaceTemplates = modal.getObject().face_templates;
					for(var key in lstMyFaceTemplates){
						var face_template = lstMyFaceTemplates[key];
						lstLoadedFaceTemplates.push({
							'isNew' : false,
							'add' : true,
							'object' : face_template
						});
					}
					totalCountFace = lstLoadedFaceTemplates.length;
					refreshCountFace();

					modal.getContent().find("#delDigitais").click(function () {
						if (!deletedTemplates) {
							lstLoadedTemplates.forEach(function(item){
								item.add = false;
								item.isNew = true;
							});
							totalCount -= lstLoadedTemplates.length;
							refreshCount();
							deletedTemplates = true;
						}
					});

					modal.getContent().find("#delDuressDigitais").click(function () {
						if (!deletedDuressTemplates) {
							lstLoadedDuressTemlates.forEach(function(item){
								item.add = false;
								item.isNew = true;
							});
							totalDuressCount -= lstLoadedDuressTemlates.length;
							refreshCount();
							deletedDuressTemplates = true;
						}
					});
					if (Main.isServer()){
						modal.getContent().find("#txt_web_login").val(modal.getObject().api_logins.login);
						modal.getContent().find("#txt_web_password").val(modal.getObject().api_logins.password);
					}
					if (Main.isIdAccess() || Main.isIdBoxController()) {
						var user_id = modal.getObject().id;
						var data = MessengerUtil.send(
							"load_objects",
							{
								'object' : 'opening_times',
								'fields' : ['id', 'user_id', 'door_id', 'time'],
								'where' : [{
									'object' : 'opening_times',
									'field' : 'user_id',
									'value' : user_id
								}],
								'order' : [{
									'object' : 'opening_times',
									'field' : 'door_id',
								}]
							}, null, true
						)
						modal.addHTMLTab(openingTimesTab);
						var number_of_doors;
						if (Main.isIdAccess()) {
							number_of_doors = 2;
							var times = ['', ''];
						}
						else {
							number_of_doors = 4;
							var times = ['', '', '', ''];
						}
						var door;
						for (door = 1; door <= number_of_doors; door++) {
							if (door <= data.opening_times.length) {
								times[data.opening_times[door - 1].door_id - 1] = data.opening_times[door - 1].time;
							}
							var field = $('<div class="span6" style="margin: 2px;"></div>');
							field.html(
								'<div class="control-group no-margin" validate="door_' + door + '">' +
									'<label class="control-label" disabled> Door ' + door + ' (ms)</label>' +
									'<div class="controls no-margin">' +
										'<input type="text" id="door_' + door + '" class="m-wrap span12" value="' + times[door - 1] + '" style="margin-bottom: 0;">' +
									'</div>' +
								'</div>'
							);
							modal.getContent().find("#opening_times").append(field);
						}
					}

					//Esconde o CPF, por nao estar em pt_BR 
					$('#cpf').parent().parent().parent().hide();


					if (!md.getObject().isLoaded) {
						$('#cpf').attr('disabled', true);
						var message = "Save the user to enable editing of all fields";

						var alert_HTML = $('<div id="alert" style="color: #dd0000; text-align: right">' +
							'<sup>(*)  </sup>' + message + '</div>');
						$('#tab_1').append(alert_HTML.clone());
					}

					$('#last_access').attr('disabled', true);
					$('#_last_access').attr('disabled', true);
					$('#start-click-last_access').css('background-color', '#f4f4f4');
					$('#start-click-_last_access').css('background-color', '#f4f4f4');

					md.close(function() {
						if (!closeAndRefreshTable)
							return;

						closeAndRefreshTable = false;
						tbl.reload();
					});
				},
				'save' : function(modal){
					var lst = [];
					$templates.forEach(function(lstTemplate){
						var tem = new templates();
						tem.user_id =  modal.getObject().id;
						tem.template = lstTemplate.data;
						tem.finger_type = lstTemplate.duress === true ? 1 : 0;
						lst.push({
							'isNew' : true,
							'add' : true,
							'object' : tem
						});
					});
					var newCustomThreshold = modal.getContent().find('#inputCustomThreshold').val();
					modal.getObject().templates = lstLoadedTemplates.concat(lstLoadedDuressTemlates).concat(lst);
					modal.getObject().face_templates = lstLoadedFaceTemplates;
					modal.getObject().values.pin = $('#pin_entry_text').val();
					modal.getObject().values.customThreshold = (newCustomThreshold == identificationThreshold)? 0 : newCustomThreshold;
					if (Main.isServer()){
						modal.getObject().api_logins.login = modal.getContent().find("#txt_web_login").val();
						modal.getObject().api_logins.password = modal.getContent().find("#txt_web_password").val();
					}
				}
			},
			'callbackRemove': function(lstRemove) {
				var dataImageRemove = {
					async: false,
					command: 'user_destroy_image',
					Json: {
						user_ids: lstRemove
					}
				};

				var dataUserRemove = {
					async: true,
					command: 'destroy_objects',
					Json: {
						object: 'users',
						where: { users: { id: lstRemove } }
					}
				};

				if (_type_all) {
					users.fn.sendJson(dataImageRemove);
					users.fn.sendJson(dataUserRemove);
				}
				else {
					default_user.fn.sendJson(dataImageRemove);
					default_user.fn.sendJson(dataUserRemove);
				}
			}
		}
	);


	if(showOnlyToC) {
		auto = '1';
		initialTime = 5;

		$('#tbl_teste').hide();

		var faceEnrollmentContainer = $('<div class="portlet box grey" style="margin-top: 20px;"></div>');
		var portletTitle = $('<div class="portlet-title"><div class="caption"><i class="icon-user" style="margin-left: 8px;"></i> Enroll Template on Card</div></div>');
		var portletBody = $('<div class="portlet-body"></div>');

		var faceContent = faceModalTab.clone();
		faceContent.show();

		faceContent.find('.tab-title').remove();
		faceContent.find('#advanced-face-configs-btn').remove()

		var enrollButton = faceContent.find('#enroll-face-btn');
		enrollButton.text('Start enrollment');
		enrollButton.addClass('green');

		portletBody.append(faceContent);

		faceEnrollmentContainer.append(portletTitle);
		faceEnrollmentContainer.append(portletBody);

		$('#tbl_teste').after(faceEnrollmentContainer);

		faceContent.find('#chkEnrollmode').parent().bootstrapSwitch();
		faceContent.find('#chkEnrollmode').parent().bootstrapSwitch('setState', auto == '0');
		faceContent.find('#txtCountdown')[0].value = initialTime;

		if (auto !=='0'){
			faceContent.find('#countdownsetup').show('slow');
			timerCapture = parseInt(faceContent.find('#txtCountdown')[0].value);
		}

		faceContent.find('#chkEnrollmode').parent().parent().on('switch-change', function (e, data) {
			if (faceContent.find('#chkEnrollmode').parent().bootstrapSwitch('status')) {
				faceContent.find('#countdownsetup').hide('slow');
				auto = faceContent.find('#chkEnrollmode').parents().hasClass('switch-on') ? '0' : '1';
				timerCapture = parseInt(faceContent.find('#txtCountdown')[0].value);
			} else {
				faceContent.find('#countdownsetup').show('slow');
				auto = faceContent.find('#chkEnrollmode').parents().hasClass('switch-on') ? '0' : '1';
				timerCapture = parseInt(faceContent.find('#txtCountdown')[0].value);
			}
		});
		faceContent.find('#countdownsetup').on("change keyup paste click", function(){
			timerCapture = parseInt(faceContent.find('#txtCountdown')[0].value);
		});

		video = document.getElementById('video');
		canvas = document.getElementById('canvas');
		if (canvas) {
			ctx = canvas.getContext('2d');
		}
		return;
	}

	tbl.load();
	video = document.getElementById('video');
	canvas = document.getElementById('canvas');
	ctx = canvas.getContext('2d');
});

var $templates = [];
var template_number = 0;
function CadastrarDigital(duress) {
	$('#imgDedo1').attr('src', "");
	$('#imgDedo1').attr('style', "display:none");
	$('#imgDedo2').attr('src', "");
	$('#imgDedo2').attr('style', "display:none");
	$('#imgDedo3').attr('src', "");
	$('#imgDedo3').attr('style', "display:none");
	$templates[template_number] = {
		duress: duress,
		data: []
	};
	var imageNumber = 0;
	var address = location.protocol === 'https:' ? "wss://localhost:8181/plugin" : "ws://localhost:8181/plugin";
	var socket = new WebSocket(address);
	var msg = {
		error: undefined,
		info: "Connecting to service...",
	}

	appLog(msg);

	socket.binaryType = "arraybuffer";

	socket.onerror = function(error) {
		//console.log('WebSocket Error: ' + error);


		var msg = {
			error: "Error while connecting to server",
			info: "",
		}

		appLog(msg);
	};

	socket.onopen = function(error) {
		socket.send('getfingerprint');
		var msg = {
		info: "Press the finger.",
		}
		appLog(msg);
	};

	socket.onmessage = function(event) {
		var message = event.data;
		if(event.data instanceof ArrayBuffer)
		{
			var bytearray = new Uint8Array(event.data);
			var tempcanvas = document.createElement('canvas');
			var imageheight = ((bytearray[0]   & 0xff) << 24) | ((bytearray[1] & 0xff) << 16) | ((bytearray[2] & 0xff) << 8) | (bytearray[3] & 0xff);
			var imagewidth = ((bytearray[4]   & 0xff) << 24) | ((bytearray[5] & 0xff) << 16) | ((bytearray[6] & 0xff) << 8) | (bytearray[7] & 0xff);
			tempcanvas.height = imageheight;
			tempcanvas.width = imagewidth;
			var tempcontext = tempcanvas.getContext('2d');

			var imgdata = tempcontext.getImageData(0,0,imagewidth,imageheight);
			var imgdatalen = imgdata.data.length;

			var j = 8;
			for(var i = 0;i < imgdatalen;i += 4)
			{
				imgdata.data[0 + i] = bytearray[j];
				imgdata.data[1 + i] = bytearray[j];
				imgdata.data[2 + i] = bytearray[j];
				j++;
				imgdata.data[3 + i] = 255;
			}

			tempcontext.putImageData(imgdata,0,0);

			var data = MessengerUtil.sendFile('template_extract', bytearray.subarray(8), 'width=' + imagewidth + '&height=' + imageheight);
			$templates[template_number].data[imageNumber] = atob(data.template);
			imageNumber++;

			$('#imgDedo' + imageNumber).attr('src', tempcanvas.toDataURL());
			$('#imgDedo' + imageNumber).attr('style', "display:initial");

			if(imageNumber===3){
				var msg = {
					info: "Enrolling..."
				};

				appLog(msg);
				var params;
				for(var j = 0; j < $templates[template_number].data.length; j++){
					params += '&size' + j + '=' + $templates[template_number].data[j].length;
				}

				var newtemplates = $templates[template_number].data.join('');
				var imgconcat = new Uint8Array(newtemplates.length);
				for(var k = 0; k < newtemplates.length; k++){
					imgconcat[k] = newtemplates.charCodeAt(k);
				};

				var template_test = MessengerUtil.sendFile('template_match', imgconcat, params);
				if('error' in template_test) {
					$templates[template_number].data = [];
					var error;
					switch (template_test.error) {
						case 'Template exists':
							error = 'Fingerprint already enrolled';
							break;
						case 'Different fingerprints':
							error = 'Fingerprints do not match';
							break;
						default:
							error = template_test.error;
							break;
					}

					var msg  = {
						count: imageNumber,
						quality: data.quality,
						info: error,
						success: false
					}
					appLog(msg);

				}
				else {
					if (duress)
						totalDuressCount++;
					else
						totalCount++;
					refreshCount();
					template_number++;
					var msg  = {
						count: imageNumber,
						quality: data.quality,
						template_number: template_number,
						success: true
					}
					appLog(msg);
				}
			}
			else {
				var msg  = {
					count: imageNumber,
					quality: data.quality
				}
				appLog(msg);
			}
		}
		else {
			var msg = {
				error: message
			}
			appLog(msg);
		}
	};
};

function enrollFaceOnDevice(type, duress){
	var hasUserContext = md && md.getObject && md.getObject();

	if(hasUserContext && !md.getObject().isLoaded) {
		var confirm = new Modal();
		confirm.setTitle('Enroll face on device');
		confirm.setContent('The user must be saved before faces can be enrolled in the device. Do you want to save the user?');
		confirm.addButton([
			{
				'type' : 'ok',
				'callback': function(){
					$("#btnSave").click();
					confirm.close();
				}
			},
			{
				'type' : 'cancel'
			}
		]);
		confirm.show();
		return;
	}

	if(hasUserContext) {
		lstLoadedFaceTemplates.forEach(function(item){
			item.add = false;
			item.isNew = true;
		});
		totalCountFace = 0;
		refreshCountFace();
		refreshUserFace();
	}

	if( typeof timerCapture === undefined || timerCapture === null ){
		timerCapture = 5;
	}

	var userId = hasUserContext ? md.getObject().id : 0;

	if(auto == '0'){
		var data = {
			type: type,
			save: true,
			user_id: userId,
		}
	} else {
		var data = {
			type: type,
			save: true,
			user_id: userId,
			auto: true,
			countdown: timerCapture,
		}
	}

	MessengerUtil.send('remote_enroll', data);
	var FaceRegistration = new Modal();
	FaceRegistration.setTitle("Remote registration");
	FaceRegistration.addContent("<h5>Get your face closer to the camera...</h5>");
	FaceRegistration.addButton([
		{
			'type' : 'cancel',
			'callback' : function() {
				MessengerUtil.send('cancel_remote_enroll');
				FaceRegistration.close();
			}
		},
		{
			'type' : 'ok',
			'callback': function(){
				enrollFaceOnDevice('face', false);
				FaceRegistration.close();
			}	
		}
	]);
	FaceRegistration.show();
	FaceRegistration.setContent("<h5>Registering Face</h5>");
	var enrollInterval = setInterval(function(){
		var enroller = MessengerUtil.send('enroller_state', null, null, false);

		if(enroller.enroller_state == "NORMAL_STATE"){
			if(enroller.last_enroll){
				clearInterval(enrollInterval);
				FaceRegistration.setContent("<h5>Face successfully registered.</h5>");
				if(md && md.getObject && md.getObject()) {
					refreshCountFace();
					refreshUserFace();
				}
				FaceRegistration.close();
			} else if(enroller.last_enroll_error == "UNKNOWN"){
				clearInterval(enrollInterval);
				FaceRegistration.setContent("<h5>Facial registration cancelled.</h5>");
				FaceRegistration.close();
			} else if(enroller.last_enroll_error == "FACE_EXISTS"){
				FaceRegistration.addContent("<h5>Error: Face already registered. Click 'Ok' to try again</h5>");
				clearInterval(enrollInterval); 
			}
			return;
		}

		if(enroller.enroller_state == "ENROLL_FACE_STATE") {
			FaceRegistration.setContent("<h5>Registration being processed</h5>");
			return;
		}

	}, 2000);
}

function enrollOnDevice(type, duress){
	if(!md.getObject().isLoaded){
		var confirm = new Modal();
		confirm.setTitle('Enroll Biometry on device');
		confirm.setContent('The user must be saved before fingerprints can be enrolled in the device. Do you want to save the user?');
		confirm.addButton([
			{
				'type' : 'ok',
				'callback': function(){
					$("#btnSave").click();
					confirm.close();
				}
			},
			{
				'type' : 'cancel'
			}
		]);
		confirm.show();
		return;
	}
	var data = {
		type: type,
		save: true,
		user_id: md.getObject().id,
		panic_finger: duress ? 1 : 0
	}
	MessengerUtil.send('remote_enroll', data);
	if (type == 'pin') {
		var pinregistration = new Modal();
		pinregistration.setTitle("Cadastro Remoto");
		pinregistration.addContent("<h5>Type the PIN...</h5>");
		pinregistration.addButton([
			{
				'type': 'cancel',
				'callback': function () {
					MessengerUtil.send('cancel_remote_enroll');
					pinregistration.close();
				}
			}
		]);
		pinregistration.show();

		var enrollInterval = setInterval(function () {
			var enroller = MessengerUtil.send('enroller_state', null, null, false);
			console.log(enroller.enroller_state);
			if (enroller.enroller_state == "NORMAL_STATE") {
				clearInterval(enrollInterval);
				pinregistration.setContent("<h5>PIN enrolled successfully.</h5>");
				if (duress)
					totalDuressCount++;
				else
					totalCount++;
				refreshCount();
				template_number++;
				var dataLoad = MessengerUtil.send('load_objects', {
					"object": "pins",
					"where": {
						"users": {
							"id": md.getObject().id
						}
					},
				});
				document.getElementById('pin_entry_text').value = dataLoad.pins[0].value;
				pinregistration.close();
				return;
			}

			if (enroller.enroller_state == "ENROLL_PIN_STATE") {
				pinregistration.setContent("<h5>Type the PIN...</h5>");
				return;
			}

			if (enroller.biometry_state == "NOT_ENROLLING") {
				clearInterval(enrollInterval);
				pinregistration.setContent("<h5>PIN enrolled successfully.</h5>");
				return;
			}
		}, 1000);
	} else if (type == 'biometry') {

		var biometryregistration = new Modal();
		biometryregistration.setTitle("Remote Enrollment");
		biometryregistration.addContent("<h5>Move your finger closer to the reader...</h5>");
		biometryregistration.addButton([
			{
				'type' : 'cancel',
				'callback' : function() {
					MessengerUtil.send('cancel_remote_enroll');
					biometryregistration.close();
				}
			}
		]);
	
		biometryregistration.show();
		biometryregistration.setContent("<h5>Enrolling fingerprint 1/3</h5>");
	
		var enrollInterval = setInterval(function(){
			var enroller = MessengerUtil.send('enroller_biometry_state', null, null, false);
	
			if(enroller.enroller_state == "NORMAL_STATE"){
				if(enroller.last_enroll){
					clearInterval(enrollInterval);
					biometryregistration.setContent("<h5>Fingerprint enrolled successfully.</h5>");
					if (duress)
							totalDuressCount++;
						else
							totalCount++;
					refreshCount();
					template_number++;
					biometryregistration.close();
				} else if(enroller.last_enroll_error == "UNKNOWN"){
					clearInterval(enrollInterval);
					biometryregistration.setContent("<h5>Fingerprint enrollment cancelled.</h5>");
					biometryregistration.close();
				}
				return;
			}
	
			if(enroller.enroller_state == "WAITING_BIOMETRY_EXTRACT_REPLY" ||
				enroller.enroller_state == "WAITING_BIOMETRY_MATCH_REPLY" ||
				enroller.enroller_state == "WAITING_BIOMETRY_ENROLL_REPLY"){
				biometryregistration.setContent("<h5>Processing enrollment</h5>");
				 return;
			}
	
			if(enroller.biometry_state == "ENROLL_FIRST_BIOMETRY_STATE" && enroller.last_enroll_error == "DIFFERENT_FINGERPRINTS"){
				biometryregistration.setContent("<h5>Enrolling fingerprint 1/3</h5>");
				biometryregistration.addContent("<h5>Fingerprints do not match. Retry.</h5>");
			}else if(enroller.biometry_state == "ENROLL_FIRST_BIOMETRY_STATE" && enroller.last_enroll_error == "TEMPLATE_EXISTS"){
				biometryregistration.setContent("<h5>Enrolling fingerprint 1/3</h5>");
				biometryregistration.addContent("<h5>Fingerprint already enrolled. Retry.</h5>");
			}else if(enroller.biometry_state == "ENROLL_FIRST_BIOMETRY_STATE" && enroller.last_enroll_error == "TEMPLATE_LIMIT_REACHED"){
				biometryregistration.setContent("<h5>Enrolling fingerprint 1/3</h5>");
				biometryregistration.addContent("<h5>Maximum number of fingerprints reached.</h5>");
			}else if(enroller.biometry_state == "NOT_ENROLLING"){
				clearInterval(enrollInterval);
				biometryregistration.setContent("<h5>Fingerprint enrolled successfully.</h5>");
			}
				
	
			if(enroller.biometry_state == "ENROLL_SECOND_BIOMETRY_STATE"){
				biometryregistration.setContent("<h5>Enrolling fingerprint 2/3</h5>");
			}else if(enroller.biometry_state == "ENROLL_THIRD_BIOMETRY_STATE"){
				biometryregistration.setContent("<h5>Enrolling fingerprint 3/3</h5>");
			}else if(enroller.biometry_state == "NOT_ENROLLING"){
				clearInterval(enrollInterval);
				biometryregistration.setContent("<h5>Fingerprint enrolled successfully</h5>");
			}
		}, 1000);
	}
}

var onFailSoHard = function (e) {
	alert("Could not connect to the camera!");
};

function TirarFoto(btn) {
	if (cameraStatus == 0) {
		$(btn).html('<img src="/images/picture.png" alt="picture" style="margin-bottom: 5px; width: 24px;"> Capture');

		try {
			if (navigator.mediaDevices.getUserMedia) {
				navigator.mediaDevices.getUserMedia({audio: false, video: true})
					.then(function (stream) {
						video.srcObject = stream;
						video.play();
						cameraStatus = 1;
					})
					.catch(function (err) {
						onFailSoHard;
					})
			}
		} catch {
			alert("Browser not compatible with camera or SSL disabled (check in Settings -> Network -> SSL)");
		}

		setInterval(function () {
			if (cameraStatus == 1) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
				var img = canvas.toDataURL("image/png");
				$('#foto').attr('src', img);
			}
		}, 1000 / 15);
	}
	else if (cameraStatus == 2) {
		cameraStatus = 1;
		$(btn).html('<img src="/images/picture.png" alt="picture" style="margin-bottom: 5px; width: 24px;"> Capture');
	}
	else {
		$(btn).html('<img src="/images/picture.png" alt="picture" style="margin-bottom: 5px; width: 24px;"> New Photo');

		cameraStatus = 2;

		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
		var img = canvas.toDataURL("image/png");

		$('#foto').attr('src', img);
		GeraBytesFotos(img);
	}
}

function GeraBytesFotos(img)
{

	/*var copy = document.createElement( 'canvas' );
	copy.width = 200;
	copy.height = 200;
	var cctx = copy.getContext('2d');

	cctx.putImageData( context.getImageData( 0, 0, copy.width, copy.height ), 0, 0 );

	var img = copy.toDataURL("image/png");*/
	img = atob(img.split(",")[1]);
	btFoto = new Uint8Array(img.length);
	for (var i = 0; i < img.length; i++) {
		btFoto[i] = img.charCodeAt(i);
	}
}

var nDedo = 1;
function appImg(img, data, param) {
	$('#imgDedo' + nDedo).attr('src', "data:image/png;base64," + img);
	data = atob(data);
	var bufView = new Uint8Array(data.length);
	for (var i = 0; i < data.length; i++) {
		bufView[i] = data.charCodeAt(i);
	}

	var uid = $('#id').val();
	appLog(MessengerUtil.sendFile('user_fingerprint', bufView, 'user_id=' + uid+ '&' + param));
}

function appLog(msg) {
	if (msg.error !== undefined)
		$('#logDigital').html("<br/><br/><br/>ERROR: " + msg.error);
	else if(msg.info !== undefined)
		$('#logDigital').html("<br/><br/><br/>" + msg.info);
	else if (msg.count == 3) {
		if (msg.success) {
			$('#logDigital').html("<br/><br/><br/>Quality: " + msg.quality + "<br/>Fingerprint enrolled<br/>Fingerprints enrolled: " + msg.template_number);
		}
		else
			$('#logDigital').html("<br/><br/><br/>Quality: " + msg.quality + "<br/>" + msg.info);
	}
	else {
		$('#logDigital').html("<br/><br/><br/>Quality: " + msg.quality + "<br/>Press your finger on the sensor again");
	}
}

function RemoverFoto(btn)
{
	$('#foto').attr('src', '/images/null.jpg');
	btFoto = new Array();
	btFoto[0] = 1;
}

function UploadFoto(btn) {
        if (lDefChange) {
                DefChange = false;
                $('#uplFoto').change(function (e) {
                        e = e || window.event;
                        console.log(e)
                        var file = e.originalEvent.srcElement.files[0];
            var image = new Image;
            image.onload = function () {
                // Builds the image the will be sent.
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.clearRect(0, 0, image.width, image.height);
                ctx.drawImage(image, 0, 0, image.width, image.height);
                var imgSent = canvas.toDataURL("image/jpeg", 0.92);
                // Grava a foto redimensionada para ser enviada.
                GeraBytesFotos(imgSent);

                // Builds the image the will be shown in a square canvas.
                if ( image.width > image.height ){
                        scalingCoefficient = 290. / image.width ;
                } else {
                        scalingCoefficient = 290. / image.height ;
                }
                newWidth = scalingCoefficient * image.width;
                newheight = scalingCoefficient * image.height;
                canvas.width = newWidth;
                canvas.height = newheight;
                ctx.clearRect(0, 0, newWidth, newheight);
                ctx.drawImage(image, 0, 0, newWidth, newheight);
                imgShown = canvas.toDataURL("image/png", 0.92);
                // Exibe a foto redimensionada para exibicao.
                $('#foto').attr('src', imgShown);
            }
            image.src = URL.createObjectURL(file);
		});
	}
	$('#uplFoto').click();
}

function imgLoaded(image) {
	if(image.src != imgShown) {
		setTimeout(function(image){
			var scalingCoefficient;
			// Builds the image the will be shown in a square canvas.
			if ( image.width > image.height ){
			        scalingCoefficient = 290. / image.width ;
			} else {
			        scalingCoefficient = 290. / image.height ;
			}
			var newWidth = scalingCoefficient * image.width;
			var newheight = scalingCoefficient * image.height;
			canvas.width = newWidth;
			canvas.height = newheight;
			ctx.clearRect(0, 0, newWidth, newheight);
			ctx.drawImage(image, 0, 0, newWidth, newheight);
			imgShown = canvas.toDataURL("image/png", 0.92);
			// Exibe a foto redimensionada para exibicao.
			$('#foto').attr('src', imgShown);
		}, 10, image);
	}
}

// http://stackoverflow.com/questions/16835421/how-to-allow-chrome-to-access-my-camera-on-localhost/16929608#16929608
// http://www.forensicswiki.org/wiki/Google_Chrome#Configuration
// C:\Documents and Settings\fabio.souza\AppData\Local\Google\Chrome\User Data\Default
// "profile": { "content_settings": { "pattern_pairs": { "*,*": { "media-stream-camera": 1 }, } } }
// http://addyosmani.com/polyfillthehtml5gaps/getUserMedia.js/demo.html
// http://caniuse.com/#search=getuserMedia
// http://mozilla.github.io/webrtc-landing/gum_test.html
// http://ghinda.net/jpeg-blob-ajax-android/
// http://jimdoescode.blogspot.co.uk/2011/11/trials-and-tribulations-with-html5.html
// https://wiki.alfresco.com/wiki/JavaScript_API_Cookbook
//var tdu = HTMLCanvasElement.prototype.toDataURL;
//HTMLCanvasElement.prototype.toDataURL = function (type) {
//    var res = tdu.apply(this, arguments);
//    //If toDataURL fails then we improvise
//    if (res.substr(0, 6) == "data:,") {
//        var encoder = new JPEGEncoder();
//        return encoder.encode(this.getContext("2d").getImageData(0, 0, this.width, this.height), 90);
//    }
//    else return res;
//}
