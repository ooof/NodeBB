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
	// 通知全站用户参与提名
	Invite.sendUpvoteNotification = function (inviteData, callback) {
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

	// 通知所有投票用户提名已通过并已发出邀请
	Invite.sendInvitedNotification = function (inviteData, uid, iid, callback) {
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

	Invite.sendJoinedNotification = function (uid, userData, callback) {
		// step: 3
		user.notifications.sendNotification({
			bodyShort: '[[invite:notification.joined, ' + userData.invitedByUsername + ', ' + userData.inviteUsername + ']]',
			path: nconf.get('relative_path') + '/invite/' + userData.invitedBySlug,
			uid: uid,
			iid: userData.iid,
			nid: 'joined:' + uid,
			score: 'votedUids',
			step: 3
		}, callback);
	};

	// 通知所有投票用户提名即将过期
	Invite.sendWarnNotification = function (userData, inviteData, callback) {
		// step: 4
		user.notifications.sendNotification({
			bodyShort: userData.username + '，您参与提名或投票 ' + inviteData.username + ' 的邀请邮件已经发出' + jobs.warn.text() + '，但到目前还没有注册进入社区，觉得需要的话，可以以您觉得合适的方式通知他本人查收一下邮件。',
			path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
			nid: 'invite:iid:' + inviteData.iid + ':uid:'+ userData.uid + ':warned',
			uid: userData.uid,
			iid: inviteData.iid,
			score: 'somebody',
			step: 4
		}, callback);
	};

	// 通知投票用户提名已过期
	Invite.sendExpireNotification = function (userData, inviteData, callback) {
		// step: 5
		user.notifications.sendNotification({
			bodyShort: userData.username + '，您参与提名或投票 ' + inviteData.username + ' 的邀请邮件已经发出' + jobs.expire.text() + '，但到目前还没有注册进入社区，该提名已过期。',
			path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
			nid: 'invite:iid:' + inviteData.iid + ':uid:'+ userData.uid + ':expired',
			uid: userData.uid,
			iid: inviteData.iid,
			score: 'somebody',
			step: 5
		}, callback);
	};

	// 通知提名人
	Invite.sendExitNotificationToInviter = function (userData, callback) {
		user.notifications.sendNotification({
			bodyShort: '您提名的' + userData.invitedUsername + '已被删除',
			nid: 'user:deleted:' + userData.uid,
			uid: userData.invitedByUid,
			score: 'somebody'
		}, callback);
	};
};
