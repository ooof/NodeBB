'use strict';

var async = require('async'),
	db = require('../database'),
	invite = require('../invite'),
	user = require('../user'),
	helpers = require('./helpers'),
	groups = require('../groups'),
	categories = require('../categories'),
	plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.invite = {};

	privileges.invite.get = function (iid, uid, callback) {
		async.waterfall([
			async.apply(invite.getInviteFields, iid, ['uid', 'joined', 'invited']),
			function (vote, next) {
				async.parallel({
					isAdministrator: async.apply(user.isAdministrator, uid),
					invite: function (next) {
						next(null, vote)
					}
				}, next);
			}
		], function (err, results) {
			if (err) {
				return callback(err);
			}

			var invite = results.invite,
				isOwner = parseInt(uid, 10) === parseInt(invite.uid, 10),
				isAdmin = results.isAdministrator,
				editable = isAdmin || results.manage_vote,
				deletable = isAdmin || isOwner,

				data = {
					invited: !!parseInt(invite.joined, 10),
					joined: !!parseInt(invite.joined, 10),
					editable: editable,
					deletable: deletable,
					view_deleted: isAdmin || results.isOwner,
					iid: iid,
					uid: uid
				};

			callback(null, data);
		});
	};

	privileges.invite.canEdit = function (iid, uid, callback) {
		helpers.some([
			function (next) {
				invite.isOwner(iid, uid, next);
			},
			function (next) {
				isAdminOrMod(iid, uid, next);
			}
		], callback);
	};

	privileges.invite.canMove = function (tid, uid, callback) {
		isAdminOrMod(tid, uid, callback);
	};

	function isAdminOrMod(tid, uid, callback) {
		helpers.some([
			function (next) {
				invite.getVoteField(tid, 'cid', function (err, cid) {
					if (err) {
						return next(err);
					}
					user.isModerator(uid, cid, next);
				});
			},
			function (next) {
				user.isAdministrator(uid, next);
			}
		], callback);
	}
};
