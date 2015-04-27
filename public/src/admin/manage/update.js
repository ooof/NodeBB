"use strict";
/*global define, templates, socket, ajaxify, app, admin, bootbox, utils, config */

define('admin/manage/update', [], function () {
	var Update = {};

	Update.init = function () {
		var updateV11 = $('[data-action="update-version-11"]'),
			updateV12 = $('[data-action="update-version-12"]'),
			updateV13 = $('[data-action="update-version-13"]'),
			updateV14 = $('[data-action="update-version-14"]'),
			updateV15 = $('[data-action="update-version-15"]'),
			updateV16 = $('[data-action="update-version-16"]');

		updateV11.on('click', function () {
			socket.emit('admin.update.version.V11', {version: 'v11'}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				updateV11.next().text('升级完成...')
			});
		});

		updateV12.on('click', function () {
			socket.emit('admin.update.version.V12', {version: 'v12'}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				updateV12.next().text('升级完成...')
			});
		});

		updateV13.on('click', function () {
			socket.emit('admin.update.version.V13', {version: 'v13'}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				updateV13.next().text('升级完成...')
			});
		});

		updateV14.on('click', function () {
			socket.emit('admin.update.version.V14', {version: 'v14'}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				updateV14.next().text('升级完成...')
			});
		});

		updateV15.on('click', function () {
			socket.emit('admin.update.version.V15', {version: 'v15'}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				updateV15.next().text('升级完成...')
			});
		});

		updateV16.on('click', function () {
			socket.emit('admin.update.version.V16', {version: 'v16'}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				updateV16.next().text('升级完成...')
			});
		});
	};

	return Update;
});