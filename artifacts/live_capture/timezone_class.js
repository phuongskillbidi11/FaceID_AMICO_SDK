function TimeZone(){

	var $messenger = new Messenger(this);
	BaseClass.call(this, TimeZone, $messenger, 'time_zones', 'id', ['name'], null, null);

	var $countAccessRules = null;
	var $lstAccessRules = null;
	var $accessRule = new IntermediateTable(this, 'access_rule_time_zones', 'time_zone_id', 'access_rule_id');

	var $countGroups = null;
	var $lstGroups = null;

	var $countUsers = null;
	var $lstUsers = null;

	var $countScheduledUnlocks = null;
	var $lstScheduledUnlocks = null;

	var $countTimespans = null;
	var $lstTimespans = null;
	var $lstTimespansAdd = [];
	var $lstTimespansRemove = [];

// ------------------- BEGIN CRUD -------------------- //
	this.validate = function(data){
		var result = [];
		if('name' in data){
			if(ValidateUtil.isEmpty(data.name)){
				result.push('Enter a valid name');
			}
		}

		return result;
	};

	this.parse = function(data){
		$messenger.loaded();
		this.setId(data.id);
		this.setName(data.name);
	};

	this.save = function(
		lstRulesAdd, lstRulesDel,
		lstGroupsAdd, lstGroupsDel,
		lstUsersAdd, lstUsersDel)
	{
		var valid = {};
		valid.name = this.getName();
		var lstError = this.validate(valid);
		if(lstError.length > 0){
			return {'validate' : lstError};
		}

		var bool = $messenger.save({ 'name' : this.getName()});
		if(bool){
			var that = this;
			if(Main.isOnline() == false){
				lstGroupsAdd.forEach(function(group){
					group.save(null, null, [that], null);
				});
				lstGroupsDel.forEach(function(group){
					group.save(null, null, null, [that]);
				});

				lstUsersAdd.forEach(function(user){
					user.save(null, null, [that], null, null, null);
				});
				lstUsersDel.forEach(function(user){
					user.save(null, null, null, [that], null, null);
				});
				if($messenger.isLoaded() == false){
					var rule = new AccessRule();
					rule.setName('(AccessRule_TimeZone automatically created for TimeZone ' + this.getId() + ')');
					rule.setType(true);
					rule.save([that], null, null, null, null, null, null, null, null, null);
				}
			}

			$accessRule.add(lstRulesAdd);
			$accessRule.remove(lstRulesDel);
			console.log($lstTimespansAdd)
			$lstTimespansAdd.forEach(function(ts){
				if(ts.getId() < 0)
					ts.setNullId();
				ts.setTimeZoneId(that.getId());
				ts.save();
			});

			if($lstTimespansRemove.length > 0)
				new Timespan().remove($lstTimespansRemove);
		}
		return bool;
	};

// ------------------- END CRUD -------------------- //



// ------------------- BEGIN ACCESS RULES -------------------- //

	this.getCountAccessRules = function(){
		if($countAccessRules == null)
			$countAccessRules = $messenger.countBy(new AccessRule());
		return $countAccessRules;
	}

	this.getAccessRules = function(){
		if($lstAccessRules == null){
			$lstAccessRules = $messenger.listBy(new AccessRule());
		}
		return $lstAccessRules;
	};

	this.getJoinAccessRules = function(){
		return $messenger.join(new AccessRule().listAllSimple(), this.getAccessRules());
	};

// ------------------- END ACCESS RULES -------------------- //


// ------------------- BEGIN GROUPS -------------------- //

	this.getCountGroups = function(){
		if($countGroups == null){
			$countGroups = 0;
			this.getAccessRules().forEach(function(rule){
				$countGroups += rule.getCountGroups();
			});
		}
		return $countGroups;
	}

	this.getGroups = function(){
		if($lstGroups == null){
			$lstGroups = [];
			this.getAccessRules().forEach(function(rule){
				rule.getGroups().forEach(function(group){
					$lstGroups.push(group);
				});
			});
		}
		return $lstGroups;
	}

	this.getJoinGroups = function(){
		return $messenger.join(new Group().listAllSimple(), this.getGroups());
	};

// ------------------- END GROUPS -------------------- //



// ------------------- BEGIN SCHEDULEDUNLOCKS -------------------- //

this.getCountScheduledUnlocks = function(){
	if($countScheduledUnlocks == null){
		$countScheduledUnlocks = 0;
		this.getAccessRules().forEach(function(rule){
			$countScheduledUnlocks += rule.getCountScheduledUnlocks();
		});
	}
	return $countScheduledUnlocks;
}

this.getScheduledUnlocks = function(){
	if($lstScheduledUnlocks == null){
		$lstScheduledUnlocks = [];
		this.getAccessRules().forEach(function(rule){
			rule.getScheduledUnlocks().forEach(function(scheduledunlock){
				$lstScheduledUnlocks.push(scheduledunlock);
			});
		});
	}
	return $lstScheduledUnlocks;
}

this.getJoinScheduledUnlocks = function(){
	return $messenger.join(new ScheduledUnlock().listAllSimple(), this.getScheduledUnlocks());
};

// ------------------- END SCHEDULEDUNLOCKS -------------------- //



// ------------------- BEGIN USERS -------------------- //

	this.getCountUsers = function(){
		if($countUsers == null){
			$countUsers = 0;
			this.getAccessRules().forEach(function(rule){
				$countUsers += rule.getCountUsers();
			});
		}
		return $countUsers;
	}

	this.getUsers = function(){
		if($lstUsers == null){
			$lstUsers = [];
			this.getAccessRules().forEach(function(rule){
				rule.getUsers().forEach(function(user){
					$lstUsers.push(user);
				});
			});
		}
		return $lstUsers;
	};

	this.getJoinUsers = function(){
		return $messenger.join(new User().listAllSimple(), this.getUsers());
	};

// ------------------- END USERS -------------------- //



// ------------------- BEGIN TIME SPAN -------------------- //

	this.getCountTimespans = function(){
		if($countTimespan == null)
			$countTimespan = $messenger.countBy(new Timespan());
		return $countTimeSpan;
	};

	this.getTimespans = function(){
		if($lstTimespans == null){
			$lstTimespans = $messenger.listBy(new Timespan());
		}
		return $lstTimespans;
	};

	this.popTimespan = function(id){
		var ts = null;
		for(var i = 0; i < this.getTimespans().length; i++){
			if($lstTimespans[i].getId() == id){
				ts = $lstTimespans[i]
			}
		}
		return ts;
	}
	this.addTimespan = function(timespan){

		if(timespan.getId() == null){
			timespan.setId(-($lstTimespansAdd.length+1));
			this.getTimespans();
			$lstTimespans.push(timespan);
		}/*else{
			for(var i = 0; i < this.getTimespans(); i++){
				if($lstTimespans[i] == timespan.getId()){
					$lstTimespans.splice(i, 1);
					return false;
				}
			}
		}*/


		$lstTimespansAdd.push(timespan);
	};

	this.removeTimespan = function(id){
		if(id > 0)
			$lstTimespansRemove.push(id);

		for(var i = 0; i < $lstTimespansAdd.length; i++){
			if($lstTimespansAdd[i].getId() == id){
				$lstTimespansAdd.splice(i, 1);
				return false;
			}
		}

		for(var i = 0; i < this.getTimespans().length; i++){
			if($lstTimespans[i].getId() == id){
				$lstTimespans.splice(i, 1);
				return false;
			}
		}

	};

// ------------------- END TIME SPAN -------------------- //

};
