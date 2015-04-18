'use strict';

var async = require('async'),
	db = require('../database'),
	invite = require('../invite'),
	user = require('../user'),
	helpers = require('./helpers'),
	plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.invite = {};

	privileges.invite.get = function (iid, uid, callback) {
		async.waterfall([
			async.apply(invite.getInviteFields, iid, ['uid', 'joined', 'invited']),
			function (inviteData, next) {
				async.parallel({
					isAdministrator: async.apply(user.isAdministrator, uid),
					isOwner: async.apply(invite.isOwner, iid, uid),
					invite: function (next) {
						next(null, inviteData)
					}
				}, next);
			}
		], function (err, results) {
			if (err) {
				return callback(err);
			}

			var invite = results.invite,
				isSelf = results.isOwner,
				isAdmin = results.isAdministrator,
				editable = isAdmin,
				deletable = isAdmin || isSelf,

				data = {
					invited: !!parseInt(invite.joined, 10),
					joined: !!parseInt(invite.joined, 10),
					editable: editable,
					isSelf: isSelf,
					deletable: deletable,
					view_deleted: isAdmin || isSelf,
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
				isAdmin(uid, next);
			}
		], callback);
	};

	function isAdmin(uid, callback) {
		helpers.some([
			function (next) {
				user.isAdministrator(uid, next);
			}
		], callback);
	}
};
