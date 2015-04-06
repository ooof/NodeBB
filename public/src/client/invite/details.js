"use strict";

define('forum/invite/details', ['composer', 'components', 'navigator', 'translator', 'forum/invite/events'], function (composer, components, navigator, translator, events) {
	var InviteDetails = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (ajaxify.currentPage !== data.url) {
			navigator.hide();
			components.get('navbar/title').find('span').text('').hide();
			app.removeAlert('bookmark');

			events.removeListeners();
		}
	});

	InviteDetails.init = function () {
		var data = {
			iid: ajaxify.variables.get('invite_id'),
			yourid: ajaxify.variables.get('yourid'),
			theirid: ajaxify.variables.get('theirid')
		};

		$(window).trigger('action:vote.loading');

		app.enterRoom('invite_' + data.iid);

		addHandlers(data);

		events.init();
	};

	function addHandlers(data) {
		var postContainer = components.get('invite');

		postContainer.on('click', '[component="invite/upvote"]', function () {
			return upvoteInvite(data.iid);
		});

		postContainer.on('click', '[component="invite/edit"]', function () {
			composer.editInvite(data.iid);
		});

		postContainer.on('click', '[component="invite/delete"]', function () {
			deleteInvite(data.iid);
		});

		postContainer.on('click', '[component="invite/chat"]', function () {
			app.openChat($('.username a').html(), data.theirid);
		});
	}

	function upvoteInvite(iid) {
		socket.emit('invite.upvote', {
			iid: iid,
			room_id: app.currentRoom
		}, function (err) {
			if (err) {
				app.alertError(err.message);
			}
		});

		return false;
	}

	function deleteInvite(iid) {
		translator.translate('[[topic:post_delete_confirm]]', function (msg) {
			bootbox.confirm(msg, function (confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('invite.delete', {
					iid: iid
				}, function (err) {
					if (err) {
						app.alertError(err.message);
					}
				});
			});
		});
	}

	return InviteDetails;
});
