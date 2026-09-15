function Timespan(){

	var $messenger = new Messenger(this);
	BaseClass.call(this, Timespan, $messenger, 'time_spans', 'id', ['start'], null, null);

	var $timeZoneId;
	var $start;
	var $end;
	var $seg;
	var $ter;
	var $qua;
	var $qui;
	var $sex;
	var $sab;
	var $dom;

// ------------------- BEGIN CRUD -------------------- //

	this.parse = function(data){
		$messenger.loaded();
		this.setTimeZoneId(data.time_zone_id);
		this.setId(data.id)
		this.setStart(data.start);
		this.setEnd(data.end);
		this.setSeg(data.mon == 1);
		this.setTer(data.tue == 1);
		this.setQua(data.wed == 1);
		this.setQui(data.thu == 1);
		this.setSex(data.fri == 1);
		this.setSab(data.sat == 1);
		this.setDom(data.sun == 1);
	};


	this.save = function(){

		return $messenger.save({
						"start" : $start,
						"end" : $end,
						"sun" : $dom == true ? 1 : 0,
						"mon" : $seg == true ? 1 : 0,
						"tue" : $ter == true ? 1 : 0,
						"wed" : $qua == true ? 1 : 0,
						"thu" : $qui == true ? 1 : 0,
						"fri" : $sex == true ? 1 : 0,
						"sat" : $sab == true ? 1 : 0,
						"time_zone_id" : $timeZoneId
						});

	};


// ------------------- END CRUD -------------------- //



// ------------------- BEGIN GET/SET -------------------- //

	this.getTimeZoneId = function(){
		return $timeZoneId;
	};
	this.setTimeZoneId = function(timeZoneId){
		$timeZoneId = timeZoneId;
	};

	this.getStartDesc = function(){
		var aux = new Date();
		aux.setHours(0);
		aux.setMinutes(0);
		aux.setMilliseconds(0);
		aux.setSeconds($start);
		return (('0' + aux.getHours()).slice(-2) + ":" + ('0' + aux.getMinutes()).slice(-2));
	};
	this.getStart = function(){
		return $start;
	};
	this.setStart = function(start){
		$start = start;
	};

	this.getEndDesc = function(){
		var aux = new Date()
		aux.setHours(0);
		aux.setMinutes(0);
		aux.setMilliseconds(0);
		aux.setSeconds($end);
		return (('0' + aux.getHours()).slice(-2) + ":" + ('0' + aux.getMinutes()).slice(-2));
	};
	this.getEnd = function(){
		return $end;
	};
	this.setEnd = function(end){
		$end = end;
	};

	this.getSeg = function(){
		return $seg;
	};
	this.setSeg = function(seg){
		$seg = seg;
	};

	this.getTer = function(){
		return $ter;
	};
	this.setTer = function(ter){
		$ter = ter;
	};

	this.getQua = function(){
		return $qua;
	};
	this.setQua = function(qua){
		$qua = qua;
	};

	this.getQui = function(){
		return $qui;
	};
	this.setQui = function(qui){
		$qui = qui;
	};

	this.getSex = function(){
		return $sex;
	};
	this.setSex = function(sex){
		$sex = sex;
	};

	this.getSab = function(){
		return $sab;
	};
	this.setSab = function(sab){
		$sab = sab;
	};

	this.getDom = function(){
		return $dom;
	};
	this.setDom = function(dom){
		$dom = dom;
	};


// ------------------- END GET/SET -------------------- //
};