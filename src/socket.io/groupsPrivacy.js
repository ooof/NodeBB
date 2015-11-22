"use strict";

var	groups = require('../groupsPrivacy'),
	meta = require('../meta'),
	user = require('../user'),

	async = require('async'),

	SocketGroupsPrivacy = {};

SocketGroupsPrivacy.create = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	} else if (socket.uid === 0) {
		return callback(new Error('[[error:no-privileges]]'));
	} else if (parseInt(meta.config.allowGroupCreation, 10) !== 1) {
		return callback(new Error('[[error:group-creation-disabled]]'));
	}


	data.ownerUid = socket.uid;
	groups.create(data, callback);
};

module.exports = SocketGroupsPrivacy;
