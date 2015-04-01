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

	inviteDelete(socket.uid, data.iid, function (err, inviteData) {
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

		executeUpvote(socket, data, callback);
	});
};

function executeUpvote(socket, data, callback) {
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

			invite.inviteUser(uid, iid, count, callback);
		});
	});
}

module.exports = SocketInvite;
