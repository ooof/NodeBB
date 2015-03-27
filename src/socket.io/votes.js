'use strict';

var nconf = require('nconf'),
	async = require('async'),
	winston = require('winston'),

	votes = require('../votes'),
	categories = require('../categories'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	notifications = require('../notifications'),
	threadTools = require('../threadTools'),
	websockets = require('./index'),
	user = require('../user'),
	db = require('../database'),
	meta = require('../meta'),
	events = require('../events'),
	utils = require('../../public/src/utils'),


	SocketVotes = {};


SocketVotes.post = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	votes.post({
		uid: socket.uid,
		handle: data.handle,
		username: data.username,
		email: data.email,
		content: data.content,
		req: websockets.reqFromSocket(socket)
	}, function(err, result) {
		if (err) {
			return callback(err);
		}

		if (data.lock) {
			SocketVotes.doTopicAction('lock', 'event:vote_locked', socket, {tids: [result.voteData.tid], cid: result.voteData.cid});
		}

		callback(null, result.voteData);
		socket.emit('event:new_post', {posts: [result.postData]});
		socket.emit('event:new_vote', result.voteData);

		async.waterfall([
			function(next) {
				user.getUidsFromSet('users:online', 0, -1, next);
			},
			function(uids, next) {
				privileges.categories.filterUids('read', result.voteData.cid, uids, next);
			},
			function(uids, next) {
				plugins.fireHook('filter:sockets.sendNewPostToUids', {uidsTo: uids, uidFrom: data.uid, type: 'newTopic'}, next);
			}
		], function(err, data) {
			if (err) {
				return winston.error(err.stack);
			}

			var uids = data.uidsTo;

			for(var i=0; i<uids.length; ++i) {
				if (parseInt(uids[i], 10) !== socket.uid) {
					websockets.in('uid_' + uids[i]).emit('event:new_post', {posts: [result.postData]});
					websockets.in('uid_' + uids[i]).emit('event:new_vote', result.voteData);
				}
			}
		});
	});
};

SocketVotes.enter = function(socket, tid, callback) {
	if (!parseInt(tid, 10) || !socket.uid) {
		return;
	}
	async.parallel({
		markAsRead: function(next) {
			SocketVotes.markAsRead(socket, [tid], next);
		},
		users: function(next) {
			websockets.getUsersInRoom(socket.uid, 'vote_' + tid, next);
		}
	}, function(err, result) {
		callback(err, result ? result.users : null);
	});
};

SocketVotes.postcount = function(socket, tid, callback) {
	votes.getTopicField(tid, 'postcount', callback);
};

SocketVotes.markAsRead = function(socket, tids, callback) {
	if(!Array.isArray(tids) || !socket.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (!tids.length) {
		return callback();
	}
	tids = tids.filter(function(tid) {
		return tid && utils.isNumber(tid);
	});

	votes.markAsRead(tids, socket.uid, function(err) {
		if (err) {
			return callback(err);
		}

		votes.pushUnreadCount(socket.uid);

		for (var i=0; i<tids.length; ++i) {
			votes.markTopicNotificationsRead(tids[i], socket.uid);
		}
		callback();
	});
};

SocketVotes.markTopicNotificationsRead = function(socket, tid, callback) {
	if(!tid || !socket.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	votes.markTopicNotificationsRead(tid, socket.uid);
};

SocketVotes.markAllRead = function(socket, data, callback) {
	votes.getLatestTidsFromSet('votes:recent', 0, -1, 'day', function(err, tids) {
		if (err) {
			return callback(err);
		}

		SocketVotes.markAsRead(socket, tids, callback);
	});
};

SocketVotes.markCategoryTopicsRead = function(socket, cid, callback) {
	votes.getUnreadVids(socket.uid, 0, -1, function(err, tids) {
		if (err) {
			return callback(err);
		}

		votes.getTopicsFields(tids, ['tid', 'cid'], function(err, voteData) {
			if (err) {
				return callback(err);
			}

			tids = voteData.filter(function(vote) {
				return vote && parseInt(vote.cid, 10) === parseInt(cid, 10);
			}).map(function(vote) {
				return vote.tid;
			});

			SocketVotes.markAsRead(socket, tids, callback);
		});
	});
};

SocketVotes.markAsUnreadForAll = function(socket, tids, callback) {
	if (!Array.isArray(tids)) {
		return callback(new Error('[[error:invalid-tid]]'));
	}

	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if (err) {
			return callback(err);
		}

		async.each(tids, function(tid, next) {
			async.waterfall([
				function(next) {
					votes.exists(tid, next);
				},
				function(exists, next) {
					if (!exists) {
						return next(new Error('[[error:invalid-tid]]'));
					}
					votes.getTopicField(tid, 'cid', next);
				},
				function(cid, next) {
					user.isModerator(socket.uid, cid, next);
				},
				function(isMod, next) {
					if (!isAdmin && !isMod) {
						return next(new Error('[[error:no-privileges]]'));
					}
					votes.markAsUnreadForAll(tid, next);
				},
				function(next) {
					votes.updateRecent(tid, Date.now(), next);
				}
			], next);
		}, function(err) {
			if (err) {
				return callback(err);
			}
			votes.pushUnreadCount(socket.uid);
		});
	});
};

