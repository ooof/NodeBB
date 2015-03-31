'use strict';

var db = require('../database'),
	nconf = require('nconf'),
	async = require('async'),
	meta = require('../meta'),
	utils = require('../../public/src/utils'),
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

	Invite.inviteUser = function (iid, count, callback) {
		db.getObjectField('global', 'nextUid', function (err, userCount) {
			if (err) {
				return callback(err);
			}

			count = parseInt(count, 10);
			userCount = parseInt(userCount, 10);

			var percent = count / userCount > .5;

			console.log(percent);
			if (percent) {
				return Invite.sendUser(iid, function () {
					db.setObjectField('invite:' + iid, 'invited', 1, callback)
				});
			}
			callback();
		});
	};

	Invite.sendUser = function (iid, callback) {
		var userData,
			invite_code = utils.generateUUID(),
			invite_link = nconf.get('url') + '/register?code=' + invite_code;

		async.waterfall([
			function (next) {
				db.getObjectFields('invite:' + iid, ['username', 'email'], next);
			},
			function (data, next) {
				userData = data;
				db.setObject('confirm:' + invite_code, {
					email: data.email.toLowerCase(),
					username: data.username
				}, next);
			},
			function (next) {
				db.expireAt('confirm:' + invite_code, Math.floor(Date.now() / 1000 + 60 * 60 * 2), next);
			}
		], function (err) {
			if (err) {
				return callback(err);
			}

			var params = {
				username: userData.username,
				email: userData.email,
				invite_link: invite_link,
				subject: 'no-reply',
				template: 'invite'
			};
			if (plugins.hasListeners('action:email.send')) {
				emailer.sendInvite('invite', params);
				callback();
			} else {
				callback(new Error('[[error:no-emailers-configured]]'));
			}
		});
	};
};
