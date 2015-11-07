"use strict";

define('forum/invite/details', ['composer',
	'components',
	'navigator',
	'translator',
	'forum/invite/events'
], function (composer, components, navigator, translator, events) {
	var InviteDetails = {},
		inviteName;

	$(window).on('action:ajaxify.start', function (ev, data) {
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

		inviteName = ajaxify.variables.get('invite_name');

		addInviteHandlers(iid);
		addSymbol();

		$('.invite-time').map(processTime);

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

	function processTime(i, el) {
		var $el = $(el);
		var timestamp = parseInt($el.attr('title'), 10);
		timestamp = parseTimestamp(timestamp);
		$el.text(timestamp);
	}

	function parseTimestamp(timestamp) {
		var date = new Date(timestamp);
		var minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
		var hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
		return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' - ' + hours + ':' + minutes;
	}

	function getData(button, data) {
		return button.parents('[data-iid]').attr(data);
	}

	function getUserName(button) {
		var username = '',
			post = button.parents('[data-uid]');

		if (post.length) {
			username = post.attr('data-username').replace(/\s/g, '-');
		}
		if (post.length && post.attr('data-iid') !== '0') {
			username = '@' + username;
		}

		return username;
	}

	function addInviteHandlers(iid) {
		var inviteContainer = components.get('invite').children('.post-row');

		inviteContainer.on('click', '[component="invite/reply"]', function () {
			onReplyClicked($(this), iid);
		});

		inviteContainer.on('click', '[component="invite/upvote"]', function () {
			return toggleVote($(this), 'invite.upvote');
		});

		inviteContainer.on('click', '[component="invite/downvote"]', function () {
			return toggleVote($(this), 'invite.downvote');
		});

		inviteContainer.on('click', '[component="invite/edit"]', function () {
			composer.editInvite(iid);
		});

		inviteContainer.on('click', '[component="invite/delete"]', function () {
			deleteInvite(iid);
		});

		inviteContainer.on('click', '[component="invite/chat"]', function () {
			app.openChat(inviteContainer.attr('data-username'), inviteContainer.attr('data-uid'));
		});
	}

	function onReplyClicked(button, iid) {
		require(['composer'], function (composer) {
			var selectionText = '',
				selection = window.getSelection ? window.getSelection() : document.selection.createRange(),
				inviteUUID = composer.findByTid(iid);

			if ($(selection.baseNode).parents('[component="invite/content"]').length > 0 || $(selection.baseNode).parents('[component="invite/course"]').length > 0) {
				var snippet = selection.toString();
				if (snippet.length) {
					selectionText = '> ' + snippet.replace(/\n/g, '\n> ') + '\n\n';
				}
			}

			var username = getUserName(selectionText ? $(selection.baseNode) : button);
			if (getData(button, 'data-iid') === '0') {
				username = '';
			}
			if (selectionText.length) {
				composer.addQuoteInvite(iid, ajaxify.variables.get('invite_slug'), getData(button, 'data-index'), getData(button, 'data-iid'), inviteName, username, selectionText, inviteUUID);
			} else {
				composer.newReplyInvite(iid, getData(button, 'data-iid'), inviteName, username ? username + ' ' : '');
			}
		});
	}

	function toggleVote(button, method) {
		var invite = button.parents('[data-iid]'),
			vote = button.parent();

		// 删除投票按钮
		vote.remove();

		socket.emit(method, {
			iid: invite.attr('data-iid'),
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