SocketVotes.delete = function(socket, data, callback) {
	SocketVotes.doTopicAction('delete', 'event:vote_deleted', socket, data, callback);
};

SocketVotes.restore = function(socket, data, callback) {
	SocketVotes.doTopicAction('restore', 'event:vote_restored', socket, data, callback);
};

SocketVotes.purge = function(socket, data, callback) {
	SocketVotes.doTopicAction('purge', 'event:vote_purged', socket, data, callback);
};

SocketVotes.lock = function(socket, data, callback) {
	SocketVotes.doTopicAction('lock', 'event:vote_locked', socket, data, callback);
};

SocketVotes.unlock = function(socket, data, callback) {
	SocketVotes.doTopicAction('unlock', 'event:vote_unlocked', socket, data, callback);
};

SocketVotes.pin = function(socket, data, callback) {
	SocketVotes.doTopicAction('pin', 'event:vote_pinned', socket, data, callback);
};

SocketVotes.unpin = function(socket, data, callback) {
	SocketVotes.doTopicAction('unpin', 'event:vote_unpinned', socket, data, callback);
};

SocketVotes.doTopicAction = function(action, event, socket, data, callback) {
	callback = callback || function() {};
	if (!socket.uid) {
		return;
	}
	if(!data || !Array.isArray(data.tids) || !data.cid) {
		return callback(new Error('[[error:invalid-tid]]'));
	}

	async.each(data.tids, function(tid, next) {
		privileges.votes.canEdit(tid, socket.uid, function(err, canEdit) {
			if (err) {
				return next(err);
			}

			if (!canEdit) {
				return next(new Error('[[error:no-privileges]]'));
			}

			if (typeof threadTools[action] !== 'function') {
				return next();
			}

			threadTools[action](tid, socket.uid, function(err, data) {
				if (err) {
					return next(err);
				}

				emitToTopicAndCategory(event, data);

				if (action === 'delete' || action === 'restore' || action === 'purge') {
					events.log({
						type: 'vote-' + action,
						uid: socket.uid,
						ip: socket.ip,
						tid: tid
					});
				}

				next();
			});
		});
	}, callback);
};

function emitToTopicAndCategory(event, data) {
	websockets.in('vote_' + data.tid).emit(event, data);
	websockets.in('category_' + data.cid).emit(event, data);
}

