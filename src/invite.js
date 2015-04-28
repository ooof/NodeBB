"use strict";

var async = require('async'),
	validator = require('validator'),
	_ = require('underscore'),
	db = require('./database'),
	utils = require('../public/src/utils'),
	plugins = require('./plugins'),
	user = require('./user');

(function (Invite) {
	require('./invite/create')(Invite);
	require('./invite/delete')(Invite);
	require('./invite/unread')(Invite);
	require('./invite/user')(Invite);
	require('./invite/upvote')(Invite);

	Invite.exists = function (iid, callback) {
		db.isSortedSetMember('invite:posts:iid', iid, callback);
	};

	Invite.isInvited = function (iid, callback) {
		db.getObjectFields('invite:' + iid, ['invited', 'joined'], callback);
	};

	Invite.getInviteData = function (iid, callback) {
		db.getObject('invite:' + iid, function (err, invite) {
			if (err || !invite) {
				return callback(err);
			}
			modifyVote(invite, callback);
		});
	};

	Invite.getInvitesData = function (iids, callback) {
		var keys = [];

		for (var i = 0; i < iids.length; ++i) {
			keys.push('invite:' + iids[i]);
		}

		db.getObjects(keys, function (err, invites) {
			if (err) {
				return callback(err);
			}
			async.map(invites, modifyVote, callback);
		});
	};

	function modifyVote(invite, callback) {
		if (!invite) {
			return callback(null, invite);
		}
		invite.username = validator.escape(invite.username);
		invite.relativeTime = utils.toISOString(invite.timestamp);
		callback(null, invite);
	}

	Invite.getInviteFromSet = function (set, uid, start, end, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange(set, start, end, next);
			},
			function (iids, next) {
				Invite.getVotes(iids, uid, next);
			},
			function (invites, next) {
				next(null, {invites: invites, nextStart: end + 1});
			}
		], callback);
	};

	Invite.getInvite = function (data, callback) {
		async.parallel({
			isAdmin: function (next) {
				user.isAdministrator(data.uid, next);
			},
			invite: function (next) {
				async.waterfall([
					function (next) {
						Invite.getInviteIds(data.setKey, data.reverse, data.start, data.stop, next);
					},
					function (iids, next) {
						Invite.getInviteByIids(iids, data.uid, next);
					},
					function (invite, next) {
						if (!Array.isArray(invite) || !invite.length) {
							return next(null, []);
						}

						for (var i = 0; i < invite.length; ++i) {
							invite[i].index = data.start + i;
						}
						next(null, invite);
					}
				], next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
			results.invite = results.invite.filter(function (data) {
				return (!data.deleted || results.isAdmin || data.isOwner);
			});

			callback(null, {invite: results.invite, nextStart: data.stop + 1});
		});
	};

	Invite.getInviteIds = function (setKey, reverse, start, stop, callback) {
		if (reverse) {
			db.getSortedSetRevRange(setKey, start, stop, callback);
		} else {
			db.getSortedSetRange(setKey, start, stop, callback);
		}
	};

	Invite.getInviteByIids = function (iids, uid, callback) {
		if (!Array.isArray(iids) || !iids.length) {
			return callback(null, []);
		}

		Invite.getInvitesData(iids, function (err, invites) {
			function mapFilter(array, field) {
				return array.map(function (invite) {
					return invite && invite[field] && invite[field].toString();
				}).filter(function (value, index, array) {
					return utils.isNumber(value) && array.indexOf(value) === index;
				});
			}

			if (err) {
				return callback(err);
			}

			var uids = mapFilter(invites, 'uid');

			async.parallel({
				users: function (next) {
					user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
				},
				hasRead: function (next) {
					Invite.hasReadInvites(iids, uid, next);
				}
			}, function (err, results) {
				if (err) {
					return callback(err);
				}

				var users = _.object(uids, results.users);

				for (var i = 0; i < invites.length; ++i) {
					if (invites[i]) {
						invites[i].user = users[invites[i].uid];

						invites[i].isOwner = parseInt(invites[i].uid, 10) === parseInt(uid, 10);
						invites[i].pinned = parseInt(invites[i].pinned, 10) === 1;
						invites[i].locked = parseInt(invites[i].locked, 10) === 1;
						invites[i].deleted = parseInt(invites[i].deleted, 10) === 1;
						invites[i].unread = !results.hasRead[i];
					}
				}

				callback(err, invites);
			});
		});
	};

	Invite.getInviteField = function (iid, field, callback) {
		db.getObjectField('invite:' + iid, field, callback);
	};

	Invite.getInviteFields = function (iid, fields, callback) {
		db.getObjectFields('invite:' + iid, fields, callback);
	};

	Invite.getInvitesFields = function (iids, fields, callback) {
		if (!Array.isArray(iids) || !iids.length) {
			return callback(null, []);
		}
		var keys = iids.map(function (iid) {
			return 'invite:' + iid;
		});
		db.getObjectsFields(keys, fields, callback);
	};

	Invite.setInviteField = function (iid, field, value, callback) {
		db.setObjectField('invite:' + iid, field, value, callback);
	};

	Invite.setInviteFields = function (iid, data, callback) {
		db.setObject('invite:' + iid, data, callback);
	};

	Invite.increaseViewCount = function(iid, callback) {
		callback = callback || function() {};
		db.incrObjectFieldBy('invite:' + iid, 'viewcount', 1, function(err, value) {
			if (err) {
				return callback(err);
			}
			db.sortedSetAdd('invite:views', value, iid, callback);
		});
	};

	Invite.isLocked = function (iid, callback) {
		Invite.getVoteField(iid, 'locked', function (err, locked) {
			callback(err, parseInt(locked, 10) === 1);
		});
	};

	Invite.search = function (tid, term, callback) {
		if (plugins.hasListeners('filter:invite.search')) {
			plugins.fireHook('filter:invite.search', {
				tid: tid,
				term: term
			}, callback);
		} else {
			callback(new Error('no-plugins-available'), []);
		}
	};

}(exports));
