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
				parseBodyShort({
					template: 'upvote',
					username: inviteData.username,
					invitedByUsername: inviteData.invitedByUsername
				}, next);
			},
			function (bodyShort, next) {
				user.notifications.sendNotification({
					bodyShort: bodyShort,
					path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
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
					username: inviteData.username
				}, next);
			},
			function (bodyShort, next) {
				user.notifications.sendNotification({
					bodyShort: bodyShort,
					path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
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
					path: nconf.get('relative_path') + '/invite/' + userData.invitedBySlug,
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
					path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
					nid: 'invite:iid:' + inviteData.iid + ':uid:'+ userData.uid + ':warned',
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
					path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
					nid: 'invite:iid:' + inviteData.iid + ':uid:'+ userData.uid + ':expired',
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
};
