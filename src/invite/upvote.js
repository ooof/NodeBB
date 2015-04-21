'use strict';

var async = require('async'),
	nconf = require('nconf'),
	websockets = require('../socket.io'),
	meta = require('../meta'),
	user = require('../user'),
	db = require('../database');

module.exports = function (Invite) {
	Invite.upVote = function (inviteData, callback) {
		// invite:posts:uid:{uid}:iid 创建并默认投票该邀请贴
		// invite:posts:{iid}:upvote:by 投票支持邀请贴的所有用户

		var uid = inviteData.uid,
			iid = inviteData.iid;

		db.isSetMember('invite:posts:' + iid + ':upvote:by', uid, function (err, value) {
			if (err) {
				return callback(err);
			}

			if (value) {
				return callback(new Error('[[invite:error.already-voted]]'));
			}

			var now = Date.now(),
				inviteCount;

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
					inviteCount = count;
					// 获取用户总数
					db.getObjectField('global', 'userCount', next);
				},
				function (userCount, next) {
					// 判断是否通过投票比例
					inviteData.passInvite = parseInt(inviteCount, 10) / parseInt(userCount, 10) >= (meta.config.votePercent ? meta.config.votePercent / 100 : 0.5);

					// 通过投票比例则发出邀请，否则通知所有用户进行投票
					if (inviteData.passInvite) {
						return Invite.inviteUser(inviteData, next);
					}

					Invite.notificationUserUpvote(inviteData, callback);
				},
				function (next) {
					db.getObjectFields('invite:' + iid, ['invited', 'username'], next);
				},
				function (data, next) {
					data.inviteCount = parseInt(inviteCount, 10);
					data.isInvited = !!parseInt(data.invited, 10);
					websockets.in('invite_' + iid).emit('event:invite_upvote', data);
					next(null, inviteData);
				}
			], callback);
		});
	};
};
