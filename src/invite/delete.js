'use strict';

var async = require('async'),
	db = require('../database'),

	user = require('../user'),
	plugins = require('../plugins');

module.exports = function(Invite) {
	Invite.delete = function(iid, callback) {
		async.parallel([
			function(next) {
				Invite.setInviteField(iid, 'deleted', 1, next);
			},
			function(next) {
				db.sortedSetsRemove(['invite:recent', 'invite:views'], iid, next);
			}
		], callback);
	};
};
