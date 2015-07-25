'use strict';

var async = require('async'),
	nconf = require('nconf'),
	websockets = require('../socket.io'),
	meta = require('../meta'),
	user = require('../user'),
	db = require('../database');

module.exports = function (Invite) {
	Invite.downvote = function (uid, inviteData, callback) {
		var iid = inviteData.iid;

		db.isSetMember('invite:posts:' + iid + ':downvote:by', uid, function (err, value) {
			if (err) {
				return callback(err);
			}

			if (value) {
				return callback(new Error('[[invite:error.already-downvoted]]'));
			}

			async.waterfall([
				function (next) {
					db.setAdd('invite:posts:' + iid + ':downvote:by', uid, next);
				},
				function (next) {
					db.incrObjectField('invite:' + iid, 'downvoteCount', next);
				},
				function (count, next) {
					inviteData.downvoteCount = parseInt(count, 10);
					Invite.getInviteFields(iid, ['username'], next);
				},
				function (data, next) {
					data.downvoteCount = inviteData.downvoteCount;
					data.isInvited = false;
					websockets.in('invite_' + iid).emit('event:invite_downvote', data);
					next(null, inviteData);
				}
			], callback);
		});
	};
};
