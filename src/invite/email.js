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
	// 提名成功后给提名人发送邮件
	Invite.sendSuccessEmail = function (inviteData, callback) {
		callback = callback || function() {};
		var params = {
			uid: inviteData.uid,
			template: 'inviteSuccess',
			username: inviteData.invitedByUsername,
			invite_username: inviteData.username,
			invite_link: nconf.get('relative_path') + '/invite/' + inviteData.slug
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
			invite_link: nconf.get('relative_path') + '/invite/' + inviteData.slug,
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
			invite_link: nconf.get('relative_path') + '/invite/' + inviteData.slug,
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
		console.log(uid);
		async.waterfall([
			function (next) {
				user.getUserField(uid, 'iid', next);
			},
			function (iid, next) {
				Invite.getInviteFields(iid, ['uid', 'invitedByUsername', 'username', 'slug'], next);
			},
			function (inviteData, next) {
				console.log(inviteData);
				var params = {
					uid: inviteData.uid,
					template: 'inviteExit',
					username: inviteData.invitedByUsername,
					invite_username: inviteData.username,
					invite_link: nconf.get('relative_path') + '/invite/' + inviteData.slug
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
