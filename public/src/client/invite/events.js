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
			courseEl = components.get('invite/course'),
			editEl = components.get('invite/edit'),
			deleteEl = components.get('invite/delete'),
			lastEl = courseEl.children().last(),
			voteCountEl = components.get('invite/vote-count');

		// 投票后，隐藏投票按钮
		votesEl.parent().remove();
		voteCountEl.text(data.inviteCount).attr('data-votes', data.inviteCount);

		// 当票数大于1，删除编辑和删除按钮
		if (data.inviteCount > 1) {
			editEl.remove();
			deleteEl.remove();
		}

		// 当发出邀请，更新邀请内容
		if (data.isInvited) {
			var date = new Date(),
				minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes(),
				hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours(),
				invitedTime = date.getFullYear() + '/' + date.getMonth() + '/' + date.getDate() + ' - ' + hours + ':' + minutes;

			lastEl.text(invitedTime + ' 对 ' + data.username + ' 的提名已获得 ' + data.inviteCount + ' 票支持，达到邀请票数，邀请邮件已经发出；');
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