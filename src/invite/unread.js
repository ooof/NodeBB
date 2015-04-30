'use strict';

var async = require('async'),
	winston = require('winston'),
	db = require('../database'),
	user = require('../user'),
	notifications = require('../notifications'),
	jobs = require('../schedule'),
	privileges = require('../privileges');

module.exports = function(Invite) {
	var unreadCutoff = 86400000;

	Invite.getTotalUnread = function(uid, callback) {
		Invite.getUnreadVids(uid, 0, 20, function(err, tids) {
			callback(err, tids ? tids.length : 0);
		});
	};

	Invite.getUnreadVotes = function(uid, start, stop, callback) {

		var unreadVotes = {
			showSelect: true,
			nextStart : 0,
			votes: []
		};

		async.waterfall([
			function(next) {
				Invite.getUnreadVids(uid, start, stop, next);
			},
			function(vids, next) {
				if (!vids.length) {
					return next(null, []);
				}
				Invite.getVotesByVids(vids, uid, next);
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

	Invite.getUnreadVids = function(uid, start, stop, callback) {
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

	Invite.pushUnreadCount = function(uid, callback) {
		callback = callback || function() {};

		if (!uid || parseInt(uid, 10) === 0) {
			return callback();
		}
		Invite.getTotalUnread(uid, function(err, count) {
			if (err) {
				return callback(err);
			}
			require('../socket.io').in('uid_' + uid).emit('event:unread.updateCount', null, count);
			callback();
		});
	};

	Invite.markAsUnreadForAll = function(callback) {
		callback = callback || function() {};
		db.delete('vote_list:read_by_uid', callback);
	};

	Invite.markAsRead = function(vids, uid, callback) {
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

	Invite.storeNotificationData = function (data, callback) {
		if (!data.iid) {
			return callback();
		}

		var key = 'notifications:uid:nid:iid:' + data.iid,
			uidsNid = {};

		// step = 4 代表用户已加入社区
		if (data.step === 3) {
			return db.delete(key, callback);
		}

		for (var i = 0, l = data.uids.length; i < l; i++) {
			uidsNid[data.uids[i]] = data.nid;
		}

		db.setObject(key, uidsNid, function (err) {
			if (err) {
				return callback(err);
			}
			if (data.step > 3) {
				return db.pexpire(key, jobs.expire.time(), callback);
			}
			callback();
		});
	};

	Invite.deletePrevNotification = function (data, callback) {
		if (!data.iid) {
			return callback();
		}

		var iid = data.iid,
			uids = data.uids,
			uidsNid;

		if (data.step === 1) {
			return callback();
		}

		if (!Array.isArray(uids) || !uids.length) {
			uids = [uids];
		}

		async.waterfall([
			function (next) {
				db.getObjectFields('notifications:uid:nid:iid:' + iid, uids, next);
			},
			function (_uidsNid, next) {
				uidsNid = _uidsNid;
				db.deleteObjectFields('notifications:uid:nid:iid:' + iid, uids, next);
			},
			function (next) {
				async.each(uids, function (uid, next) {
					if (!uidsNid[uid]) {
						return next();
					}
					async.waterfall([
						function (next) {
							notifications.markRead(uidsNid[uid], uid, function (err) {
								if (err) {
									return next(err);
								}
								next();
							});
						},
						function (next) {
							db.sortedSetRemove('uid:' + uid + ':notifications:read', uidsNid[uid], next);
						},
						function (next) {
							user.notifications.pushCount(uid);
							next();
						}
					], next);
				}, next);
			}
		], callback);
	};

	Invite.markVoteNotificationsRead = function(tid, uid) {
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

	Invite.hasReadInvites = function(iids, uid, callback) {
		if(!parseInt(uid, 10)) {
			return callback(null, iids.map(function() {
				return false;
			}));
		}

		async.parallel({
			recentScores: function(next) {
				db.sortedSetScores('invite:recent', iids, next);
			},
			userScores: function(next) {
				db.sortedSetScores('uid:' + uid + ':iids_read', iids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			var cutoff = Date.now() - unreadCutoff;
			var result = iids.map(function(tid, index) {
				return results.recentScores[index] < cutoff || !!(results.userScores[index] && results.userScores[index] >= results.recentScores[index]);
			});

			callback(null, result);
		});
	};

	Invite.hasReadInvite = function(iid, uid, callback) {
		Invite.hasReadVotes([iid], uid, function(err, hasRead) {
			callback(err, Array.isArray(hasRead) && hasRead.length ? hasRead[0] : false);
		});
	};
};
