"use strict";

define('forum/invite/list', ['forum/invite/events', 'composer', 'components', 'navigator'], function (events, composer, components, navigator) {
	var Invite = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (ajaxify.currentPage !== data.url) {
			navigator.hide();
			components.get('navbar/title').find('span').text('').hide();
			app.removeAlert('bookmark');

			events.removeListeners();
		}
	});

	Invite.init = function () {
		app.enterRoom('invite_list');

		socket.removeListener('event:new_invite', Invite.onNewInvite);
		socket.on('event:new_invite', Invite.onNewInvite);

		$('#new_invite').on('click', function () {
			composer.newInvite();
		});
	};

	Invite.onNewInvite = function (vote) {
	};

	return Invite;
});

