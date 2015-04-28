/**
 * 定时任务说明
 * 当重新启动App的时候，将自动检查提名id，是否符号范围条件
 * 如果符合条件，则根据当前时间计算是否需要通知提醒加入或立即发出通知，时间范围默认在5-7天
 */

/**
 * 1. 获取所有提名 iids
 * 2. 获取iids对应的邀请时间
 * 3. 过滤在 Jobs.warn.time - Jobs.expire.time 区间范围的 iids
 * 4. 判断是否发出提醒
 * 5. 如果发出提醒就跳过，反之则立即发出提醒
 * 6. 在第3步的同时过滤大于 Jobs.expire.time 的 iids
 * 7. 直接设置过期字段
 */

var schedule = require('node-schedule'),
	meta = require('./meta'),
	nconf = require('nconf'),
	async = require('async'),
	user = require('./user'),
	invite = require('./invite'),
	plugins = require('./plugins'),
	emailer = require('./emailer'),
	db = require('./database');

var Jobs = {};

Jobs.init = function () {
	Jobs.jobs = {};

	// 提醒时间系统默认五天
	Jobs.warn = {
		time: function () {
			var warnTime = +meta.config['invite:warnTime'];
			return 1000 * 60 * 60 * 24 * warnTime;
		},
		text: function () {
			return meta.config['invite:warnText'];
		}
	};

	// 提醒时间系统默认七天
	Jobs.expire = {
		time: function () {
			var expireTime = +meta.config['invite:expireTime'];
			return 1000 * 60 * 60 * 24 * expireTime;
		},
		text: function () {
			return meta.config['invite:expireText'];
		}
	};

	if (process.env.NODE_ENV === 'development') {
		Jobs.warn = {
			time: function () {
				return 1000 * 60 * 2;
			},
			text: function () {
				return '2分钟';
			}
		};
		Jobs.expire = {
			time: function () {
				return 1000 * 60 * 6;
			},
			text: function () {
				return '6分钟';
			}
		}
	}

	Jobs.getInviteIids(function (err, iids) {
		if (err) {
			return new Error('get invite iid error');
		}
		Jobs.setSchedules(iids);
	});
};

// 根据 invite:time, 获取所有该列表中的提名id
Jobs.getInviteIids = function (callback) {
	db.getSortedSetRangeWithScores('invite:time', 0, -1, function (err, inviteTimes) {
		if (err) {
			return callback(err);
		}

		var warnIids = [],
			expireIids = [];

		inviteTimes.map(function (item) {
			var invitedTime = item.value,
				timestamp = Date.now();

			if (timestamp - invitedTime < Jobs.warn.time()) {
				Jobs.setWarn(item.score, parseInt(item.value, 10));
			} else if (timestamp - invitedTime >= Jobs.warn.time() && timestamp - invitedTime < Jobs.expire.time()) {
				warnIids.push(parseInt(item.score, 10));
			} else if (timestamp - invitedTime >= Jobs.expire.time()) {
				expireIids.push(parseInt(item.score, 10));
			}
		});

		for (var i = 0, iidsLength = expireIids.length; i < iidsLength; i++) {
			Jobs.setExpireField(expireIids[i]);
		}
		callback(null, warnIids);
	})
};

Jobs.setSchedule = function (iid) {
	Jobs.setSchedules([iid]);
};

Jobs.setSchedules = function (iids) {
	for (var i = 0, iidsLength = iids.length; i < iidsLength; i++) {
		db.getObject('invite:' + iids[i], function (err, inviteData) {
			if (inviteData) {
				var warned = inviteData.hasOwnProperty(warned) ? parseInt(inviteData.warned, 10) : 0,
					inviteTime = parseInt(inviteData.invitedTime, 10);

				if (!!parseInt(inviteData.joined, 10) || !parseInt(inviteData.invited, 10) || !!warned || !inviteTime) {
					return false;
				}

				Jobs.sendInviteNotification(inviteData);
			}
		});
	}
};

Jobs.setWarn = function (iid, time, callback) {
	callback = callback || function() {};
	var date = new Date(time + Jobs.warn.time());

    // 在发出邀请后，提醒时间内还未加入的， 通知提醒参与投票的人
	Jobs.jobs[iid] = schedule.scheduleJob(date, function (iid) {
		db.getObject('invite:' + iid, function (err, inviteData) {
			if (!!parseInt(inviteData.joined, 10) && !parseInt(inviteData.invited, 10)) {
				return;
			}
			Jobs.sendInviteNotification(inviteData);
		});
	}.bind(null, iid));
	callback();
};

