"use strict";

define('forum/invite/events', ['components', 'translator'], function (components, translator) {
	var Events = {};

	var events = {
		'event:invite_edited': onEditInvite,
		'event:invite_deleted': onDeleteInvite,
		'event:invite_downvote': onDownvoteInvite,
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

	function onDownvoteInvite(data) {
		var downvoteEl = components.get('invite/downvote'),
			downvoteCountEl = components.get('invite/downvote-count'),
			resultVoteCountEl = components.get('invite/result-count'),
			resultVoteCount = parseInt(resultVoteCountEl.text(), 10) - 1,
			remainCountEl = components.get('invite/remain-vote'),
			remainCount = parseInt(remainCountEl.text(), 10) + 1;

		// 投票后，删除投票按钮
		downvoteEl.parent().remove();
		// 投票后，自增反对票数
		downvoteCountEl.text(data.downvoteCount).attr('data-downvote', data.downvoteCount);
		remainCountEl.text(remainCount).attr('data-votes', remainCount);
		resultVoteCountEl.text(resultVoteCount).attr('data-votes', resultVoteCount);
	}

	function onUpvoteInvite(data) {
		var editEl = components.get('invite/edit'),
			deleteEl = components.get('invite/delete'),
			courseEl = components.get('invite/course'),
			voteCountEl = components.get('invite/vote-count'),
			upvoteEl = components.get('invite/upvote'),
			upvoteCountEl = components.get('invite/upvote-count'),
			resultVoteCountEl = components.get('invite/result-count'),
			resultVoteCount = parseInt(resultVoteCountEl.text(), 10) - 1,
			remainCountEl = components.get('invite/remain-vote'),
			remainCount = parseInt(remainCountEl.text(), 10) - 1;

		// 投票后，删除投票按钮
		upvoteEl.parent().remove();
		// 投票后，自增票数
		resultVoteCountEl.text(resultVoteCount).attr('data-votes', resultVoteCount);
		voteCountEl.text(data.upvoteCount).attr('data-votes', data.upvoteCount);
		upvoteCountEl.text(data.upvoteCount).attr('data-upvote', data.upvoteCount);
		remainCountEl.text(remainCount).attr('data-votes', remainCount);

		// 当票数大于1，删除编辑和删除按钮
		if (data.upvoteCount > 1) {
			editEl.remove();
			deleteEl.remove();
		}

		// 当发出邀请，更新邀请内容
		if (data.isInvited) {
			var date = new Date(),
				minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes(),
				hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours(),
				invitedTime = date.getFullYear() + '/' + date.getMonth() + '/' + date.getDate() + ' - ' + hours + ':' + minutes;

			courseEl.append($('<li></li>').text(invitedTime + ' 对 ' + data.username + ' 的提名已获得 ' + resultVoteCount + ' 票支持，达到邀请票数，邀请邮件已经发出；'));
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