'use strict';

var async = require('async'),
	websockets = require('../socket.io'),
	db = require('../database');

module.exports = function (Invite) {
	Invite.upVote = function (uid, iid, callback) {
		var argLength = arguments.length;
		callback = argLength === 4 ? arguments[argLength-1] : callback;

		// invite:posts:uid:{uid}:iid 不同用户创建并默认投票支持了所有邀请贴 iid
		// invite:posts:{iid}:upvote:by 不同邀请贴被投票支持的所有用户 uid

		db.isSetMember('invite:posts:upvote:' + iid + ':by', uid, function (err, value) {
			if (err) {
				return callback(err);
			}

			if (value) {
				return callback(new Error('[[invite:error.already-voted]]'));
			}

			var now = Date.now();
			async.waterfall([
				function (next) {
					db.sortedSetAdd('invite:posts:uid:' + uid + ':iid', now, iid, next);
				},
				function (next) {
					db.setAdd('invite:posts:' + iid + 'upvote:by', uid, next);
				},
				function (next) {
					db.incrObjectField('invite:' + iid, 'inviteCount', function (err, count) {
						if (err) {
							return callback(err);
						}
						if (argLength === 4) {
							websockets.in('invite_' + iid).emit('event:invite_upvote', count);
						}

						next(null, count);
					});
				}
			], function (err, count) {
				if (err) {
					return callback(err);
				}

				Invite.inviteUser(uid, iid, count, callback);
			});
		});
	};
};
