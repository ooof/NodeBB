"use strict";
/* globals app, define, ajaxify, socket, bootbox, utils, templates */

define('forum/groups-privacy/list', function () {
	var Groups = {};

	Groups.init = function () {
		// Group creation
		$('button[data-action="privacy-new"]').on('click', function () {
			bootbox.prompt('隐私群组名:', function (name) {
				if (name && name.length) {
					socket.emit('groupsPrivacy.create', {
						name: name
					}, function (err) {
						if (!err) {
							ajaxify.go('privacy-groups/' + utils.slugify(name));
						} else {
							app.alertError(err.message);
						}
					});
				}
			});
		});

		// Group searching
		$('#search-text').on('keyup', Groups.search);
		$('#search-button').on('click', Groups.search);
		$('#search-sort').on('change', Groups.search);
	};

	Groups.search = function () {
		var groupsEl = $('#groups-list'),
			queryEl = $('#search-text'),
			sortEl = $('#search-sort');

		socket.emit('groupsPrivacy.search', {
			query: queryEl.val(),
			options: {
				expand: true,
				truncateUserList: true,
				sort: sortEl.val()
			}
		}, function (err, groups) {
			templates.parse('partials/groups/list', {
				groups: groups
			}, function (html) {
				groupsEl.empty().append(html);
			});
		});
		return false;
	};

	return Groups;
});