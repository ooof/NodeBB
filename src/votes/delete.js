'use strict';

var async = require('async'),
	db = require('../database'),

	user = require('../user'),
	plugins = require('../plugins');

module.exports = function(Votes) {
	Votes.delete = function(vid, callback) {
		async.parallel([
			function(next) {
				Votes.setVoteField(vid, 'deleted', 1, next);
			},
			function(next) {
				db.sortedSetsRemove(['votes:recent', 'votes:posts', 'votes:views'], vid, next);
			}
		], callback);
	};

	Votes.restore = function(vid, callback) {
		Votes.getVoteFields(vid, ['lastposttime', 'postcount', 'viewcount'], function(err, voteData) {
			if (err) {
				return callback(err);
			}

			async.parallel([
				function(next) {
					Votes.setVoteField(vid, 'deleted', 0, next);
				},
				function(next) {
					Votes.updateRecent(vid, voteData.lastposttime, next);
				},
				function(next) {
					db.sortedSetAdd('votes:posts', voteData.postcount, vid, next);
				},
				function(next) {
					db.sortedSetAdd('votes:views', voteData.viewcount, vid, next);
				}
			], callback);
		});
	};

	Votes.purge = function(vid, callback) {
		async.parallel([
			function(next) {
				db.deleteAll([
					'vid:' + vid + ':followers',
					'vid:' + vid + ':posts',
					'vid:' + vid + ':posts:votes'
				], next);
			},
			function(next) {
				db.sortedSetsRemove(['votes:vid', 'votes:recent', 'votes:posts', 'votes:views'], vid, next);
			},
			function(next) {
				deleteVoteFromCategoryAndUser(vid, next);
			},
			function(next) {
				Votes.deleteVoteTags(vid, next);
			},
			function(next) {
				reduceCounters(vid, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:vote.purge', vid);
			db.delete('vote:' + vid, callback);
		});
	};

	function deleteVoteFromCategoryAndUser(vid, callback) {
		Votes.getVoteFields(vid, ['cid', 'uid'], function(err, voteData) {
			if (err) {
				return callback(err);
			}
			async.parallel([
				function(next) {
					db.sortedSetsRemove([
						'cid:' + voteData.cid + ':vids',
						'cid:' + voteData.cid + ':vids:posts',
						'cid:' + voteData.cid + ':uid:' + voteData.uid + ':vids',
						'uid:' + voteData.uid + ':votes'
					], vid, next);
				},
				function(next) {
					user.decrementUserFieldBy(voteData.uid, 'votecount', 1, next);
				}
			], callback);
		});
	}

	function reduceCounters(vid, callback) {
		var incr = -1;
		async.parallel([
			function(next) {
				db.incrObjectFieldBy('global', 'voteCount', incr, next);
			},
			function(next) {
				Votes.getVoteFields(vid, ['cid', 'postcount'], function(err, voteData) {
					if (err) {
						return next(err);
					}
					voteData.postcount = parseInt(voteData.postcount, 10);
					voteData.postcount = voteData.postcount || 0;
					var postCountChange = incr * voteData.postcount;

					async.parallel([
						function(next) {
							db.incrObjectFieldBy('global', 'postCount', postCountChange, next);
						},
						function(next) {
							db.incrObjectFieldBy('category:' + voteData.cid, 'post_count', postCountChange, next);
						},
						function(next) {
							db.incrObjectFieldBy('category:' + voteData.cid, 'vote_count', incr, next);
						}
					], next);
				});
			}
		], callback);
	}
};
