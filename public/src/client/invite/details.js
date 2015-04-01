"use strict";

define('forum/invite/details', ['composer', 'forum/invite/events'], function (composer, events) {
	var InviteDetails = {};

	$(window).on('action:ajaxify.start', function(ev, data) {
		if (ajaxify.currentPage !== data.url) {
			navigator.hide();
			components.get('navbar/title').find('span').text('').hide();
			app.removeAlert('bookmark');

			events.removeListeners();
		}
	});

	InviteDetails.init = function () {
		var iid = ajaxify.variables.get('invite_id');

		$(window).trigger('action:vote.loading');

		app.enterRoom('invite_' + iid);

		addPostHandlers(iid);

		events.init();
	};

	function addPostHandlers(iid) {
		var postContainer = components.get('invite');

		postContainer.on('click', '[component="invite/upvote"]', function () {
			return upvoteInvite(iid);
		});

		postContainer.on('click', '[component="invite/edit"]', function () {
			composer.editInvite(iid);
		});

		postContainer.on('click', '[component="invite/delete"]', function () {
			deleteInvite(iid);
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
		translator.translate('[[topic:post_delete_confirm]]', function(msg) {
			bootbox.confirm(msg, function(confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('invite.delete', {
					iid: iid
				}, function(err) {
					if(err) {
						app.alertError(err.message);
					}
				});
			});
		});
	}

	return InviteDetails;
});
