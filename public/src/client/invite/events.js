"use strict";

define('forum/invite/events', ['components', 'translator'], function (components, translator) {
	var Events = {};

	var events = {
		'event:invite_edited': onEditInvite,
		'event:invite_deleted': onDeleteInvite,
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
		var votesEl = components.get('invite/upvote'),
			voteCountEl = components.get('invite/vote-count'),
			reasonEl = components.get('invite/reason');

		voteCountEl.text(data.inviteCount).attr('data-votes', data.inviteCount);

		if (data.isInvited) {
			var date = new Date(),
				minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes(),
				hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours(),
				invitedTime = date.getFullYear() + '/' + date.getMonth() + '/' + date.getDate() + ' - ' + hours + ':' + minutes;

			votesEl.removeClass('btn-primary').addClass('btn-danger');
			translator.translate('[[invite:email.invited]]', function(translated) {
				var timeEl = $('<hr><div class="invited"><span class="time"> ' + invitedTime + '</span><span> ' + translated + '</span></div>');

				timeEl.insertAfter(reasonEl).css('display', 'none').fadeIn(500);
			});
		}
	}

	function onEditInvite(data) {
		var contentEl = components.get('invite/content', data.iid),
			usernameEl = components.get('invite/header', data.iid);

		if (usernameEl.length) {
			usernameEl.fadeOut(250, function () {
				usernameEl.html(data.username).fadeIn(250);
			});
		}

		contentEl.fadeOut(250, function () {
			contentEl.html(data.content);
			contentEl.find('img').addClass('img-responsive');
			contentEl.fadeIn(250);

			$(window).trigger('action:invite.edited', data);
		});
	}

	function onDeleteInvite() {
		var inviteEl = components.get('invite');

		if (!inviteEl.length) {
			return;
		}

		translator.translate('[[invite:detail.deleted_message]]', function(translated) {
			inviteEl.fadeOut(500, function () {
				$('<div id="thread-deleted" class="alert alert-warning">' + translated + '</div>').insertBefore(inviteEl);
				inviteEl.remove();
			});
		});
	}

	return Events;
});