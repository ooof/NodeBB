/**
 * 定时任务说明
 * 当重新启动App的时候，将自动检查提名id，是否符号范围条件
 * 如果符合条件，则根据当前时间计算是否需要通知提醒加入或立即发出通知，时间范围默认在5-7天
 */

var schedule = require('node-schedule'),
	nconf = require('nconf'),
	async = require('async'),
	user = require('./user'),
	db = require('./database'),
	Jobs = {};

Jobs.minPlanTime = 1000 * 60 * 60 * 24 * 5; // five days
Jobs.maxPlanTime = 1000 * 60 * 60 * 24 * 7; // seven days

Jobs.init = function () {
	Jobs.jobs = {};

	Jobs.getInviteIids(function (err, iids) {
		if (err) {
			return new Error('get invite iid error');
		}
		Jobs.setSchedules(iids);
	});
};

Jobs.getInviteIids = function (callback) {
	db.getSortedSetRangeWithScores('invite:time', 0, -1, function (err, invites) {
		if (err) {
			return callback(err);
		}

		var iids = [];

		invites.filter(function (invite) {
			return Date.now() - invite.value > Jobs.minPlanTime;
		}).map(function (invite) {
			iids.push(parseInt(invite.score, 10));
		});

		callback(null, iids);
	})
};

Jobs.setSchedule = function (iid) {
	Jobs.setSchedules([iid]);
};

Jobs.setSchedules = function (iids) {
	for (var i = 0; i < iids.length; i++) {
		db.getObject('invite:' + iids[i], function (err, inviteData) {
			var notification = inviteData.notification ? parseInt(inviteData.notification, 10) : 0;

			if (!!parseInt(inviteData.joined, 10) || !parseInt(inviteData.invited, 10) || !!notification) {
				return false;
			} else if (!parseInt(inviteData.invited, 10)) {
				return false;
			}

			var inviteTime = parseInt(inviteData.invitedTime, 10),
				time = Date.now() - inviteTime;

			if (time < Jobs.minPlanTime) {
				Jobs.setJob(inviteData.iid, inviteTime);
			} else if (time > Jobs.minPlanTime && time < Jobs.maxPlanTime) {
				Jobs.sendInviteNotification(iid);
			}
		});
	}
};

Jobs.setJob = function (iid, time) {
	var date = new Date(time + Jobs.minPlanTime);

	Jobs.jobs[iid] = schedule.scheduleJob(date, function (iid) {
		db.getObject('invite:' + iid, function (err, inviteData) {
			if (!!parseInt(inviteData.joined, 10)) {
				return false;
			}
			Jobs.sendInviteNotification(iid);
		});
	}.bind(null, iid));
};

Jobs.sendInviteNotification = function (iid, callback) {
	callback = callback || function() {};

	async.parallel({
		invite: function (next) {
			db.getObject('invite:' + iid, next);
		},
		voter: function (next) {
			db.getSetMembers('invite:posts:' + iid + ':upvote:by', next);
		}
	}, function (err, data) {
		if (err) {
			return callback(err);
		}

		if (!data.invite.invited) {
			return callback();
		}

		async.waterfall([
			function (next) {
				db.setObjectField('invite:' + iid, 'notification', 1, next)
			},
			function (next) {
				db.getObjectField('user:' + data.invite.uid, 'username', next)
			},
			function (username, next) {
				var inviteData = data.invite;
				user.notifications.sendNotification({
					bodyShort: username + '，您提名的 ' + inviteData.username + ' 邀请邮件已经发出五天，但到目前还没有注册进入社区，觉得需要的话，可以以您觉得合适的方式通知他本人查收一下邮件。',
					path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
					score: 'somebody',
					iid: iid,
					uid: inviteData.uid,
					nid: 'invite:iid:' + iid + ':uid:' + data.invite.uid + ':second'
				}, next);
			},
			function (next) {
				async.map(data.voter, function (id, callback) {
					if (parseInt(id, 10) === parseInt(data.invite.uid, 10)) {
						return callback();
					}
					db.getObjectField('user:' + id, 'username', function (err, username) {
						if (err) {
							return callback(err);
						}
						user.notifications.sendNotification({
							bodyShort: username + '，您参与投票的 ' + inviteData.username + ' 的邀请邮件已经发出五天，但到目前还没有注册进入社区，觉得需要的话，可以以您觉得合适的方式通知他本人查收一下邮件。',
							path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
							score: 'somebody',
							iid: iid,
							uid: id,
							nid: 'invite:iid:' + iid + ':uid:'+ id + ':second'
						}, callback);
					});
				}, next);
			}
		], callback);
	});
};

Jobs.cancelJobsByIid = function (iid, next) {
	Jobs.jobs[iid].cancel();
	next();
};

module.exports = Jobs;
