'use strict';

var async = require('async'),
	S = require('string'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	plugins = require('../plugins'),
	postTools = require('../postTools'),
	utils = require('../../public/src/utils');

module.exports = function(Votes) {
	Votes.getTeasers = function(votes, callback) {
		if (!Array.isArray(votes) || !votes.length) {
			return callback(null, []);
		}

		var counts = [];
		var teaserPids = [];

		votes.forEach(function(vote) {
			counts.push(vote && (parseInt(vote.postcount, 10) || 0));
			if (vote && vote.teaserPid) {
				teaserPids.push(vote.teaserPid);
			}
		});

		posts.getPostsFields(teaserPids, ['pid', 'uid', 'timestamp', 'tid', 'content'], function(err, postData) {
			if (err) {
				return callback(err);
			}

			var uids = postData.map(function(post) {
				return post.uid;
			}).filter(function(uid, index, array) {
				return array.indexOf(uid) === index;
			});

			user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], function(err, usersData) {
				if (err) {
					return callback(err);
				}

				var users = {};
				usersData.forEach(function(user) {
					users[user.uid] = user;
				});
				var tidToPost = {};

				async.each(postData, function(post, next) {
					post.user = users[post.uid];
					post.timestamp = utils.toISOString(post.timestamp);
					tidToPost[post.tid] = post;
					postTools.parsePost(post, next);
				}, function(err) {
					if (err) {
						return callback(err);
					}
					var teasers = topics.map(function(topic, index) {
						if (tidToPost[topic.tid]) {
							tidToPost[topic.tid].index = counts[index];
							if (tidToPost[topic.tid].content) {
								var s = S(tidToPost[topic.tid].content);
								tidToPost[topic.tid].content = s.stripTags.apply(s, utils.stripTags).s;
							}
						}
						return tidToPost[topic.tid];
					});

					plugins.fireHook('filter:teasers.get', {teasers: teasers}, function(err, data) {
						callback(err, data ? data.teasers : null);
					});
				});
			});
		});
	};

	Votes.getTeasersByTids = function(tids, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}
		async.waterfall([
			function(next) {
				Votes.getVotesFields(tids, ['tid', 'postcount', 'teaserPid'], next);
			},
			function(votes, next) {
				Votes.getTeasers(votes, next);
			}
		], callback);
	};

	Votes.getTeaser = function(tid, callback) {
		Votes.getTeasersByTids([tid], function(err, teasers) {
			callback(err, Array.isArray(teasers) && teasers.length ? teasers[0] : null);
		});
	};

	Votes.updateTeaser = function(vid, callback) {
		db.getSortedSetRevRange('vid:' + vid + ':posts', 0, 0, function(err, pids) {
			if (err) {
				return callback(err);
			}
			var pid = Array.isArray(pids) && pids.length ? pids[0] : null;
			Votes.setVoteField(vid, 'teaserPid', pid, callback);
		});
	};
};
