'use strict';

var async = require('async'),

	meta = require('../meta'),
	db = require('../database'),
	plugins = require('../plugins'),
	user = require('../user'),
	topics = require('../topics'),
	votes = require('../invite'),
	categories = require('../categories');


module.exports = function(Posts) {
	Posts.create = function(data, callback) {
		// This is an internal method, consider using Topics.reply instead
		var uid = data.uid,
			tid = data.tid,
			vid = data.vid ? data.vid : '',
			content = data.content.toString(),
			timestamp = data.timestamp || Date.now();

		if (!uid && parseInt(uid, 10) !== 0) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		var postData;

		async.waterfall([
			function(next) {
				db.incrObjectField('global', 'nextPid', next);
			},
			function(pid, next) {

				postData = {
					'pid': pid,
					'uid': uid,
					'content': content,
					'timestamp': timestamp,
					'reputation': 0,
					'votes': 0,
					'editor': '',
					'edited': 0,
					'deleted': 0
				};

				if (tid) {
					postData.tid = tid
				} else if (vid) {
					postData.vid = vid
				}

				if (data.toPid) {
					postData.toPid = data.toPid;
				}

				if (data.ip && parseInt(meta.config.trackIpPerPost, 10) === 1) {
					postData.ip = data.ip;
				}

				if (parseInt(uid, 10) === 0 && data.handle) {
					postData.handle = data.handle;
				}

				plugins.fireHook('filter:post.save', postData, next);
			},
			function(postData, next) {
				db.setObject('post:' + postData.pid, postData, next);
			},
			function(next) {
				async.parallel([
					function(next) {
						user.onNewPostMade(postData, next);
					},
					function(next) {
						if (postData.vid) {
							votes.onNewPostMade(postData, next);
						} else {
							topics.onNewPostMade(postData, next);
						}
					},
					function(next) {
						if (postData.vid) {
							votes.getVoteField(vid, 'pinned', function(err, voteData) {
								if (err) {
									return next(err);
								}
								votes.list.onNewPostMade(voteData.pinned, postData, next);
							});
						} else {
                            topics.getTopicFields(tid, ['cid', 'pinned'], function(err, topicData) {
                                if (err) {
                                    return next(err);
                                }
                                postData.cid = topicData.cid;
                                categories.onNewPostMade(topicData.cid, topicData.pinned, postData, next);
                            });
						}
					},
					function(next) {
						db.sortedSetAdd('posts:pid', timestamp, postData.pid, next);
					},
					function(next) {
						db.incrObjectField('global', 'postCount', next);
					}
				], function(err) {
					if (err) {
						return next(err);
					}
					plugins.fireHook('filter:post.get', postData, next);
				});
			},
			function(postData, next) {
				plugins.fireHook('action:post.save', postData);
				next(null, postData);
			}
		], callback);
	};
};


