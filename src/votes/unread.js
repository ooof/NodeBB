'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	notifications = require('../notifications'),
	privileges = require('../privileges');

module.exports = function(Votes) {

	var unreadCutoff = 86400000;

	Votes.getTotalUnread = function(uid, callback) {
		Votes.getUnreadVids(uid, 0, 20, function(err, tids) {
			callback(err, tids ? tids.length : 0);
		});
	};

	Votes.getUnreadVotes = function(uid, start, stop, callback) {

		var unreadVotes = {
			showSelect: true,
			nextStart : 0,
			votes: []
		};

		async.waterfall([
			function(next) {
				Votes.getUnreadVids(uid, start, stop, next);
			},
			function(vids, next) {
				if (!vids.length) {
					return next(null, []);
				}
				Votes.getVotesByVids(vids, uid, next);
			},
			function(voteData, next) {
				if (!Array.isArray(voteData) || !voteData.length) {
					return next(null, unreadVotes);
				}

				unreadVotes.votes = voteData;
				unreadVotes.nextStart = stop + 1;
				next(null, unreadVotes);
			}
		], callback);
	};

	Votes.getUnreadVids = function(uid, start, stop, callback) {
		uid = parseInt(uid, 10);
		if (uid === 0) {
			return callback(null, []);
		}

		var cutoff = Date.now() - unreadCutoff;

		async.parallel({
			recentVids: function(next) {
				db.getSortedSetRevRangeByScoreWithScores('votes:recent', 0, -1, '+inf', cutoff, next);
			},
			userScores: function(next) {
				db.getSortedSetRevRangeByScoreWithScores('uid:' + uid + ':vids_read', 0, -1, '+inf', cutoff, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (results.recentVids && !results.recentVids.length) {
				return callback(null, []);
			}

			var userRead = {};
			results.userScores.forEach(function(userItem) {
				userRead[userItem.value] = userItem.score;
			});


			var vids = results.recentVids.filter(function(recentVote, index) {
				return !userRead[recentVote.value] || recentVote.score > userRead[recentVote.value];
			}).map(function(vote) {
				return vote.value;
			});

			vids = vids.slice(0, 100);

			filterVotes(uid, vids, function(err, vids) {
				if (err) {
					return callback(err);
				}

				if (stop === -1) {
					vids = vids.slice(start);
				} else {
					vids = vids.slice(start, stop + 1);
				}

				callback(null, vids);
			});
		});
	};

	function filterVotes(uid, tids, callback) {
		if (!tids.length) {
			return callback(null, tids);
		}

		async.waterfall([
			function(next) {
				privileges.votes.filter('read', tids, uid, next);
			}
		], callback);
	}

	Votes.pushUnreadCount = function(uid, callback) {
		callback = callback || function() {};

		if (!uid || parseInt(uid, 10) === 0) {
			return callback();
		}
		Votes.getTotalUnread(uid, function(err, count) {
			if (err) {
				return callback(err);
			}
			require('../socket.io').in('uid_' + uid).emit('event:unread.updateCount', null, count);
			callback();
		});
	};

	Votes.markAsUnreadForAll = function(callback) {
		callback = callback || function() {};
		db.delete('vote_list:read_by_uid', callback);
	};

	Votes.markAsRead = function(vids, uid, callback) {
		callback = callback || function() {};
		if (!Array.isArray(vids) || !vids.length) {
			return callback();
		}
		vids = vids.filter(Boolean);
		if (!vids.length) {
			return callback();
		}

		async.parallel({
			voteScores: function(next) {
				db.sortedSetScores('votes:recent', vids, next);
			},
			userScores: function(next) {
				db.sortedSetScores('uid:' + uid + ':vids_read', vids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			vids = vids.filter(function(vid, index) {
				return !results.userScores[index] || results.userScores[index] < results.voteScores[index];
			});

			if (!vids.length) {
				return callback();
			}

			var now = Date.now();
			var scores = vids.map(function() {
				return now;
			});

			async.parallel({
				markRead: function(next) {
					db.sortedSetAdd('uid:' + uid + ':vids_read', scores, vids, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				var keys = ['vote_list:read_by_uid'];

				db.isMemberOfSets(keys, uid, function(err, hasRead) {
					if (err) {
						return callback(err);
					}

					keys = keys.filter(function(key, index) {
						return !hasRead[index];
					});

					if (!keys.length) {
						return callback();
					}

					db.setsAdd(keys, uid, callback);
				});
			});
		});
	};

	Votes.markVoteNotificationsRead = function(tid, uid) {
		if (!tid) {
			return;
		}
		user.notifications.getUnreadByField(uid, 'tid', tid, function(err, nids) {
			if (err) {
				return winston.error(err.stack);
			}
			notifications.markReadMultiple(nids, uid, function() {
				user.notifications.pushCount(uid);
			});
		});
	};

	Votes.hasReadVotes = function(tids, uid, callback) {
		if(!parseInt(uid, 10)) {
			return callback(null, tids.map(function() {
				return false;
			}));
		}

		async.parallel({
			recentScores: function(next) {
				db.sortedSetScores('votes:recent', tids, next);
			},
			userScores: function(next) {
				db.sortedSetScores('uid:' + uid + ':tids_read', tids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			var cutoff = Date.now() - unreadCutoff;
			var result = tids.map(function(tid, index) {
				return results.recentScores[index] < cutoff || !!(results.userScores[index] && results.userScores[index] >= results.recentScores[index]);
			});

			callback(null, result);
		});
	};

	Votes.hasReadVote = function(tid, uid, callback) {
		Votes.hasReadVotes([tid], uid, function(err, hasRead) {
			callback(err, Array.isArray(hasRead) && hasRead.length ? hasRead[0] : false);
		});
	};
};
