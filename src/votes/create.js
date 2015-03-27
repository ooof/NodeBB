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

module.exports = function (Votes) {
	Votes.create = function (data, callback) {
		var uid = data.uid,
			username = data.username,
			email = data.email;

		db.incrObjectField('global', 'nextVid', function (err, vid) {
			if (err) {
				return callback(err);
			}

			var slug = utils.slugify(username),
				timestamp = Date.now();

			if (!slug.length) {
				return callback(new Error('[[error:invalid-username]]'));
			}

			slug = vid + '/' + slug;

			var voteData = {
				'vid': vid,
				'uid': uid,
				'username': username,
				'email': email,
				'joined': 0,
				'invited': 0,
				'mainPid': 0,
				'slug': slug,
				'timestamp': timestamp,
				'lastposttime': 0,
				'postcount': 0,
				'viewcount': 0,
				'locked': 0,
				'deleted': 0,
				'pinned': 0
			};

			if (data.thumb) {
				voteData.thumb = data.thumb;
			}

			db.setObject('vote:' + vid, voteData, function (err) {
				if (err) {
					return callback(err);
				}

				async.parallel([
					function (next) {
						db.sortedSetsAdd([
							'votes:vid',
							'vote_list:vids',
							'vote_list:uid:' + uid + ':vids'
						], timestamp, vid, next);
					},
					function (next) {
						user.addVoteIdToUser(uid, vid, timestamp, next);
					},
					function (next) {
						db.incrObjectField('global', 'voteCount', next);
					}
				], function (err) {
					if (err) {
						return callback(err);
					}
					callback(null, vid);
				});
			});
		});
	};

	Votes.post = function (data, callback) {
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
				content = data.content;
				Votes.create({uid: uid, username: data.username, email: data.email}, next);
			},
			function (vid, next) {
				Votes.reply({uid: uid, vid: vid, handle: data.handle, content: content, req: data.req}, next);
			},
			function (postData, next) {
				async.parallel({
					postData: function (next) {
						next(null, postData);
					},
					settings: function (next) {
						user.getSettings(uid, function (err, settings) {
							if (err) {
								return next(err);
							}
							if (settings.followVotesOnCreate) {
								Votes.follow(postData.vid, uid, next);
							} else {
								next();
							}
						});
					},
					voteData: function (next) {
						Votes.getVotesByVids([postData.vid], uid, next);
					}
				}, next);
			},
			function (data, next) {
				if (!Array.isArray(data.voteData) || !data.voteData.length) {
					return next(new Error('[[error:no-vote]]'));
				}

				data.voteData = data.voteData[0];
				data.voteData.unreplied = 1;
				data.voteData.mainPost = data.postData;

				plugins.fireHook('action:vote.post', data.voteData);

				if (parseInt(uid, 10)) {
					user.notifications.sendVoteNotificationToFollowers(uid, data.voteData, data.postData);
				}

				next(null, {
					voteData: data.voteData,
					postData: data.postData
				});
			}
		], callback);
	};

	Votes.reply = function (data, callback) {
		var vid = data.vid,
			uid = data.uid,
			content = data.content,
			postData;

		async.waterfall([
			function (next) {
				async.parallel({
					exists: async.apply(Votes.exists, vid),
					locked: async.apply(Votes.isLocked, vid),
					isAdmin: async.apply(user.isAdministrator, uid)
				}, next);
			},
			function (results, next) {
				if (!results.exists) {
					return next(new Error('[[error:no-vote]]'));
				}
				if (results.locked && !results.isAdmin) {
					return next(new Error('[[error:vote-locked]]'));
				}

				user.isReadyToPost(uid, next);
			},
			function (next) {
				content = data.content;
				if (content) {
					content = content.trim();
				}

				checkContentLength(content, next);
			},
			function (next) {
				posts.create({uid: uid, vid: vid, handle: data.handle, content: content, toPid: data.toPid, ip: data.req ? data.req.ip : null}, next);
			},
			function (data, next) {
				postData = data;
				Votes.markAsUnreadForAll(next);
			},
			function (next) {
				Votes.markAsRead([vid], uid, next);
			},
			function (next) {
				async.parallel({
					userInfo: function (next) {
						posts.getUserInfoForPosts([postData.uid], uid, next);
					},
					voteInfo: function (next) {
						Votes.getVoteFields(vid, ['vid', 'username', 'email', 'slug', 'postcount'], next);
					},
					settings: function (next) {
						user.getSettings(uid, next);
					},
					postIndex: function (next) {
						posts.getPidIndex(postData.pid, uid, next);
					},
					content: function (next) {
						postTools.parsePost(postData, next);
					}
				}, next);
			},
			function (results, next) {
				postData.user = results.userInfo[0];
				postData.vote = results.voteInfo;

				// Username override for guests, if enabled
				if (parseInt(meta.config.allowGuestHandles, 10) === 1 && parseInt(postData.uid, 10) === 0 && data.handle) {
					postData.user.username = data.handle;
				}

				if (results.settings.followVotesOnReply) {
					Votes.follow(postData.tid, uid);
				}
				postData.index = results.postIndex - 1;
				postData.favourited = false;
				postData.votes = 0;
				postData.display_moderator_tools = true;
				postData.display_move_tools = true;
				postData.selfPost = false;
				postData.relativeTime = utils.toISOString(postData.timestamp);

				if (parseInt(uid, 10)) {
					Votes.notifyFollowers(postData, uid);
				}

				postData.vote.username = validator.escape(postData.vote.username);
				next(null, postData);
			}
		], callback);
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
