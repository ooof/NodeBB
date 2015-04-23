'use strict';

var async = require('async'),
	db = require('../database'),

	user = require('../user'),
	plugins = require('../plugins');

module.exports = function (Invite) {
	Invite.restore = function (iid, callback) {
		Invite.getInviteField(iid, 'viewcount', function (err, count) {
			if (err) {
				return callback(err);
			}

			async.parallel([
				function (next) {
					Invite.setInviteField(iid, 'deleted', 0, next);
				},
				function (next) {
					db.sortedSetAdd('invite:views', count, iid, next);
				}
			], callback);
		});
	};

	Invite.delete = function (iid, callback) {
		var inviteData = {};
		async.waterfall([
			function (next) {
				Invite.getInviteField(iid, 'inviteCount', next);
			},
			function (inviteCount, next) {
				if (parseInt(inviteCount, 10)>1) {
					return next('该提名已有多少投票，无法删除');
				}
			},
			function (next) {
				db.sortedSetRemove('invite:views', iid, next);
			},
			function (next) {
				db.sortedSetRemove('invite:posts:iid', iid, next);
			},
			function (next) {
				db.getSetMembers('invite:posts:' + iid + ':upvote:by', function (err, uids) {
					if (err) {
						return next(err);
					}
					async.map(uids, function (uid, callback) {
						db.sortedSetRemove('invite:posts:uid:' + uid + ':iid', iid, callback);
					}, next);
				});
			},
			function (data, next) {
				db.getObject('invite:' + iid, next);
			},
			function (data, next) {
				inviteData = data;
				db.deleteObjectField('username:iid:invite', inviteData.username, next);
			},
			function (next) {
				db.deleteObjectField('invite:slug:iid', inviteData.slug, next);
			},
			function (next) {
				db.deleteObjectField('email:iid', inviteData.email, next);
			},
			function (next) {
				reduceCounters(next);
			}
		], function (err) {
			if (err) {
				return callback(err);
			}
			db.deleteAll([
				'invite:posts:' + iid + ':upvote:by',
				'invite:' + iid
			], callback);
		});
	};

	function reduceCounters(callback) {
		var incr = -1;
		async.parallel([
			function (next) {
				db.incrObjectFieldBy('global', 'inviteCount', incr, next);
			}
		], callback);
	}
};
