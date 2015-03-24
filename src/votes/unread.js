'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	notifications = require('../notifications'),
	categories = require('../categories'),
	privileges = require('../privileges');

module.exports = function(Votes) {
	Votes.getTotalUnread = function(uid, callback) {
		Votes.getUnreadTids(uid, 0, 20, function(err, tids) {
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
				Votes.getUnreadTids(uid, start, stop, next);
			},
			function(tids, next) {
				if (!tids.length) {
					return next(null, []);
				}
				Votes.getVotesByTids(tids, uid, next);
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

	Votes.getUnreadTids = function(uid, start, stop, callback) {
		uid = parseInt(uid, 10);
		if (uid === 0) {
			return callback(null, []);
		}

		var yesterday = Date.now() - 86400000;

		async.parallel({
			ignoredCids: function(next) {
				user.getIgnoredCategories(uid, next);
			},
			recentTids: function(next) {
				db.getSortedSetRevRangeByScoreWithScores('votes:recent', 0, -1, '+inf', yesterday, next);
			},
			userScores: function(next) {
				db.getSortedSetRevRangeByScoreWithScores('uid:' + uid + ':tids_read', 0, -1, '+inf', yesterday, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (results.recentTids && !results.recentTids.length) {
				return callback(null, []);
			}

			var userRead = {};
			results.userScores.forEach(function(userItem) {
				userRead[userItem.value] = userItem.score;
			});


			var tids = results.recentTids.filter(function(recentVote, index) {
				return !userRead[recentVote.value] || recentVote.score > userRead[recentVote.value];
			}).map(function(vote) {
				return vote.value;
			});

			tids = tids.slice(0, 100);

			filterVotes(uid, tids, results.ignoredCids, function(err, tids) {
				if (err) {
					return callback(err);
				}

				if (stop === -1) {
					tids = tids.slice(start);
				} else {
					tids = tids.slice(start, stop + 1);
				}

				callback(null, tids);
			});
		});
	};

	function filterVotes(uid, tids, ignoredCids, callback) {
		if (!Array.isArray(ignoredCids) || !tids.length) {
			return callback(null, tids);
		}

		async.waterfall([
			function(next) {
				privileges.votes.filter('read', tids, uid, next);
			},
			function(tids, next) {
				Votes.getVotesFields(tids, ['tid', 'cid'], next);
			},
			function(votes, next) {
				tids = votes.filter(function(vote) {
					return vote && vote.cid && ignoredCids.indexOf(vote.cid.toString()) === -1;
				}).map(function(vote) {
					return vote.tid;
				});
				next(null, tids);
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

	Votes.markAsUnreadForAll = function(vid, callback) {
		Votes.markCategoryUnreadForAll(vid, callback);
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
				db.sortedSetScores('uid:' + uid + ':tids_read', vids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			vids = vids.filter(function(tid, index) {
				return !results.userScores[index] || results.userScores[index] < results.voteScores[index];
			});

			if (!vids.length) {
				return callback();
			}

			var now = Date.now();
			var scores = vids.map(function(tid) {
				return now;
			});

			async.parallel({
				markRead: function(next) {
					db.sortedSetAdd('uid:' + uid + ':tids_read', scores, vids, next);
				},
				voteData: function(next) {
					Votes.getVotesFields(vids, ['cid'], next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				var cids = results.voteData.map(function(vote) {
					return vote && vote.cid;
				}).filter(function(vote, index, array) {
					return vote && array.indexOf(vote) === index;
				});

				categories.markAsRead(cids, uid, callback);
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

	Votes.markCategoryUnreadForAll = function(tid, callback) {
		Votes.getVoteField(tid, 'cid', function(err, cid) {
			if(err) {
				return callback(err);
			}

			categories.markAsUnreadForAll(cid, callback);
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
			var result = tids.map(function(tid, index) {
				return !!(results.userScores[index] && results.userScores[index] >= results.recentScores[index]);
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
