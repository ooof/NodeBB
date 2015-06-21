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

	// 提名成功后给提名人发送邮件
	Invite.sendSuccessEmail = function (inviteData, callback) {
		callback = callback || function() {};
		var params = {
			uid: inviteData.uid,
			template: 'inviteSuccess',
			username: inviteData.invitedByUsername,
			invite_username: inviteData.username,
			invite_link: nconf.get('url') + '/invite/' + inviteData.slug,
			count: inviteData.inviteCount
		};

		if (plugins.hasListeners('action:email.send')) {
			emailer.sendPlus(params, callback);
		} else {
			callback(new Error('[[error:no-emailers-configured]]'));
		}
	};

	// 提名成功后给提名人发送邮件
	Invite.sendInvitedSuccessEmail = function (inviteData, callback) {
		callback = callback || function() {};
		var params = {
			uid: inviteData.uid,
			template: 'inviteSuccess',
			username: inviteData.invitedByUsername,
			invite_username: inviteData.username,
			link: nconf.get('url') + '/invite/' + inviteData.slug
		};

		if (plugins.hasListeners('action:email.send')) {
			emailer.sendPlus(params, callback);
		} else {
			callback(new Error('[[error:no-emailers-configured]]'));
		}
	};

	// 给提名人发送过期通知邮件
	Invite.sendWarnEmail = function (inviteData, callback) {
		callback = callback || function() {};
		var params = {
			uid: inviteData.uid,
			template: 'inviteWarn',
			username: inviteData.invitedByUsername,
			invite_username: inviteData.username,
			invite_link: nconf.get('url') + '/invite/' + inviteData.slug,
			warn_time: jobs.warn.text()
		};
		if (plugins.hasListeners('action:email.send')) {
			emailer.sendPlus(params, callback);
		} else {
			callback(new Error('[[error:no-emailers-configured]]'));
		}
	};

	// 提名失败后，给提名人发送邮件告知
	Invite.sendExpireEmail = function (inviteData, callback) {
		callback = callback || function() {};
		var params = {
			uid: inviteData.uid,
			template: 'inviteFailed',
			username: inviteData.invitedByUsername,
			invite_username: inviteData.username,
			invite_link: nconf.get('url') + '/invite/' + inviteData.slug,
			expire_time: jobs.expire.text()
		};
		if (plugins.hasListeners('action:email.send')) {
			emailer.sendPlus(params, callback);
		} else {
			callback(new Error('[[error:no-emailers-configured]]'));
		}
	};

	// 被提名的用户退出社区后，给提名人发送邮件告知
	Invite.sendExitEmail = function (uid, callback) {
		async.waterfall([
			function (next) {
				user.getUserField(uid, 'iid', next);
			},
			function (iid, next) {
				Invite.getInviteFields(iid, ['uid', 'invitedByUsername', 'username', 'slug'], next);
			},
			function (inviteData, next) {
				var params = {
					uid: inviteData.uid,
					template: 'inviteExit',
					username: inviteData.invitedByUsername,
					invite_username: inviteData.username,
					invite_link: nconf.get('url') + '/invite/' + inviteData.slug
				};
				if (plugins.hasListeners('action:email.send')) {
					emailer.sendPlus(params, next);
				} else {
					next(new Error('[[error:no-emailers-configured]]'));
				}
			}
		], callback);
	};
};
