'use strict';

var async = require('async'),
	nconf = require('nconf'),
	websockets = require('../socket.io'),
	meta = require('../meta'),
	user = require('../user'),
	db = require('../database');

module.exports = function (Invite) {
	Invite.upvote = function (uid, inviteData, callback) {
		// invite:posts:uid:{uid}:iid 创建并默认投票该邀请贴
		// invite:posts:{iid}:upvote:by 投票支持邀请贴的所有用户

		var iid = inviteData.iid;

		db.isSetMember('invite:posts:' + iid + ':upvote:by', uid, function (err, value) {
			if (err) {
				return callback(err);
			}

			if (value) {
				return callback(new Error('[[invite:error.already-voted]]'));
			}

			var timestamp = Date.now(),
				voteCount,
				upvoteCount;

			async.waterfall([
				function (next) {
					db.sortedSetAdd('invite:posts:uid:' + uid + ':iid', timestamp, iid, next);
				},
				function (next) {
					db.setAdd('invite:posts:' + iid + ':upvote:by', uid, next);
				},
				function (next) {
					db.incrObjectField('invite:' + iid, 'inviteCount', next);
				},
				function (count, next) {
					upvoteCount = parseInt(count, 10);
					inviteData.inviteCount = upvoteCount;
					// 获取用户总数
					db.getObjectField('invite:' + iid, 'downvoteCount', next);
				},
				function (count, next) {
					inviteData.downvoteCount = parseInt(count, 10);
					voteCount  = inviteData.voteCount = inviteData.inviteCount - inviteData.downvoteCount;
					// 获取用户总数
					db.getObjectField('global', 'userCount', next);
				},
				function (userCount, next) {
					// 判断是否通过投票比例
					inviteData.passInvite = voteCount / parseInt(userCount, 10) >= (meta.config.votePercent ? meta.config.votePercent / 100 : 0.5);

					// 通过投票比例则发出邀请，否则通知所有用户进行投票
					if (inviteData.passInvite) {
						return Invite.inviteUser(uid, inviteData, next);
					}
					// 当数量为1的时候，就是提名人默认投的票，此时通知全站用户参与投票
					if (upvoteCount === 1) {
						return Invite.sendUpvoteNotification(inviteData, next);
					}
					next();
				},
				function (next) {
					Invite.getInviteFields(iid, ['invited', 'username'], next);
				},
				function (data, next) {
					data.upvoteCount = upvoteCount;
					inviteData.upvoteCount = upvoteCount;
					data.isInvited = !!parseInt(data.invited, 10);
					websockets.in('invite_' + iid).emit('event:invite_upvote', data);
					next(null, inviteData);
				}
			], callback);
		});
	};
};
