"use strict";

define('forum/invite/list', ['composer', 'navigator'], function (composer, navigator) {
	var Invite = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (data && data.tpl_url !== 'invite') {
			navigator.hide();

			removeListeners();
		}
	});

	function removeListeners() {
		socket.removeListener('event:new_vote', Invite.onNewInvite);
	}

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

