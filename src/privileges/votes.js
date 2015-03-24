'use strict';

var async = require('async'),

	db = require('../database'),
	votes = require('../votes'),
	user = require('../user'),
	helpers = require('./helpers'),
	groups = require('../groups'),
	categories = require('../categories'),
	plugins = require('../plugins');

module.exports = function(privileges) {

	privileges.votes = {};

	privileges.votes.get = function(tid, uid, callback) {
		async.waterfall([
			async.apply(votes.getVoteFields, tid, ['cid', 'uid']),
			function(vote, next) {
				async.parallel({
					'votes:reply': async.apply(helpers.isUserAllowedTo, 'votes:reply', uid, [vote.cid]),
					read: async.apply(helpers.isUserAllowedTo, 'read', uid, [vote.cid]),
					isOwner: function(next) {
						next(null, parseInt(uid, 10) === parseInt(vote.uid, 10));
					},
					manage_vote: async.apply(helpers.hasEnoughReputationFor, 'privileges:manage_vote', uid),
					isAdministrator: async.apply(user.isAdministrator, uid),
					isModerator: async.apply(user.isModerator, uid, vote.cid),
					disabled: async.apply(categories.getCategoryField, vote.cid, 'disabled')
				}, next);
			}
		], function(err, results) {
			if (err) {
				return callback(err);
			}

			var disabled = parseInt(results.disabled, 10) === 1;
			var	isAdminOrMod = results.isAdministrator || results.isModerator;
			var editable = isAdminOrMod || results.manage_vote;
			var deletable = isAdminOrMod || results.isOwner;

			plugins.fireHook('filter:privileges.votes.get', {
				'votes:reply': results['votes:reply'][0] || isAdminOrMod,
				read: results.read[0] || isAdminOrMod,
				view_thread_tools: editable || deletable,
				editable: editable,
				deletable: deletable,
				view_deleted: isAdminOrMod || results.manage_vote || results.isOwner,
				disabled: disabled,
				tid: tid,
				uid: uid
			}, callback);
		});
	};

	privileges.votes.filter = function(privilege, tids, uid, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}

		votes.getVotesFields(tids, ['tid', 'cid'], function(err, votes) {
			if (err) {
				return callback(err);
			}

			var cids = votes.map(function(vote) {
				return vote.cid;
			});

			privileges.categories.filterCids(privilege, cids, uid, function(err, cids) {
				if (err) {
					return callback(err);
				}

				tids = votes.filter(function(vote) {
					return cids.indexOf(vote.cid) !== -1;
				}).map(function(vote) {
					return vote.tid;
				});

				plugins.fireHook('filter:privileges.votes.filter', {
					privilege: privilege,
					uid: uid,
					tids: tids
				}, function(err, data) {
					callback(err, data ? data.tids : null);
				});
			});
		});
	};

	privileges.votes.canEdit = function(tid, uid, callback) {
		helpers.some([
			function(next) {
				votes.isOwner(tid, uid, next);
			},
			function(next) {
				helpers.hasEnoughReputationFor('privileges:manage_vote', uid, next);
			},
			function(next) {
				isAdminOrMod(tid, uid, next);
			}
		], callback);
	};

	privileges.votes.canMove = function(tid, uid, callback) {
		isAdminOrMod(tid, uid, callback);
	};

	function isAdminOrMod(tid, uid, callback) {
		helpers.some([
			function(next) {
				votes.getVoteField(tid, 'cid', function(err, cid) {
					if (err) {
						return next(err);
					}
					user.isModerator(uid, cid, next);
				});
			},
			function(next) {
				user.isAdministrator(uid, next);
			}
		], callback);
	}
};
