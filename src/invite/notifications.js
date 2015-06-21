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
	templates = require('templates.js'),
	emailer = require('../emailer');

module.exports = function (Invite) {
	function parseBodyShort(params, callback) {
		templates.parse(meta.config['notification:invite:' + params.template], params, function (data) {
			callback(null, data);
		});
	}

	// 通知全站用户参与提名
	Invite.sendUpvoteNotification = function (inviteData, callback) {
		// step: 1
		async.waterfall([
			function (next) {
				user.getUidsFromSet('users:joindate', 0, -1, function (err, uids) {
					if (err || !Array.isArray(uids) || !uids.length) {
						return;
					}

					for (var i = 0, l = uids.length; i < l; i++) {
						uids[i] = parseInt(uids[i], 10);
					}

					uids = uids.filter(function (uid) {
						return uid !== inviteData.uid;
					});

					next(null, uids);
				});
			},
			function (uids, next) {
				async.each(uids, function (uid, next) {
					user.getUserFields(uid, ['username', 'email'], function (err, data) {
						var params = {
							email: data.email,
							uid: uid,
							template: 'invite:upvote',
							username: inviteData.username,
							link: nconf.get('url') + '/invite/' + inviteData.slug,
							emailUsername: data.username,
							invitedByUsername: inviteData.invitedByUsername
						};
						emailer.sendPlus(params, next);
					});
				}, function (err) {
					if (err) {
						return next(err);
					}
					next();
				});
			},
			function (next) {
				parseBodyShort({
					template: 'upvote',
					username: inviteData.username,
					invitedByUsername: inviteData.invitedByUsername
				}, next);
			},
			function (bodyShort, next) {
				user.notifications.sendNotification({
					bodyShort: bodyShort,
					path: nconf.get('url') + '/invite/' + inviteData.slug,
					nid: 'upvote:' + inviteData.iid,
					uid: inviteData.uid,
					iid: inviteData.iid,
					score: 'other',
					step: 1
				}, next);
			}
		], callback);
	};

	// 通知所有投票用户提名已通过并已发出邀请
	Invite.sendInvitedNotification = function (inviteData, uid, iid, callback) {
		// step: 2
		async.waterfall([
			function (next) {
				parseBodyShort({
					template: 'invited',
					username: inviteData.username,
					invitedByUsername: inviteData.invitedByUsername
				}, next);
			},
			function (bodyShort, next) {
				user.notifications.sendNotification({
					bodyShort: bodyShort,
					path: nconf.get('url') + '/invite/' + inviteData.slug,
					nid: 'invited:uid:' + uid + ':iid:' + iid,
					uid: uid,
					iid: iid,
					score: 'other',
					step: 2
				}, next);
			}
		], callback);
	};

	Invite.sendJoinedNotification = function (uid, userData, callback) {
		// step: 3
		async.waterfall([
			function (next) {
				parseBodyShort({
					template: 'joined',
					username: userData.invitedUsername,
					invitedByUsername: userData.invitedByUsername
				}, next);
			},
			function (bodyShort, next) {
				user.notifications.sendNotification({
					bodyShort: bodyShort,
					path: nconf.get('url') + '/invite/' + userData.invitedBySlug,
					uid: uid,
					iid: userData.iid,
					nid: 'joined:' + uid,
					score: 'votedUids',
					step: 3
				}, next);
			}
		], callback);
	};

	// 通知所有投票用户提名即将过期
	Invite.sendWarnNotification = function (userData, inviteData, callback) {
		// step: 4
		async.waterfall([
			function (next) {
				parseBodyShort({
					template: 'warn',
					username: inviteData.username,
					upvoteByUsername: userData.username,
					time: jobs.warn.text()
				}, next);
			},
			function (bodyShort, next) {
				user.notifications.sendNotification({
					bodyShort: bodyShort,
					path: nconf.get('url') + '/invite/' + inviteData.slug,
					nid: 'invite:iid:' + inviteData.iid + ':uid:' + userData.uid + ':warned',
					uid: userData.uid,
					iid: inviteData.iid,
					score: 'somebody',
					step: 4
				}, next);
			}
		], callback);
	};

	// 通知投票用户提名已过期
	Invite.sendExpireNotification = function (userData, inviteData, callback) {
		// step: 5
		async.waterfall([
			function (next) {
				parseBodyShort({
					template: 'expire',
					username: inviteData.username,
					upvoteByUsername: userData.username,
					time: jobs.expire.text()
				}, next);
			},
			function (bodyShort, next) {
				user.notifications.sendNotification({
					bodyShort: bodyShort,
					path: nconf.get('url') + '/invite/' + inviteData.slug,
					nid: 'invite:iid:' + inviteData.iid + ':uid:' + userData.uid + ':expired',
					uid: userData.uid,
					iid: inviteData.iid,
					score: 'somebody',
					step: 5
				}, next);
			}
		], callback);
	};

	// 通知提名人
	Invite.sendExitNotificationToInviter = function (userData, callback) {
		async.waterfall([
			function (next) {
				parseBodyShort({
					template: 'exit',
					username: userData.invitedUsername
				}, next);
			},
			function (bodyShort, next) {
				user.notifications.sendNotification({
					bodyShort: bodyShort,
					nid: 'user:deleted:' + userData.uid,
					uid: userData.invitedByUid,
					score: 'somebody'
				}, next);
			}
		], callback);
	};

	// 通知投票人
	Invite.sendExitNotificationToUpvote = function (userData, callback) {
		async.waterfall([
			function (next) {
				parseBodyShort({
					template: 'exit:2',
					username: userData.invitedUsername
				}, next);
			},
			function (bodyShort, next) {
				user.notifications.sendNotification({
					bodyShort: bodyShort,
					path: nconf.get('url') + '/invite/' + userData.invitedBySlug,
					nid: 'user:deleted:upvote:' + userData.uid,
					uid: userData.invitedByUid,
					iid: userData.iid,
					score: 'votedUids'
				}, next);
			}
		], callback);
	};
};
