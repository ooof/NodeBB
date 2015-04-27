"use strict";

var async = require('async'),
	db = require('../../database'),
	groups = require('../../groups'),
	user = require('../../user'),
	events = require('../../events'),
	invite = require('../../invite'),
	meta = require('../../meta'),
	websockets = require('../index'),
	Update = {
		version: {}
	};

/**
 * user invite:{iid}
 *
 * status
 */
Update.version.V11 = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			invite.getInviteIds('invite:posts:iid', false, 0, -1, next);
		},
		function (iids, next) {
			invite.getInvitesData(iids, next);
		},
		function (data, next) {
			async.map(data, function (item, next) {
				var iid = item.iid;

				if (parseInt(item.joined, 10) === 1) {
					// 已进社区
					return invite.setInviteField(iid, 'status', 'joined', next);
				} else if (parseInt(item.expired, 10) === 1) {
					// 邀请失败
					return invite.setInviteField(iid, 'status', 'failed', next);
				} else if (parseInt(item.joined, 10) === 0 && parseInt(item.invited, 10) === 1 && parseInt(item.expired, 10) === 0) {
					// 已发邀请
					return invite.setInviteField(iid, 'status', 'invited', next);
				} else if (parseInt(item.invited, 10) === 0) {
					// 正在投票
					return invite.setInviteField(iid, 'status', 'voting', next);
				}
				next();
			}, next);
		}
	], callback);
};

/**
 * user user:{uid}
 *
 * invitedBy rename to invitedByUid
 */
Update.version.V12 = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			user.getUidsFromHash('username:uid', next);
		},
		function (uids, next) {
			user.getMultipleUserFields(uids, ['uid', 'invitedBy'], next);
		},
		function (userData, next) {
			async.map(userData, function (item, next) {
				async.waterfall([
					function (next) {
						user.setUserField(item.uid, 'invitedByUid', item.invitedBy, next)
					},
					function (next) {
						db.deleteObjectField('user:' + item.uid, 'invitedBy', next);
					}
				], next);
			}, next)
		}
	], callback);
};

/**
 * invite invite:{iid}
 *
 * invitedByUsername
 */

Update.version.V13 = function (socket, data, callback) {
	var iids = [];

	async.waterfall([
		function (next) {
			db.getSortedSetRangeWithScores('invite:posts:iid', 0, -1, next);
		},
		function (inviteIids, next) {
			iids = inviteIids.map(function (iid) {
				return iid.value;
			});

			next(null, iids);
		},
		function (iids, next) {
			var keys = iids.map(function (iid) {
				return 'invite:' + iid;
			});
			next(null, keys);
		},
		function (keys, next) {
			async.each(keys, function (key, next) {
				async.waterfall([
					function (next) {
						db.getObjectField(key, 'uid', next)
					},
					function (uid, next) {
						db.getObjectField('user:' + uid, 'username', next);
					},
					function (username, next) {
						db.setObjectField(key, 'invitedByUsername', username, next);
					}
				], next)

			}, next);
		}
	], callback);
};

/**
 * invite invite:{iid}
 *
 * realUsername
 */

Update.version.V14 = function (socket, data, callback) {
	var iids = [];

	async.waterfall([
		function (next) {
			db.getSortedSetRangeWithScores('invite:posts:iid', 0, -1, next);
		},
		function (inviteIids, next) {
			iids = inviteIids.map(function (iid) {
				return iid.value;
			});

			next(null, iids);
		},
		function (iids, next) {
			var keys = iids.map(function (iid) {
				return 'invite:' + iid;
			});
			next(null, keys);
		},
		function (keys, next) {
			async.each(keys, function (key, callback) {
				async.waterfall([
					function (next) {
						db.getObjectField(key, 'uid, joined', next)
					},
					function (data, next) {
						if (parseInt(data.joined, 10) === 0) {
							return callback();
						}
						db.getObjectField('user:' + data.uid, 'username', next);
					},
					function (username, next) {
						db.setObjectField(key, 'realUsername', username, next);
					}
				], callback)

			}, next);
		}
	], callback);
};

/**
 * user user:{uid}
 *
 * invitedByUsername
 */

Update.version.V15 = function (socket, data, callback) {
};

/**
 * user user:{uid}
 *
 * invitedUsername
 */

Update.version.V16 = function (socket, data, callback) {
};

module.exports = Update;
