"use strict";
/* globals define, config, socket, app, ajaxify, templates */

define('forum/invite/list', [
	'forum/invite/events',
	'composer',
	'components',
	'navigator',
	'forum/infinitescroll',
	'sort'
], function (events, composer, components, navigator, infinitescroll, sort) {
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

		sort.handleSort('inviteSort', 'invite.setInviteSort', 'invite');

		var threadSort = components.get('thread/sort'),
			currentSetting = threadSort.find('a[data-sort="' + config.inviteSort + '"]');
		threadSort.find('.title').text(currentSetting.text().trim());

		enableInfiniteLoading();
	};

	Invite.onNewInvite = function (vote) {
	};

	function enableInfiniteLoading() {
		infinitescroll.init(Invite.loadMorePosts);
	}

	Invite.scrollToTopic = function(bookmarkIndex, clickedIndex, duration, offset) {
		if (!bookmarkIndex) {
			return;
		}

		if (!offset) {
			offset = 0;
		}

		var scrollTo = components.get('category/topic', 'index', bookmarkIndex);
		var	cid = ajaxify.variables.get('category_id');
		if (scrollTo.length && cid) {
			$('html, body').animate({
				scrollTop: (scrollTo.offset().top - $('#header-menu').height() - offset) + 'px'
			}, duration !== undefined ? duration : 400, function() {
				Category.highlightTopic(clickedIndex);
				navigator.update();
			});
		}
	};

	Invite.onPostsLoaded = function(data, callback) {
		if(!data || !data.invite.length) {
			return;
		}

		function removeAlreadyAddedPosts(invites) {
			return invites.filter(function(invite) {
				return components.get('invite/post', 'tid', invite.tid).length === 0;
			});
		}

		var after = null,
			before = null;

		function findInsertionPoint() {
			var invite = components.get('invite/post');

			if (!invite.length) {
				return;
			}

			var last = invite.last(),
				lastIndex = last.attr('data-index'),
				firstIndex = data.invite[data.invite.length - 1].index;

			if (firstIndex > lastIndex) {
				after = last;
			} else {
				before = invite.first();
			}
		}

		data.invite = removeAlreadyAddedPosts(data.invite);
		if(!data.invite.length) {
			return;
		}

		data.showSelect = data.privileges.editable;

		findInsertionPoint();

		templates.parse('category', 'topics', data, function(html) {
			translator.translate(html, function(translatedHTML) {
				var container = $('[component="category"]'),
					html = $(translatedHTML);

				$('[component="category"]').removeClass('hidden');
				$('.category-sidebar').removeClass('hidden');

				$('#category-no-topics').remove();

				if(config.usePagination) {
					container.empty().append(html);
				} else {
					if(after) {
						html.insertAfter(after);
					} else if(before) {
						html.insertBefore(before);
					} else {
						container.append(html);
					}
				}

				if (typeof callback === 'function') {
					callback();
				}
				html.find('.timeago').timeago();
				app.createUserTooltips();
				utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			});
		});
	};

	Invite.loadMorePosts = function(direction) {
		if (!$('[component="invite"]').children().length) {
			return;
		}

		infinitescroll.calculateAfter(direction, components.get('invite/post'), config.topicsPerPage, false, function(after, offset, el) {
			loadPostsAfter(after, function() {
				if (direction < 0 && el) {
					Invite.scrollToTopic(el.attr('data-index'), null, 0, offset);
				}
			});
		});
	};

	function loadPostsAfter(after, callback) {
		if(!utils.isNumber(after) || (after === 0 && components.get('invite/post', 'index', 0).length)) {
			return;
		}

		$(window).trigger('action:invite.loading');
		infinitescroll.loadMore('invite.loadMore', {
			after: after
		}, function (data, done) {
			if (data.invite && data.invite.length) {
				Invite.onPostsLoaded(data, function() {
					done();
					callback();
				});
				$('[component="invite"]').attr('data-nextstart', data.nextStart);
			} else {
				done();
			}

			$(window).trigger('action:invite.loaded');
		});
	}

	return Invite;
});

