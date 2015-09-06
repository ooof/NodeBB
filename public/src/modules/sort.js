'use strict';
/* globals define, config, socket, app, ajaxify, templates */

define('sort', ['components'], function (components) {
	var module = {};

	module.handleSort = function (field, method, gotoOnSave) {
		var threadSort = components.get('thread/sort');
		threadSort.find('i').removeClass('fa-check');
		var currentSetting = threadSort.find('a[data-sort="' + config[field] + '"]');
		currentSetting.find('i').addClass('fa-check');

		threadSort.on('click', 'a', function () {
			var newSetting = $(this).attr('data-sort');
			socket.emit(method, newSetting, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				config[field] = newSetting;
				if (field === 'inviteSort') {
					console.log(newSetting);
					if (newSetting !== 'newest_to_oldest') {
						return ajaxify.go(gotoOnSave + '?status=' + newSetting);
					} else {
						return ajaxify.go(gotoOnSave);
					}
				}
				ajaxify.go(gotoOnSave);
			});
		});
	};

	return module;
});
