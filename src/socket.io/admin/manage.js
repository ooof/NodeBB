"use strict";

var appInfo = require('../../../package'),
	Manage = {
		version: {}
	};

Manage.version.info = function (socket, callback) {
	var version = appInfo.devVersion;
	callback(null, version);
};

module.exports = Manage;
