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

	Invite.getIidByUsername = function(username, callback) {
		db.getObjectField('username:iid:invite', username, callback);
	};

	Invite.inviteUser = function (uid, iid, voteCount, callback) {
		async.waterfall([
			function (next) {
				db.getObjectField('global', 'userCount', next);
			},
			function (userCount, next) {
				voteCount = parseInt(voteCount, 10);
				userCount = parseInt(userCount, 10);

				var votePercent = voteCount / userCount >= (meta.config.votePercent ? meta.config.votePercent/100 : 0.5);
				next(null, votePercent);
			},
			function (votePercent, next) {
				if (votePercent) {
					return db.getObjectFields('invite:' + iid, ['slug', 'username'], function (err, inviteData) {
						if (err) {
							return callback(err);
						}

						user.notifications.sendNotification({
							bodyShort: '[[invite:notification.invited, ' + inviteData.username + ']]',
							path: nconf.get('relative_path') + '/invite/' + inviteData.slug,
							score: 'votedUids',
							uid: uid,
							iid: iid,
							nid: 'upvote:uid:' + uid + ':iid:' + iid
						});

						Invite.sendUser(uid, iid, function (err) {
							if (err) {
								return next(err);
							}
							db.setObjectField('invite:' + iid, 'invited', 1, next)
						});
					});
				}
				next();
			}
		], callback);
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
				// 邀请链接7天到期
				db.expireAt('confirm:' + invite_code, Math.floor(Date.now() / 1000 + 60 * 60 * 24 * 7), next);
			}
		], function (err) {
			if (err) {
				return callback(err);
			}

			// for test
			if ((userData.email.indexOf('yufeg.com') !== -1 || userData.email.indexOf('test') !== -1) && process.env.NODE_ENV === 'development') {
				console.log('development test');
				return callback();
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
