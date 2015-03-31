'use strict';

var async = require('async'),
	validator = require('validator'),
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
				'viewcount': 0,
				'invitecount': 1,
				'locked': 0,
				'deleted': 0,
				'pinned': 0
			};

			db.setObject('invite:' + iid, inviteData, function (err) {
				if (err) {
					return callback(err);
				}

				// invite:uid:{uid}:iids 存放不同用户支持了哪些邀请贴
				// invite:iid 存放所有的邀请贴
				async.parallel([
					function (next) {
						db.sortedSetsAdd([
							'invite:iid',
							'invite:uid:' + uid + ':iids'
						], timestamp, iid, next);
					},
					function (next) {
						user.addInviteIdToUser(uid, iid, timestamp, next);
					},
					function (next) {
						db.setAdd('invite:' + iid + ':by', uid, next);
					},
					function (next) {
						db.incrObjectField('global', 'inviteCount', next);
					},
					function (next) {
						Invite.inviteUser(iid, 1, next);
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

		if (username) {
			username = username.trim();
		}

		if (!username || username.length < parseInt(meta.config.minimumUsernameLength, 10)) {
			return callback(new Error('[[error:username-too-short, ' + meta.config.minimumUsernameLength + ']]'));
		} else if (username.length > parseInt(meta.config.maximumUsernameLength, 10)) {
			return callback(new Error('[[error:username-too-long, ' + meta.config.maximumUsernameLength + ']]'));
		}

		if (email) {
			email = email.trim();
		}

		if (!email || email.length < 1 || !utils.isEmailValid(email)) {
			return callback(new Error('[[error:invalid-email]]'));
		}

		async.waterfall([
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
				async.parallel({
					inviteData: function (next) {
						next(null, inviteData);
					},
					settings: function (next) {
						user.getSettings(uid, function (err, settings) {
							if (err) {
								return next(err);
							}
							if (settings.followVotesOnCreate) {
								Invite.follow(inviteData.iid, uid, next);
							} else {
								next();
							}
						});
					}
				}, next);
			},
			function (data, next) {
				if (parseInt(uid, 10)) {
					user.notifications.sendInviteNotificationToOther(uid, data.inviteData);
				}

				next(null, data.inviteData);
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
