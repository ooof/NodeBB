'use strict';

var async = require('async'),
	nconf = require('nconf'),
	S = require('string'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	postTools = require('../postTools'),
	notifications = require('../notifications'),
	meta = require('../meta'),
	emailer = require('../emailer');

module.exports = function(Votes) {
	Votes.toggleFollow = function(vid, uid, callback) {
		callback = callback || function() {};
		var isFollowing;
		async.waterfall([
			function (next) {
				Votes.exists(vid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-vote]]'));
				}
				Votes.isFollowing([vid], uid, next);
			},
			function (_isFollowing, next) {
				isFollowing = _isFollowing[0];
				if (isFollowing) {
					Votes.unfollow(vid, uid, next);
				} else {
					Votes.follow(vid, uid, next);
				}
			},
			function(next) {
				next(null, !isFollowing);
			}
		], callback);
	};

	Votes.follow = function(vid, uid, callback) {
		callback = callback || function() {};
		async.waterfall([
			function (next) {
				Votes.exists(vid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-vote]]'));
				}
				db.setAdd('vid:' + vid + ':followers', uid, next);
			},
			function(next) {
				db.sortedSetAdd('uid:' + uid + ':followed_vids', Date.now(), vid, next);
			}
		], callback);
	};

	Votes.unfollow = function(vid, uid, callback) {
		callback = callback || function() {};
		async.waterfall([
			function (next) {
				Votes.exists(vid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-vote]]'));
				}
				db.setRemove('vid:' + vid + ':followers', uid, next);
			},
			function(next) {
				db.sortedSetRemove('uid:' + uid + ':followed_vids', vid, next);
			}
		], callback);
	};

	Votes.isFollowing = function(vids, uid, callback) {
		if (!Array.isArray(vids)) {
			return callback();
		}
		if (!parseInt(uid, 10)) {
			return callback(null, vids.map(function() { return false; }));
		}
		var keys = vids.map(function(vid) {
			return 'vid:' + vid + ':followers';
		});
		db.isMemberOfSets(keys, uid, callback);
	};

	Votes.getFollowers = function(vid, callback) {
		db.getSetMembers('vid:' + vid + ':followers', callback);
	};

	Votes.notifyFollowers = function(postData, exceptUid) {
		Votes.getFollowers(postData.vote.vid, function(err, followers) {
			if (err || !Array.isArray(followers) || !followers.length) {
				return;
			}

			var index = followers.indexOf(exceptUid.toString());
			if (index !== -1) {
				followers.splice(index, 1);
			}

			if (!followers.length) {
				return;
			}

			var username = postData.vote.username;
			if (username) {
				username = S(username).decodeHTMLEntities().s;
			}

			notifications.create({
				bodyShort: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + username + ']]',
				bodyLong: postData.content,
				pid: postData.pid,
				nid: 'vid:' + postData.vote.vid + ':pid:' + postData.pid + ':uid:' + exceptUid,
				vid: postData.vote.vid,
				from: exceptUid
			}, function(err, notification) {
				if (!err && notification) {
					notifications.push(notification, followers);
				}
			});

			async.eachLimit(followers, 3, function(toUid, next) {
				async.parallel({
					userData: async.apply(user.getUserFields, toUid, ['username']),
					userSettings: async.apply(user.getSettings, toUid)
				}, function(err, data) {
					if (data.userSettings.hasOwnProperty('sendPostNotifications') && data.userSettings.sendPostNotifications) {
						emailer.send('notif_post', toUid, {
							pid: postData.pid,
							subject: '[' + (meta.config.title || 'NodeBB') + '] ' + username,
							intro: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + username + ']]',
							postBody: postData.content,
							site_title: meta.config.title || 'NodeBB',
							username: data.userData.username,
							url: nconf.get('url') + '/vote/' + postData.vote.vid,
							base_url: nconf.get('url')
						}, next);
					} else {
						winston.debug('[topics.notifyFollowers] uid ' + toUid + ' does not have post notifications enabled, skipping.');
					}
				});
			});
		});
	};
};
