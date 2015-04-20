'use strict';

var async = require('async'),
	websockets = require('../socket.io'),
	db = require('../database');

module.exports = function (Invite) {
	Invite.upVote = function (uid, iid, callback) {
		// invite:posts:uid:{uid}:iid 创建并默认投票该邀请贴
		// invite:posts:{iid}:upvote:by 投票支持邀请贴的所有用户

		db.isSetMember('invite:posts:' + iid + ':upvote:by', uid, function (err, value) {
			if (err) {
				return callback(err);
			}

			if (value) {
				return callback(new Error('[[invite:error.already-voted]]'));
			}

			var now = Date.now(),
				voteCount;

			async.waterfall([
				function (next) {
					db.sortedSetAdd('invite:posts:uid:' + uid + ':iid', now, iid, next);
				},
				function (next) {
					db.setAdd('invite:posts:' + iid + ':upvote:by', uid, next);
				},
				function (next) {
					db.incrObjectField('invite:' + iid, 'inviteCount', next);
				},
				function (count, next) {
					voteCount = count;
					Invite.inviteUser(uid, iid, count, next);
				},
				function (next) {
					db.getObjectFields('invite:' + iid, ['invited', 'username'], next);
				}
			], function (err, inviteData) {
				if (err) {
					return callback(err);
				}
				var data = {
					username: inviteData.username,
					inviteCount: parseInt(voteCount, 10),
					isInvited: !!parseInt(inviteData.invited, 10)
				};
				websockets.in('invite_' + iid).emit('event:invite_upvote', data);
				callback();
			});
		});
	};
};
