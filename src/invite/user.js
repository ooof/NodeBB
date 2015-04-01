'use strict';

var db = require('../database'),
	nconf = require('nconf'),
	async = require('async'),
	meta = require('../meta'),
	utils = require('../../public/src/utils'),
	plugins = require('../plugins'),
	user = require('../user'),
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

	Invite.emailExists = function(email, callback) {
		if (email) {
			async.waterfall([
				function (next) {
					user.email.exists(email, next);
				},
				function (exists, next) {
					if (exists) {
						return next(null, exists)
					}

					Invite.getIidByEmail(email.toLowerCase(), function(err, exists) {
						callback(err, !!exists);
					});
				}
			], function (err, exists) {
				if (err) {
					return callback(err);
				}

				callback(null, exists);
			});
		}
	};

	Invite.usernameExists = function(username, callback) {
		if (username) {
			async.waterfall([
				function (next) {
					meta.userOrGroupExists(utils.slugify(username), next);
				},
				function (exists, next) {
					if (exists) {
						return next(null, exists)
					}

					Invite.getIidBySlug(utils.slugify(username), function(err, exists) {
						callback(err, !!exists);
					});
				}
			], function (err, exists) {
				if (err) {
					return callback(err);
				}

				callback(null, exists);
			})
		}
	};

	Invite.getIidByEmail = function(email, callback) {
		db.getObjectField('email:iid', email.toLowerCase(), callback);
	};

	Invite.getIidBySlug = function(slug, callback) {
		db.getObjectField('userslug:iid', slug, callback);
	};

	Invite.inviteUser = function (uid, iid, count, callback) {
		db.getObjectField('global', 'nextUid', function (err, userCount) {
			if (err) {
				return callback(err);
			}

			count = parseInt(count, 10);
			userCount = parseInt(userCount, 10);

			var percent = count / userCount >= .5;

			if (percent) {
				db.getObjectFields('invite:' + iid, ['slug', 'username'], function (err, inviteData) {
					if (err) {
						return callback(err);
					}

					var tempData = {};
					tempData.path = nconf.get('relative_path') + '/invite/' + inviteData.slug;
					tempData.bodyShort = '对' + inviteData.username + '的邀请达到票数，已邀请加入社区';
					tempData.iid = iid;

					user.notifications.sendInviteNotificationToOther(uid, tempData);

					return Invite.sendUser(uid, iid, function () {
						db.setObjectField('invite:' + iid, 'invited', 1, callback)
					});
				});
			}
			callback();
		});
	};

	Invite.sendUser = function (uid, iid, callback) {
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
				db.setObjectField('invite:' + iid, 'invited', 1, next);
			},
			function (next) {
				db.setObjectField('invite:' + iid, 'invitedTime', Date.now(), next);
			},
			function (next) {
				db.expireAt('confirm:' + invite_code, Math.floor(Date.now() / 1000 + 60 * 60 * 24), next);
			}
		], function (err) {
			if (err) {
				return callback(err);
			}

			var params = {
				email: userData.email,
				invite_link: invite_link,
				subject: userData.username + ', 有朋友邀请您进入一个社区',
				fromname: 'Inviting',
				template: 'invite',
				site_title: meta.config.title || 'NodeBB',
				username: userData.username
			};
			if (plugins.hasListeners('action:email.send')) {
				emailer.sendInvite('invite', uid, params, callback);
			} else {
				callback(new Error('[[error:no-emailers-configured]]'));
			}
		});
	};
};