SocketVotes.createTopicFromPosts = function(socket, data, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	if(!data || !data.title || !data.pids || !Array.isArray(data.pids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	votes.createTopicFromPosts(socket.uid, data.title, data.pids, callback);
};

SocketVotes.movePost = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	if (!data || !data.pid || !data.tid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	privileges.posts.canMove(data.pid, socket.uid, function(err, canMove) {
		if (err || !canMove) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		votes.movePostToTopic(data.pid, data.tid, function(err) {
			if (err) {
				return callback(err);
			}

			require('./posts').sendNotificationToPostOwner(data.pid, socket.uid, 'notifications:moved_your_post');
			callback();
		});
	});
};

SocketVotes.move = function(socket, data, callback) {
	if(!data || !Array.isArray(data.tids) || !data.cid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.eachLimit(data.tids, 10, function(tid, next) {
		var oldCid;
		async.waterfall([
			function(next) {
				privileges.votes.canMove(tid, socket.uid, next);
			},
			function(canMove, next) {
				if (!canMove) {
					return next(new Error('[[error:no-privileges]]'));
				}
				next();
			},
			function(next) {
				votes.getTopicField(tid, 'cid', next);
			},
			function(cid, next) {
				oldCid = cid;
				threadTools.move(tid, data.cid, socket.uid, next);
			}
		], function(err) {
			if(err) {
				return next(err);
			}

			websockets.in('vote_' + tid).emit('event:vote_moved', {
				tid: tid
			});

			websockets.in('category_' + oldCid).emit('event:vote_moved', {
				tid: tid
			});

			SocketVotes.sendNotificationToTopicOwner(tid, socket.uid, 'notifications:moved_your_vote');

			next();
		});
	}, callback);
};


SocketVotes.sendNotificationToTopicOwner = function(tid, fromuid, notification) {
	if(!tid || !fromuid) {
		return;
	}

	async.parallel({
		username: async.apply(user.getUserField, fromuid, 'username'),
		voteData: async.apply(votes.getTopicFields, tid, ['uid', 'slug']),
	}, function(err, results) {
		if (err || fromuid === parseInt(results.voteData.uid, 10)) {
			return;
		}

		notifications.create({
			bodyShort: '[[' + notification + ', ' + results.username + ']]',
			path: nconf.get('relative_path') + '/vote/' + results.voteData.slug,
			nid: 'tid:' + tid + ':uid:' + fromuid,
			from: fromuid
		}, function(err, notification) {
			if (!err && notification) {
				notifications.push(notification, [results.voteData.uid]);
			}
		});
	});
};


SocketVotes.moveAll = function(socket, data, callback) {
	if(!data || !data.cid || !data.currentCid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	privileges.categories.canMoveAllTopics(data.currentCid, data.cid, data.uid, function(err, canMove) {
		if (err || canMove) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		categories.getTopicIds('cid:' + data.currentCid + ':tids', true, 0, -1, function(err, tids) {
			if (err) {
				return callback(err);
			}

			async.eachLimit(tids, 10, function(tid, next) {
				threadTools.move(tid, data.cid, socket.uid, next);
			}, callback);
		});
	});
};

SocketVotes.toggleFollow = function(socket, tid, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	votes.toggleFollow(tid, socket.uid, callback);
};

SocketVotes.follow = function(socket, tid, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	votes.follow(tid, socket.uid, callback);
};

SocketVotes.loadMore = function(socket, data, callback) {
	if(!data || !data.tid || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0)  {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.parallel({
		settings: function(next) {
			user.getSettings(socket.uid, next);
		},
		privileges: function(next) {
			privileges.votes.get(data.tid, socket.uid, next);
		},
		postCount: function(next) {
			votes.getPostCount(data.tid, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		if (!results.privileges.read) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		var set = 'tid:' + data.tid + ':posts',
			reverse = false,
			start = Math.max(parseInt(data.after, 10) - 1, 0);

		if (results.settings.votePostSort === 'newest_to_oldest' || results.settings.votePostSort === 'most_votes') {
			reverse = true;
			data.after = results.postCount - 1 - data.after;
			start = Math.max(parseInt(data.after, 10), 0);
			if (results.settings.votePostSort === 'most_votes') {
				set = 'tid:' + data.tid + ':posts:votes';
			}
		}

		var end = start + results.settings.postsPerPage - 1;

		async.parallel({
			posts: function(next) {
				votes.getTopicPosts(data.tid, set, start, end, socket.uid, reverse, next);
			},
			privileges: function(next) {
				next(null, results.privileges);
			},
			'reputation:disabled': function(next) {
				next(null, parseInt(meta.config['reputation:disabled'], 10) === 1);
			},
			'downvote:disabled': function(next) {
				next(null, parseInt(meta.config['downvote:disabled'], 10) === 1);
			}
		}, callback);
	});
};

SocketVotes.loadMoreUnreadTopics = function(socket, data, callback) {
	if(!data || !data.after) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 9;

	votes.getUnreadTopics(socket.uid, start, end, callback);
};

SocketVotes.loadMoreFromSet = function(socket, data, callback) {
	if(!data || !data.after || !data.set) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 9;

	votes.getTopicsFromSet(data.set, socket.uid, start, end, callback);
};

SocketVotes.loadTopics = function(socket, data, callback) {
	if(!data || !data.set || !utils.isNumber(data.start) || !utils.isNumber(data.end)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	votes.getTopicsFromSet(data.set, socket.uid, data.start, data.end, callback);
};

SocketVotes.getPageCount = function(socket, tid, callback) {
	votes.getPageCount(tid, socket.uid, callback);
};

SocketVotes.searchTags = function(socket, data, callback) {
	votes.searchTags(data, callback);
};

SocketVotes.search = function(socket, data, callback) {
	votes.search(data.tid, data.term, callback);
};

SocketVotes.searchAndLoadTags = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	votes.searchAndLoadTags(data, callback);
};

SocketVotes.loadMoreTags = function(socket, data, callback) {
	if(!data || !utils.isNumber(data.after)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 99;

	votes.getTags(start, end, function(err, tags) {
		if (err) {
			return callback(err);
		}

		callback(null, {tags: tags, nextStart: end + 1});
	});
};

SocketVotes.isModerator = function(socket, tid, callback) {
	votes.getTopicField(tid, 'cid', function(err, cid) {
		if (err) {
			return callback(err);
		}
		user.isModerator(socket.uid, cid, callback);
	});
};

module.exports = SocketVotes;