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
		addSymbol();

		events.init();
	};

	function addSymbol() {
		var inviteCourseEls = $('[component="invite/course"]').children();
		inviteCourseEls.map(function (index) {
			var self = $(this);

			if (index !== inviteCourseEls.length - 1) {
				return self.html(self.html() + '；')
			}
			return self.html(self.html() + '。')
		})
	}

	function addHandlers(data) {
		var inviteContainer = components.get('invite').children('.post-row');

		inviteContainer.on('click', '[component="invite/upvote"]', function () {
			return upvoteInvite(data.iid);
		});

		inviteContainer.on('click', '[component="invite/edit"]', function () {
			composer.editInvite(data.iid);
		});

		inviteContainer.on('click', '[component="invite/delete"]', function () {
			deleteInvite(data.iid);
		});

		inviteContainer.on('click', '[component="invite/chat"]', function () {
			app.openChat(inviteContainer.attr('data-username'), inviteContainer.attr('data-uid'));
		});
	}

	function upvoteInvite(iid) {
		// 删除投票按钮
		components.get('invite/upvote').parent().remove();

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
