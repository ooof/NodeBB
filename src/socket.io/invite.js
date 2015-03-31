'use strict';

var nconf = require('nconf'),
	async = require('async'),
	winston = require('winston'),
	invite = require('../invite'),
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
	LRU = require('lru-cache'),
	SocketInvite = {};

var cache = LRU({
	max: 1048576,
	length: function (n) { return n.length; },
	maxAge: 1000 * 60 * 60
});

SocketInvite.post = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	invite.post({
		uid: socket.uid,
		username: data.username,
		email: data.email,
		content: data.content,
		req: websockets.reqFromSocket(socket)
	}, function (err, inviteData) {
		if (err) {
			return callback(err);
		}

		callback(null, inviteData);
		socket.emit('event:new_invite', inviteData);
	});
};

SocketInvite.edit = function (socket, data, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	} else if(!data || !data.iid || !data.username || !data.email || !data.content) {
		return callback(new Error('[[error:invalid-data]]'));
	} else if (!data.username || data.username.length < parseInt(meta.config.minimumTitleLength, 10)) {
		return callback(new Error('[[error:username-too-short, ' + meta.config.minimumTitleLength + ']]'));
	} else if (data.username.length > parseInt(meta.config.maximumTitleLength, 10)) {
		return callback(new Error('[[error:username-too-long, ' + meta.config.maximumTitleLength + ']]'));
	} else if (!data.content || data.content.length < parseInt(meta.config.minimumPostLength, 10)) {
		return callback(new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]'));
	} else if (data.content.length > parseInt(meta.config.maximumPostLength, 10)) {
		return callback(new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]'));
	}

	// uid, iid, username, email, content
	invite.edit({
		uid: socket.uid,
		iid: data.iid,
		username: data.username,
		email: data.email,
		content: data.content
	}, function(err) {
		if (err) {
			return callback(err);
		}

		websockets.in('invite_' + data.iid).emit('event:invite_edited', {
			iid: data.iid,
			username: data.username,
			email: data.email,
			content: data.content
		});

		callback();
	});
};

SocketInvite.delete = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	inviteDelete(socket.uid, data.iid, true, function (err, inviteData) {
		if (err) {
			return callback(err);
		}

		var eventName = 'event:invite_deleted' ;

		websockets.in('invite_' + data.iid).emit(eventName, inviteData);

		events.log({
			type: 'invite-delete',
			uid: socket.uid,
			iid: data.iid,
			ip: socket.ip
		});

		callback();
	});


	function inviteDelete(uid, iid, callback) {
		async.waterfall([
			function(next) {
				invite.getInviteField(iid, 'deleted', next);
			},
			function(deleted, next) {
				if(parseInt(deleted, 10) === 1) {
					return next(new Error('[[error:post-already-deleted]]'));
				}

				privileges.invite.canEdit(iid, uid, next);
			},
			function(canEdit, next) {
				if (!canEdit) {
					return next(new Error('[[error:no-privileges]]'));
				}
				next();
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			cache.del(iid);
			invite.delete(iid, callback);
		});
	}
};

SocketInvite.enter = function (socket, tid, callback) {
	if (!parseInt(tid, 10) || !socket.uid) {
		return;
	}
	async.parallel({
		markAsRead: function (next) {
			SocketInvite.markAsRead(socket, [tid], next);
		},
		users: function (next) {
			websockets.getUsersInRoom(socket.uid, 'vote_' + tid, next);
		}
	}, function (err, result) {
		callback(err, result ? result.users : null);
	});
};

SocketInvite.upvote = function (socket, data, callback) {
	favouriteCommand(socket, data, callback);
};

function favouriteCommand(socket, data, callback) {
	if (!data || !data.iid || !data.room_id) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.parallel({
		exists: function (next) {
			invite.exists(data.iid, next);
		},
		deleted: function (next) {
			invite.getInviteField(data.iid, 'deleted', next);
		}
	}, function (err, results) {
		if (err || !results.exists) {
			return callback(err || new Error('[[error:invalid-pid]]'));
		}

		if (parseInt(results.deleted, 10) === 1) {
			return callback(new Error('[[error:post-deleted]]'));
		}

		executeFavouriteCommand(socket, data, callback);
	});
}

