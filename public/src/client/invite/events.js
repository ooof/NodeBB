"use strict";

define('forum/invite/events', [], function () {
	var Events = {};

	var events = {
		'event:invite_edited': onEditInvite,

		'event:invite_upvote': onUpvoteInvite
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

	function onUpvoteInvite(data) {
		var votesEl = components.get('invite/vote-count');

		votesEl.text(data).attr('data-votes', data);
	}

	function onEditInvite(data) {
		var contentEl = components.get('invite/content', data.iid),
			usernameEl = components.get('invite/header', data.iid);

		if (usernameEl.length) {
			usernameEl.fadeOut(250, function() {
				usernameEl.html(data.username).fadeIn(250);
			});
		}

		contentEl.fadeOut(250, function() {
			contentEl.html(data.content);
			contentEl.find('img').addClass('img-responsive');
			contentEl.fadeIn(250);

			$(window).trigger('action:invite.edited', data);
		});
	}
	return Events;
});