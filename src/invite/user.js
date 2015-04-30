'use strict';

var db = require('../database'),
	nconf = require('nconf'),
	async = require('async'),
	meta = require('../meta'),
	utils = require('../../public/src/utils'),
	plugins = require('../plugins'),
	user = require('../user'),
	invite = require('../invite'),
	jobs = require('../schedule'),
	emailer = require('../emailer');

module.exports = function (Invite) {
	Invite.isOwner = function (iid, uid, callback) {
		uid = parseInt(uid, 10);
		if (!uid) {
			return callback(null, false);
		}
		Invite.getInviteField(iid, 'uid', function (err, author) {
			callback(err, parseInt(author, 10) === uid);
		});
	};

	function getDataForValidate (iid, withSlug, callback) {
		Invite.getInviteFields(iid, ['status', 'slug'], function (err, inviteData) {
			if (err) {
				return callback(err);
			}
			var data = {
					exists: !!iid
				},
				slugTag = '<a href="' + nconf.get('relative_path') + 'invite/' + inviteData.slug + '" target="_blank">点击查看</a>';
			if (inviteData.status === 'voting') {
				data.msg = '正在投票中';
			} else if (inviteData.status === 'invited') {
				data.msg = '已被提名，并已发送邮件邀请加入';
			} else if (inviteData.status === 'joined') {
				data.msg = '已加入';
			} else if (inviteData.status === 'failed') {
				data.exists = false;
				data.msg = '已被提名，但邀请失败，可再次提名此人';
			} else {
				data.msg = '';
			}
			if (withSlug && data.msg) {
				data.msg = data.msg + '，' + slugTag;
			}
			callback (null, data);
		})
	}

	function registerUsernameExists(data, username, callback) {
		user.exists(utils.slugify(username), function (err, exist) {
			data.exists = exist;
			if (exist) {
				data.msg = '该用户已存在';
			}
			callback(null, data);
		});
	}

	Invite.usernameExists = function(username, callback) {
		var data = {};
		async.waterfall([
			function (next) {
				Invite.getIidByUsername(username, next);
			},
			function (iid, next) {
				if (!iid) {
					return registerUsernameExists(data, username, callback);
				}
				next(null, iid);
			},
			function (iid, next) {
				getDataForValidate(iid, true, next);
			}
		], callback);
	};

	Invite.emailExists = function(email, callback) {
		var data = {};
		async.waterfall([
			function (next) {
				Invite.getIidByEmail(email.toLowerCase(), next);
			},
			function (iid, next) {
				if (!iid) {
					return callback(null, data)
				}
				next(null, iid);
			},
			function (iid, next) {
				getDataForValidate(iid, false, next);
			}
		], callback);
	};

	Invite.getIidByEmail = function(email, callback) {
		db.getObjectField('email:iid', email.toLowerCase(), callback);
	};

	Invite.getIidByUsername = function(username, callback) {
		if (!username) {
			return callback();
		}
		db.getObjectField('username:iid:invite', username, callback);
	};

	Invite.inviteUser = function (uid, inviteData, callback) {
		var iid = inviteData.iid;

		async.waterfall([
			function (next) {
				db.getObjectFields('invite:' + iid, ['slug', 'username'], next);
			},
			function (inviteData, next) {
				Invite.notificationUserInvited(inviteData, uid, iid, next);
			},
			function (next) {
				// 给被提名人发送邮件邀请
				Invite.sendInviteEmail(inviteData.uid, iid, next);
			},
			function (next) {
				// 如果有多个人投票时，给提名人发送邮件告知提名已通过
				if (inviteData.inviteCount === 1) {
					return next();
				}
				Invite.sendSuccessEmail(inviteData, next);
			},
			function (next) {
				jobs.setWarn(iid, Date.now(), next);
			}
		], callback);
	};

	// 通知全站用户参与提名
	Invite.notificationUserUpvote = function (inviteData, callback) {
		// step: 1
		user.notifications.sendNotification({
			bodyShort: '[[invite:notification.inviting, ' + inviteData.invitedByUsername + ', ' + inviteData.username + ']]',
			path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
			nid: 'upvote:' + inviteData.iid,
			uid: inviteData.uid,
			iid: inviteData.iid,
			score: 'other',
			step: 1
		}, callback);
	};

	// 通知参与提名的用户该提名已通过并已发出邀请
	Invite.notificationUserInvited = function (inviteData, uid, iid, callback) {
		// step: 2
		user.notifications.sendNotification({
			bodyShort: '[[invite:notification.invited, ' + inviteData.username + ']]',
			path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
			nid: 'invited:uid:' + uid + ':iid:' + iid,
			uid: uid,
			iid: iid,
			score: 'other',
			step: 2
		}, callback);
	};

	/**
	 * 向用户发出注册邀请
	 *
	 * from_username 提名人的用户名
	 * from_invite_username 提名人的被邀请的用户名
	 */
	Invite.sendInviteEmail = function (uid, iid, callback) {
		var inviteData = {},
			register_code = utils.generateUUID(),
			register_link = nconf.get('url') + '/register?code=' + register_code,
			timestamp = Date.now();

		async.waterfall([
			function (next) {
				invite.getInviteFields(iid, ['username', 'invitedByUsername', 'uid', 'email'], next);
			},
			function (data, next) {
				inviteData = data;
				inviteData.from_username = data.invitedByUsername;
				db.setObject('confirm:' + register_code, {
					email: data.email.toLowerCase(),
					username: data.username
				}, next);
			},
			function (next) {
				user.getUserField(inviteData.uid, iid, next);
			},
			function (iid, next) {
				if (!!iid) {
					return invite.getInviteField(iid, 'username', next);
				}
				next(null, '管理员');
			},
			function (username, next) {
				inviteData.from_invite_username = username;
				db.setObject('invite:' + iid, {invited: 1, invitedTime: timestamp, status: 'invited'}, next);
			},
			function(next) {
				// invite:time 记录邀请时间和iid 该表用于执行定时任务
				db.sortedSetAdd('invite:time', iid, timestamp, next);
			},
			function (next) {
				// 邀请链接到期设置
				db.pexpireAt('confirm:' + register_code, Math.floor(timestamp + jobs.expire.time()), next);
			}
		], function (err) {
			if (err) {
				return callback(err);
			}

			// for test when NODE_ENV is development
			if (inviteData.email.indexOf('@test.com') !== -1 && process.env.NODE_ENV === 'development') {
				console.log('invite development test');
				return callback();
			}

			var params = {
				email: inviteData.email,
				uid: inviteData.uid,
				template: 'invite',
				username: inviteData.username,
				from_username: inviteData.from_username,
				register_link: register_link,
				from_invite_username: inviteData.from_invite_username
			};
			if (plugins.hasListeners('action:email.send')) {
				emailer.sendPlus(params, callback);
			} else {
				callback(new Error('[[error:no-emailers-configured]]'));
			}
		});
	};
};
