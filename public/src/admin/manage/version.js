"use strict";
/*global define, templates, socket, ajaxify, app, admin, bootbox, utils, config */

define('admin/manage/version', [], function () {
	var Version = {};

	Version.init = function () {
		socket.emit('admin.manage.version.info', function (err, version) {
			if (err) {
				return app.alertError(err.message);
			}
			var versionEl = $('.version-info');
			versionEl.text(version);
		});
	};

	return Version;
});