Jobs.setExpireField = function (iid, callback) {
	callback = callback || function() {};
	invite.getInviteData(iid, function (err, inviteData) {
		// 当已经邀请，但是没有加入，同时超过过期时间的时候
		if (!!parseInt(inviteData.invited, 10) && !parseInt(inviteData.joined, 10)) {
			invite.setInviteFields(inviteData.iid, {expired: 1, warned: 1, status: 'failed'});
			sendExpireEmail(inviteData);
		}
		db.sortedSetRemove('invite:time', inviteData.invitedTime, callback());
	});
	// TODO send notification
};

// 邀请失败后，向提名人发送邮件告知
function sendExpireEmail (inviteData, callback) {
	callback = callback || function() {};
	var params = {
		site_title: (meta.config.title || 'NodeBB'),
		uid: inviteData.uid,
		template: 'inviteFailed',
		username: inviteData.invitedByUsername,
		invite_username: inviteData.username,
		expire_time: Jobs.expire.text(),
		invite_link: nconf.get('relative_path') + '/invite/' + inviteData.slug
	};
	if (plugins.hasListeners('action:email.send')) {
		emailer.sendPlus(params)
	} else {
		callback(new Error('[[error:no-emailers-configured]]'));
	}
}

Jobs.setExpire = function (iid, date, voters, next) {
	Jobs.jobs[iid] = schedule.scheduleJob(date, function (iid) {
		db.getObject('invite:' + iid, function (err, inviteData) {
			if (!!parseInt(inviteData.joined, 10)) {
				return next();
			}
			async.waterfall([
				function (next) {
					Jobs.setExpireField(iid, next);
				},
				function (next) {
					if (!Array.isArray(voters) || !voters.length) {
						return next();
					}
					async.map(voters, function (uid, callback) {
						db.getObjectField('user:' + uid, 'username', function (err, username) {
							if (err) {
								return callback(err);
							}
							if (!username) {
								return next();
							}
							// step: 5
							user.notifications.sendNotification({
								bodyShort: username + '，您参与提名或投票 ' + inviteData.username + ' 的邀请邮件已经发出' + Jobs.expire.text() + '，但到目前还没有注册进入社区，该提名已过期。',
								path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
								nid: 'invite:iid:' + iid + ':uid:'+ uid + ':expired',
								uid: uid,
								iid: iid,
								score: 'somebody',
								step: 5
							}, next);
						});
					}, next);
				}
			], next);
		});
	}.bind(null, iid));
};

// 提名通过发出通知
Jobs.sendInviteNotification = function (inviteData, callback) {
	callback = callback || function() {};
	var iid = inviteData.iid,
		voters;

	async.waterfall([
		function (next) {
			db.getSetMembers('invite:posts:' + iid + ':upvote:by', next);
		},
		function (_voters, next) {
			voters = _voters;
			if (!Array.isArray(voters) || !voters.length) {
				return next();
			}
			async.each(voters, function (id, next) {
				db.getObjectField('user:' + id, 'username', function (err, username) {
					if (err) {
						return next(err);
					}
					if (!username) {
						return next();
					}
					user.notifications.sendNotification({
						bodyShort: username + '，您参与提名或投票 ' + inviteData.username + ' 的邀请邮件已经发出' + Jobs.warn.text() + '，但到目前还没有注册进入社区，觉得需要的话，可以以您觉得合适的方式通知他本人查收一下邮件。',
						path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
						nid: 'invite:iid:' + iid + ':uid:'+ id + ':warned',
						uid: id,
						iid: iid,
						score: 'somebody',
						step: 4
					}, next);
				});
			}, next);
		},
		// 设置该提名贴已发出过期提醒通知
		function (next) {
			invite.setInviteField(iid, 'warned', 1, next);
		},
		// 取消定时提醒任务
		function (next) {
			Jobs.cancelJobsByIid(iid, next);
		},
		// 获取邀请邮件发出时间
		function (next) {
			db.getObjectField('invite:' + iid, 'invitedTime', next);
		},
		// 根据邀请邮件发出时间和过期时间定制过期任务
		function (time, next) {
			var date = new Date(parseInt(time, 10) + Jobs.expire.time());
			Jobs.setExpire(iid, date, voters, next);
		}
	], callback);
};

Jobs.cancelJobsByIid = function (iid, next) {
	if (Jobs.jobs[iid]) {
		Jobs.jobs[iid].cancel();
	}
	next();
};

module.exports = Jobs;
