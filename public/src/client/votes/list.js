"use strict";

define('forum/votes/list', ['composer', 'navigator'], function (composer, navigator) {
	var Votes = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (data && data.tpl_url !== 'vote') {
			navigator.hide();

			removeListeners();
		}
	});

	function removeListeners() {
		socket.removeListener('event:new_vote', Votes.onNewVote);
	}

	Votes.init = function () {
		app.enterRoom('vote_list');

		socket.removeListener('event:new_vote', Votes.onNewVote);
		socket.on('event:new_vote', Votes.onNewVote);

		$('#new_vote').on('click', function () {
			composer.newVote();
		});
	};

	Votes.onNewVote = function (vote) {
	};

	return Votes;
});

