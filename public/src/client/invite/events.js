"use strict";

define('forum/invite/events', [], function () {
	var Events = {};

	var events = {
		'invite.upvote': updatePostVotes
	};

	Events.init = function () {
		Events.removeListeners();
		for (var eventName in events) {
			if (events.hasOwnProperty(eventName)) {
				socket.on(eventName, events[eventName]);
			}
		}
	};

	Events.removeListeners = function () {
		for (var eventName in events) {
			if (events.hasOwnProperty(eventName)) {
				socket.removeListener(eventName, events[eventName]);
			}
		}
	};

	function updatePostVotes(data) {
		var votesEl = components.get('invite/vote-count');

		votesEl.text(data).attr('data-votes', data);
	}

	return Events;
});