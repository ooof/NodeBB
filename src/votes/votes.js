'use strict';

var async = require('async'),
	db = require('../database'),
	user = require('../user'),
	votes = require('../votes'),
	plugins = require('../plugins');

module.exports = function(Votes) {

	Votes.getVotes = function(data, callback) {
		async.parallel({
			isAdmin: function(next) {
				user.isAdministrator(data.uid, next);
			},
			isModerator: function(next) {
				user.isModerator(data.uid, data.cid, next);
			},
			votes: function(next) {
				async.waterfall([
					function(next) {
						plugins.fireHook('filter:votes.prepare', data, next);
					},
					function(data, next) {
						Votes.getVoteIds(data.set, data.reverse, data.start, data.stop, next);
					},
					function(vids, next) {
						votes.getVotesByVids(vids, data.uid, next);
					},
					function(votes, next) {
						if (!Array.isArray(votes) || !votes.length) {
							return next(null, {votes: [], uid: data.uid});
						}

						for (var i=0; i<votes.length; ++i) {
							votes[i].index = data.start + i;
						}

						plugins.fireHook('filter:votes.get', {votes: votes, uid: data.uid}, next);
					},
					function(results, next) {
						next(null, results.votes);
					}
				], next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			var isAdminOrMod = results.isAdmin || results.isModerator;
			results.votes = results.votes.filter(function(vote) {
				return (!vote.deleted || isAdminOrMod || vote.isOwner);
			});

			callback(null, {votes: results.votes, nextStart: data.stop + 1});
		});
	};

	Votes.getVoteIds = function(set, reverse, start, stop, callback) {
		if (reverse) {
			db.getSortedSetRevRange(set, start, stop, callback);
		} else {
			db.getSortedSetRange(set, start, stop, callback);
		}
	};

	Votes.getVoteIndex = function(tid, callback) {
		votes.getVoteField(tid, 'cid', function(err, cid) {
			if(err) {
				return callback(err);
			}

			db.sortedSetRevRank('cid:' + cid + ':tids', tid, callback);
		});
	};

	Votes.list = {
		onNewPostMade: function (pinned, postData, callback) {
			if (!postData) {
				return callback();
			}

			async.parallel([
				function (next) {
					db.sortedSetAdd('vote_list:pids', postData.timestamp, postData.pid, next);
				},
				function (next) {
					if (parseInt(pinned, 10) === 1) {
						next();
					} else {
						db.sortedSetAdd('vote_list:vids', postData.timestamp, postData.vid, next);
					}
				},
				function (next) {
					db.sortedSetIncrBy('vote_list:vids:posts', 1, postData.vid, next);
				}
			], callback);
		}
	};

};