function executeFavouriteCommand(socket, data, callback) {
	var iid = data.iid,
		uid = socket.uid;

	if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
		return callback(new Error('[[error:reputation-system-disabled]]'));
	}

	db.isSetMember('invite:' + iid + ':by', uid, function (err, value) {
		if (err) {
			return callback(err);
		}

		if (value) {
			return callback(new Error('[[invite:error.already-voted]]'));
		}

		var now = Date.now();
		async.waterfall([
			function (next) {
				db.sortedSetAdd('invite:uid:' + uid + ':iids', now, iid, next);
			},
			function (next) {
				db.setAdd('invite:' + iid + ':by', uid, next);
			},
			function (next) {
				db.incrObjectField('invite:' + iid, 'invitecount', function (err, count) {
					if (err) {
						return callback(err);
					}
					websockets.in('invite_' + data.iid).emit('event:invite_upvote', count);
					next(null, count);
				});
			}
		], function (err, count) {
			if (err) {
				return callback(err);
			}

			invite.inviteUser(iid, count, callback);
		});
	});
}

SocketInvite.sendNotificationToPostOwner = function (iid, fromuid, notification) {
	if (!iid || !fromuid || !notification) {
		return;
	}
	invite.getInviteFields(iid, ['uid', 'content'], function (err, postData) {
		if (err) {
			return;
		}

		if (!postData.uid || fromuid === parseInt(postData.uid, 10)) {
			return;
		}

		async.parallel({
			username: async.apply(user.getUserField, fromuid, 'username'),
			topicTitle: async.apply(topics.getTopicField, postData.tid, 'title'),
			postObj: async.apply(postTools.parsePost, postData)
		}, function (err, results) {
			if (err) {
				return;
			}

			notifications.create({
				bodyShort: '[[' + notification + ', ' + results.username + ', ' + results.topicTitle + ']]',
				bodyLong: results.postObj.content,
				pid: iid,
				nid: 'post:' + iid + ':uid:' + fromuid,
				from: fromuid
			}, function (err, notification) {
				if (!err && notification) {
					notifications.push(notification, [postData.uid]);
				}
			});
		});
	});
};

