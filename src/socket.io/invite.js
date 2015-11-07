'use strict';

var nconf = require('nconf'),
	async = require('async'),
	winston = require('winston'),
	invite = require('../invite'),
	categories = require('../categories'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	notifications = require('../notifications'),
	websockets = require('./index'),
	user = require('../user'),
	db = require('../database'),
	meta = require('../meta'),
	events = require('../events'),
	utils = require('../../public/src/utils'),
	SocketInvite = {};

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
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	} else if (!data || !data.iid || !data.username || !data.email || !data.content) {
		return callback(new Error('[[error:invalid-data]]'));
	} else if (!data.username || data.username.length < parseInt(meta.config.minimumUsernameLength, 10)) {
		return callback(new Error('[[error:username-too-short, ' + meta.config.minimumUsernameLength + ']]'));
	} else if (data.username.length > parseInt(meta.config.maximumUsernameLength, 10)) {
		return callback(new Error('[[error:username-too-long, ' + meta.config.maximumUsernameLength + ']]'));
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
	}, function (err) {
		if (err) {
			return callback(err);
		}

		plugins.fireHook('filter:parse.post', {
			postData: {
				content: data.content
			}
		}, function (err, contentData) {
			if (err) {
				return next(err);
			}

			data.content = contentData.postData.content;
			websockets.in('invite_' + data.iid).emit('event:invite_edited', {
				iid: data.iid,
				username: data.username,
				email: data.email,
				content: data.content
			});

			callback();
		});
	});
};

SocketInvite.reply = function (socket, data, callback) {
	if(!data || !data.iid || !data.content) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	data.uid = socket.uid;
	data.req = websockets.reqFromSocket(socket);

	invite.reply(data, function(err, postData) {
		if (err) {
			return callback(err);
		}

		var result = {
			posts: [postData],
			privileges: {
				'invite:reply': true
			},
			'reputation:disabled': parseInt(meta.config['reputation:disabled'], 10) === 1,
			'downvote:disabled': parseInt(meta.config['downvote:disabled'], 10) === 1
		};

		callback(null, postData);

		invite.sendInviteReplyEmail(postData);

		socket.emit('event:new_post', result);

		user.updateOnlineUsers(socket.uid);
	});
};

SocketInvite.delete = function (socket, data, callback) {
	callback = callback || function () {
		};

	if (!socket.uid) {
		return;
	}

	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	invite.delete(data.iid, function (err, callback) {
		callback = callback || function () {
			}

		if (err) {
			return callback(err);
		}

		websockets.in('invite_' + data.iid).emit('event:invite_deleted');

		events.log({
			type: 'invite-delete',
			uid: socket.uid,
			iid: data.iid,
			ip: socket.ip
		});

		callback();
	});
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

// 处理所有正在提名的帖子是否通过
SocketInvite.checkingVote = function (socket, data, callback) {
	var query = {
		setKey: 'invite:posts:iid',
		reverse: true,
		start: 0,
		stop: -1,
		uid: socket.uid
	};
	invite.getInvite(query, function (err, data) {
		if (err) {
			return next(err);
		}

		var invitesData = data.invite.filter(function (item) {
			return item.status === 'voting';
		});

		if (invitesData && invitesData.length === 0) {
			callback(null, 0);
		}

		async.map(invitesData, function (inviteData, callback) {
			var voteCount,
				upvoteCount,
				iid = inviteData.iid;

			async.waterfall([
				function (next) {
					db.getObjectField('invite:' + iid, 'inviteCount', next);
				},
				function (count, next) {
					upvoteCount = parseInt(count, 10);
					inviteData.inviteCount = upvoteCount;
					// 获取用户总数
					db.getObjectField('invite:' + iid, 'downvoteCount', next);
				},
				function (count, next) {
					inviteData.downvoteCount = count ? parseInt(count, 10) : 0;
					voteCount = inviteData.voteCount = inviteData.inviteCount - inviteData.downvoteCount;
					// 获取用户总数
					db.getObjectField('global', 'userCount', next);
				},
				function (userCount, next) {
					// 判断是否通过投票比例
					inviteData.passInvite = voteCount / parseInt(userCount, 10) >= (meta.config.votePercent ? meta.config.votePercent / 100 : 0.5);

					// 通过投票比例则发出邀请，否则通知所有用户进行投票
					if (inviteData.passInvite) {
						return invite.inviteUser(socket.uid, inviteData, next);
					}
					next();
				},
				function (next) {
					invite.getInviteFields(iid, ['invited', 'username'], next);
				},
				function (data, next) {
					data.upvoteCount = upvoteCount;
					inviteData.upvoteCount = upvoteCount;
					data.isInvited = !!parseInt(data.invited, 10);
					websockets.in('invite_' + iid).emit('event:invite_upvote', data);
					next(null, inviteData);
				}
			], callback);
		}, function (err) {
			if (err) {
				return console.log(err);
			}
			callback(null, invitesData.length)
		});
	});
};

SocketInvite.upvote = function (socket, data, callback) {
	favouriteCommand(socket, 'upvote', data, callback);
};

SocketInvite.downvote = function (socket, data, callback) {
	favouriteCommand(socket, 'downvote', data, callback);
};

function favouriteCommand(socket, command, data, callback) {
	if (!data || !data.iid || !data.room_id) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.parallel({
		exists: function (next) {
			invite.exists(data.iid, next);
		},
		inviteData: function (next) {
			invite.getInviteData(data.iid, next);
		},
		isInvited: function (next) {
			invite.isInvited(data.iid, next);
		},
		deleted: function (next) {
			invite.getInviteField(data.iid, 'deleted', next);
		}
	}, function (err, results) {
		if (err || !results.exists) {
			return callback(err || new Error('[[error:invalid-pid]]'));
		}

		if (parseInt(results.inviteData.invited, 10)) {
			return callback(err || new Error('[[invite:error.has-invited]]'));
		}

		if (parseInt(results.inviteData.joined, 10)) {
			return callback(err || new Error('[[invite:error.has-joined]]'));
		}

		if (parseInt(results.deleted, 10) === 1) {
			return callback(new Error('[[error:post-deleted]]'));
		}

		if (command === 'upvote') {
			invite.upvote(socket.uid, results.inviteData, callback);
		}

		if (command === 'downvote') {
			invite.downvote(socket.uid, results.inviteData, callback);
		}
	});
}

// 检查用户名是否存在
SocketInvite.usernameExists = function (socket, data, callback) {
	if (data && data.username) {
		invite.usernameExists(data.username, callback);
	}
};

// 检查邮箱是否存在
SocketInvite.emailExists = function (socket, data, callback) {
	if (data && data.email) {
		invite.emailExists(data.email, callback);
	}
};

// 排序
SocketInvite.setInviteSort = function (socket, sort, callback) {
	if (socket.uid) {
		user.setSetting(socket.uid, 'inviteSort', sort, callback);
	}
};

SocketInvite.loadMore = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.parallel({
		settings: function (next) {
			user.getSettings(socket.uid, next);
		}
	}, function (err, results) {
		if (err) {
			return callback(err);
		}

		var setKey = 'invite:posts:iid',
			reverse = true;

		var start = parseInt(data.after, 10),
			stop = start + results.settings.topicsPerPage - 1;

		invite.getInvite({
			setKey: setKey,
			reverse: reverse,
			start: start,
			stop: stop,
			uid: socket.uid
		}, function (err, data) {
			if (err) {
				return callback(err);
			}

			callback(null, data);
		});
	});
};

module.exports = SocketInvite;
