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

};
