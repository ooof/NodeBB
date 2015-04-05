'use strict';

var async = require('async'),
	validator = require('validator'),
	nconf = require('nconf'),
	db = require('../database'),
	utils = require('../../public/src/utils'),
	plugins = require('../plugins'),
	user = require('../user'),
	meta = require('../meta'),
	posts = require('../posts'),
	threadTools = require('../threadTools'),
	postTools = require('../postTools'),
	privileges = require('../privileges'),
	categories = require('../categories');

module.exports = function (Invite) {
	Invite.create = function (data, callback) {
		var uid = data.uid,
			username = data.username,
			email = data.email,
			content = data.content;

		db.incrObjectField('global', 'nextIid', function (err, iid) {
			if (err) {
				return callback(err);
			}

			var slug = utils.slugify(username),
				timestamp = Date.now();

			if (!slug.length) {
				return callback(new Error('[[error:invalid-username]]'));
			}

			slug = iid + '/' + slug;

			var inviteData = {
				'iid': iid,
				'uid': uid,
				'username': username,
				'content': content,
				'email': email,
				'joined': 0,
				'editor': '',
				'edited': 0,
				'invited': 0,
				'slug': slug,
				'timestamp': timestamp,
				'lastvotetime': 0,
				'joinedTime': 0,
				'invitedTime': 0,
				'viewcount': 0,
				'inviteCount': 0,
				'locked': 0,
				'deleted': 0,
				'pinned': 0
			};

			db.setObject('invite:' + iid, inviteData, function (err) {
				if (err) {
					return callback(err);
				}

				// invite:posts:iid 所有的邀请贴 iid
				// username:iid 邀请贴对应的用户名
				// userslug:iid 邀请贴对应的url标识符
				// email:iid 邀请贴对应的邮箱

				async.parallel([
					function (next) {
						db.sortedSetAdd('invite:posts:iid', timestamp, iid, next);
					},
					function (next) {
						user.addInviteIdToUser(uid, iid, timestamp, next);
					},
					function (next) {
						db.incrObjectField('global', 'inviteCount', next);
					},
					function(next) {
						db.setObjectField('username:iid:invite', username, iid, next);
					},
					function(next) {
						db.setObjectField('userslug:iid', slug, iid, next);
					},
					function(next) {
						db.setObjectField('email:iid', email, iid, next);
					},
					function (next) {
						Invite.upVote(uid, iid, next);
					}
				], function (err) {
					if (err) {
						return callback(err);
					}
					callback(null, inviteData);
				});
			});
		});
	};

	Invite.post = function (data, callback) {
		var uid = data.uid,
			username = data.username,
			email = data.email,
			content = data.content;

		async.waterfall([
			function (next) {
				if (username) {
					username = username.trim();
				}

				if (!username || username.length < parseInt(meta.config.minimumUsernameLength, 10)) {
					return callback(new Error('[[error:username-too-short, ' + meta.config.minimumUsernameLength + ']]'));
				} else if (username.length > parseInt(meta.config.maximumUsernameLength, 10)) {
					return callback(new Error('[[error:username-too-long, ' + meta.config.maximumUsernameLength + ']]'));
				}

				Invite.usernameExists(username, function (err, exist) {
					if (err) {
						return next(err);
					}

					if (exist) {
						return next(new Error('[[error:username-taken]]'));
					}

					next();
				})
			},
			function (next) {
				if (email) {
					email = email.trim();
				}

				if (!email || email.length < 1 || !utils.isEmailValid(email)) {
					return callback(new Error('[[error:invalid-email]]'));
				}

				Invite.emailExists(email, function (err, exist) {
					if (err) {
						return next(err);
					}

					if (exist) {
						return callback(new Error('[[error:email-taken]]'));
					}

					next();
				})
			},
			function (next) {
				checkContentLength(content, next);
			},
			function (next) {
				user.isReadyToPost(uid, next);
			},
			function (next) {
				Invite.create({uid: uid, username: data.username, content: content, email: data.email}, next);
			},
			function (inviteData, next) {
				if (parseInt(uid, 10)) {
					user.notifications.sendNotification({
						bodyShort: '[[invite:notification.inviting, ' + username + ']]',
						path: nconf.get('relative_path') + '/invite/' + utils.slugify(inviteData.username),
						nid: 'inviting:' + inviteData.iid,
						uid: uid,
						score: 'other'
					});
				}

				next(null, inviteData);
			}
		], callback);
	};

	Invite.edit = function (data, callback) {
		var inviteData = {
			edited: Date.now(),
			editor: data.uid,
			email: data.email,
			username: data.username.trim(),
			content: data.content
		};

		Invite.setInviteFields(data.iid, inviteData, function (err) {
			if (err) {
				return callback(err);
			}
			callback(null, inviteData);
		});
	};

	function checkContentLength(content, callback) {
		if (!content || content.length < parseInt(meta.config.miminumPostLength, 10)) {
			return callback(new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]'));
		} else if (content.length > parseInt(meta.config.maximumPostLength, 10)) {
			return callback(new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]'));
		}
		callback();
	}
};
