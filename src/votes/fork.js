'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('../database'),

	posts = require('../posts'),
	privileges = require('../privileges'),
	postTools = require('../postTools'),
	plugins = require('../plugins'),
	threadTools = require('../threadTools');

module.exports = function(Votes) {
	Votes.createVoteFromPosts = function(uid, title, pids, callback) {
		if (title) {
			title = title.trim();
		}

		if (!title) {
			return callback(new Error('[[error:invalid-title]]'));
		}

		if (!pids || !pids.length) {
			return callback(new Error('[[error:invalid-pid]]'));
		}

		pids.sort(function(a, b) {
			return a - b;
		});
		var mainPid = pids[0];

		async.parallel({
			postData: function(callback) {
				posts.getPostData(mainPid, callback);
			},
			cid: function(callback) {
				posts.getCidByPid(mainPid, callback);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			Votes.create({uid: results.postData.uid, title: title, cid: results.cid}, function(err, vid) {
				if (err) {
					return callback(err);
				}

				async.eachSeries(pids, move, function(err) {
					if (err) {
						return callback(err);
					}

					Votes.updateTimestamp(vid, Date.now(), function(err) {
						if (err) {
							return callback(err);
						}
						Votes.getVoteData(vid, callback);
					});
				});

				function move(pid, next) {
					privileges.posts.canEdit(pid, uid, function(err, canEdit) {
						if(err || !canEdit) {
							return next(err);
						}

						Votes.movePostToVote(pid, vid, next);
					});
				}
			});
		});
	};

	Votes.movePostToVote = function(pid, vid, callback) {
		var postData;
		async.waterfall([
			function(next) {
				Votes.exists(vid, next);
			},
			function(exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-vote]]'));
				}
				posts.getPostFields(pid, ['vid', 'timestamp', 'votes'], next);
			},
			function(post, next) {
				if (!post || !post.vid) {
					return next(new Error('[[error:no-post]]'));
				}

				if (parseInt(post.vid, 10) === parseInt(vid, 10)) {
					return next(new Error('[[error:cant-move-to-same-vote]]'))
				}

				postData = post;
				postData.pid = pid;

				Votes.removePostFromVote(postData.vid, pid, next);
			},
			function(next) {
				async.parallel([
					function(next) {
						Votes.decreasePostCount(postData.vid, next);
					},
					function(next) {
						Votes.increasePostCount(vid, next);
					},
					function(next) {
						posts.setPostField(pid, 'vid', vid, next);
					},
					function(next) {
						Votes.addPostToVote(vid, pid, postData.timestamp, postData.votes, next);
					}
				], next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:post.move', {post: postData, vid: vid});
			callback();
		});
	};
};