SocketInvite.markAsRead = function (socket, tids, callback) {
	if (!Array.isArray(tids) || !socket.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (!tids.length) {
		return callback();
	}
	tids = tids.filter(function (tid) {
		return tid && utils.isNumber(tid);
	});

	votes.markAsRead(tids, socket.uid, function (err) {
		if (err) {
			return callback(err);
		}

		votes.pushUnreadCount(socket.uid);

		for (var i = 0; i < tids.length; ++i) {
			votes.markTopicNotificationsRead(tids[i], socket.uid);
		}
		callback();
	});
};

SocketInvite.markTopicNotificationsRead = function (socket, tid, callback) {
	if (!tid || !socket.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	votes.markTopicNotificationsRead(tid, socket.uid);
};

SocketInvite.markAllRead = function (socket, data, callback) {
	votes.getLatestTidsFromSet('votes:recent', 0, -1, 'day', function (err, tids) {
		if (err) {
			return callback(err);
		}

		SocketInvite.markAsRead(socket, tids, callback);
	});
};

SocketInvite.markAsUnreadForAll = function (socket, tids, callback) {
	if (!Array.isArray(tids)) {
		return callback(new Error('[[error:invalid-tid]]'));
	}

	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	user.isAdministrator(socket.uid, function (err, isAdmin) {
		if (err) {
			return callback(err);
		}

		async.each(tids, function (tid, next) {
			async.waterfall([
				function (next) {
					votes.exists(tid, next);
				},
				function (exists, next) {
					if (!exists) {
						return next(new Error('[[error:invalid-tid]]'));
					}
					votes.getTopicField(tid, 'cid', next);
				},
				function (cid, next) {
					user.isModerator(socket.uid, cid, next);
				},
				function (isMod, next) {
					if (!isAdmin && !isMod) {
						return next(new Error('[[error:no-privileges]]'));
					}
					votes.markAsUnreadForAll(tid, next);
				},
				function (next) {
					votes.updateRecent(tid, Date.now(), next);
				}
			], next);
		}, function (err) {
			if (err) {
				return callback(err);
			}
			votes.pushUnreadCount(socket.uid);
		});
	});
};

SocketInvite.delete = function (socket, data, callback) {
	SocketInvite.doTopicAction('delete', 'event:vote_deleted', socket, data, callback);
};

SocketInvite.restore = function (socket, data, callback) {
	SocketInvite.doTopicAction('restore', 'event:vote_restored', socket, data, callback);
};

SocketInvite.purge = function (socket, data, callback) {
	SocketInvite.doTopicAction('purge', 'event:vote_purged', socket, data, callback);
};

SocketInvite.lock = function (socket, data, callback) {
	SocketInvite.doTopicAction('lock', 'event:vote_locked', socket, data, callback);
};

SocketInvite.unlock = function (socket, data, callback) {
	SocketInvite.doTopicAction('unlock', 'event:vote_unlocked', socket, data, callback);
};

SocketInvite.pin = function (socket, data, callback) {
	SocketInvite.doTopicAction('pin', 'event:vote_pinned', socket, data, callback);
};

SocketInvite.unpin = function (socket, data, callback) {
	SocketInvite.doTopicAction('unpin', 'event:vote_unpinned', socket, data, callback);
};

SocketInvite.sendNotificationToTopicOwner = function (tid, fromuid, notification) {
	if (!tid || !fromuid) {
		return;
	}

	async.parallel({
		username: async.apply(user.getUserField, fromuid, 'username'),
		voteData: async.apply(votes.getTopicFields, tid, ['uid', 'slug']),
	}, function (err, results) {
		if (err || fromuid === parseInt(results.voteData.uid, 10)) {
			return;
		}

		notifications.create({
			bodyShort: '[[' + notification + ', ' + results.username + ']]',
			path: nconf.get('relative_path') + '/vote/' + results.voteData.slug,
			nid: 'tid:' + tid + ':uid:' + fromuid,
			from: fromuid
		}, function (err, notification) {
			if (!err && notification) {
				notifications.push(notification, [results.voteData.uid]);
			}
		});
	});
};

SocketInvite.toggleFollow = function (socket, tid, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	votes.toggleFollow(tid, socket.uid, callback);
};

SocketInvite.follow = function (socket, tid, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	votes.follow(tid, socket.uid, callback);
};

SocketInvite.loadMore = function (socket, data, callback) {
	if (!data || !data.tid || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.parallel({
		settings: function (next) {
			user.getSettings(socket.uid, next);
		},
		privileges: function (next) {
			privileges.votes.get(data.tid, socket.uid, next);
		},
		postCount: function (next) {
			votes.getPostCount(data.tid, next);
		}
	}, function (err, results) {
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
			posts: function (next) {
				votes.getTopicPosts(data.tid, set, start, end, socket.uid, reverse, next);
			},
			privileges: function (next) {
				next(null, results.privileges);
			},
			'reputation:disabled': function (next) {
				next(null, parseInt(meta.config['reputation:disabled'], 10) === 1);
			},
			'downvote:disabled': function (next) {
				next(null, parseInt(meta.config['downvote:disabled'], 10) === 1);
			}
		}, callback);
	});
};

SocketInvite.loadMoreUnreadTopics = function (socket, data, callback) {
	if (!data || !data.after) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 9;

	votes.getUnreadTopics(socket.uid, start, end, callback);
};

SocketInvite.loadMoreFromSet = function (socket, data, callback) {
	if (!data || !data.after || !data.set) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 9;

	votes.getTopicsFromSet(data.set, socket.uid, start, end, callback);
};

SocketInvite.loadTopics = function (socket, data, callback) {
	if (!data || !data.set || !utils.isNumber(data.start) || !utils.isNumber(data.end)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	votes.getTopicsFromSet(data.set, socket.uid, data.start, data.end, callback);
};

SocketInvite.getPageCount = function (socket, tid, callback) {
	votes.getPageCount(tid, socket.uid, callback);
};

SocketInvite.searchTags = function (socket, data, callback) {
	votes.searchTags(data, callback);
};

SocketInvite.search = function (socket, data, callback) {
	votes.search(data.tid, data.term, callback);
};

SocketInvite.searchAndLoadTags = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	votes.searchAndLoadTags(data, callback);
};

SocketInvite.loadMoreTags = function (socket, data, callback) {
	if (!data || !utils.isNumber(data.after)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 99;

	votes.getTags(start, end, function (err, tags) {
		if (err) {
			return callback(err);
		}

		callback(null, {tags: tags, nextStart: end + 1});
	});
};

SocketInvite.isModerator = function (socket, tid, callback) {
	votes.getTopicField(tid, 'cid', function (err, cid) {
		if (err) {
			return callback(err);
		}
		user.isModerator(socket.uid, cid, callback);
	});
};

module.exports = SocketInvite;
