"use strict";

var inviteController = {},
	async = require('async'),
	S = require('string'),
	validator = require('validator'),
	nconf = require('nconf'),
	user = require('../user'),
	meta = require('../meta'),
	posts = require('../posts'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	helpers = require('./helpers'),
	pagination = require('../pagination'),
	utils = require('../../public/src/utils'),
	db = require('../database'),
	schedule = require('../schedule'),
	invite = require('../invite');

inviteController.list = function (req, res, next) {
	var uid = req.user ? req.user.uid : 0,
		status = req.query.status,
		page = req.query.page || 1,
		settings = {};

	async.waterfall([
		function (next) {
			async.parallel({
				inviteCount: function (next) {
					db.getObjectField('global', 'inviteCount', next);
				},
				userSettings: function (next) {
					user.getSettings(uid, next);
				}
			}, next);
		},
		function (results, next) {
			settings = results.userSettings;

			switch (status) {
				case 'voting':
					settings.inviteSort = 'voting';
					break;
				case 'joined':
					settings.inviteSort = 'joined';
					break;
				case 'deleted':
					settings.inviteSort = 'deleted';
					break;
				case 'failed':
					settings.inviteSort = 'failed';
					break;
				case 'invited':
					settings.inviteSort = 'invited';
					break;
			}

			var inviteIndex = utils.isNumber(req.params.invite_index) ? parseInt(req.params.invite_index, 10) - 1 : 0;
			var inviteCount = parseInt(results.inviteCount, 10);

			if (inviteIndex < 0 || inviteIndex > Math.max(inviteCount - 1, 0)) {
				return helpers.redirect(res, '/invite' + (inviteIndex > inviteCount ? '/' + inviteCount : ''));
			}

			if (!settings.usePagination) {
				inviteIndex = Math.max(inviteIndex - (settings.topicsPerPage - 1), 0);
			} else if (!req.query.page) {
				var index = Math.max(parseInt((inviteIndex || 0), 10), 0);
				page = Math.ceil((index + 1) / settings.topicsPerPage);
				inviteIndex = 0;
			}

			// reverse = true 时对应排序为从新到旧
			var setKey = 'invite:posts:iid',
				reverse = true;

			var start = (page - 1) * settings.topicsPerPage + inviteIndex,
				end = -1;
				//end = start + settings.topicsPerPage - 1;

			next(null, {
				setKey: setKey,
				reverse: reverse,
				start: start,
				end: end,
				uid: uid
			});
		},
		function (data, next) {
			data.stop = data.end;
			invite.getInvite(data, next);
		},
		function (data, next) {
			data.invite.map(function (value, index) {
				data.invite[index].joined = parseInt(value.joined, 10);
				data.invite[index].invited = parseInt(value.invited, 10);
				data.invite[index].expired = parseInt(value.expired, 10);
				data.invite[index].deleted = value.status === 'deleted';
			});

			if (settings.inviteSort !== 'newest_to_oldest') {
				data.invite = data.invite.filter(function (item) {
					return item.status === settings.inviteSort;
				});
			}

			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:header.invite]]', url: '/invite'}]);

			next(null, data);
		}
	], function (err, data) {
		if (err) {
			return next(err);
		}

		data.invite.sort(function (a, b) {
			return a.username.toLowerCase().localeCompare(b.username.toLowerCase());
		});

		res.render('invite/list', data);
	});
};

inviteController.details = function (req, res, next) {
	var iid = req.params.invite_id,
		userPrivileges;

	async.waterfall([
		function (next) {
			invite.exists(iid, next);
		},
		function (exits, next) {
			if (!exits) {
				return helpers.notFound(req, res);
			}
			async.parallel({
				privileges: function (next) {
					privileges.invite.get(iid, req.uid, next);
				},
				isUpvote: function (next) {
					db.isSetMember('invite:posts:' + iid + ':upvote:by', req.uid, next);
				},
				isDownvote: function (next) {
					db.isSetMember('invite:posts:' + iid + ':downvote:by', req.uid, next);
				},
				inviteData: function (next) {
					invite.getInviteData(iid, next)
				},
				userCount: function (next) {
					db.getObjectField('global', 'userCount', next);
				}
			}, next)
		},
		function (results, next) {
			userPrivileges = results.privileges;
			var inviteData = results.inviteData;

			if (iid + '/' + req.params.slug !== inviteData.slug) {
				return helpers.notFound(req, res);
			}

			if ((parseInt(inviteData.deleted, 10) && !userPrivileges.view_deleted)) {
				return helpers.notAllowed(req, res);
			}


			user.getUserFields(inviteData.uid, ['uid', 'username', 'userslug', 'picture', 'banned'], function (err, userData) {
				if (err && err.message === '[[error:no-user]]' && !userData) {
					return helpers.notFound(req, res);
				}

				inviteData.user = userData;
				inviteData.user.banned = inviteData.user.banned ? parseInt(userData.banned, 10) === 1 : 0;
				inviteData.user.deleted = inviteData.user.uid === 0 ? 1 : 0;

				inviteData.isSelf = userPrivileges.isSelf;
				inviteData.joined = parseInt(inviteData.joined, 10) === 1;
				inviteData.invited = parseInt(inviteData.invited, 10) === 1;
				inviteData.deleted = parseInt(inviteData.deleted, 10) === 1;
				inviteData.pinned = parseInt(inviteData.pinned, 10) === 1;
				inviteData.locked = parseInt(inviteData.locked, 10) === 1;
				inviteData.yourid = req.uid;
				inviteData.theirid = inviteData.uid;
				inviteData.display_moderator_tools = userPrivileges.editable;
				inviteData.notJoined = !!parseInt(inviteData.expired, 10);
				inviteData.isVote = results.isUpvote || results.isDownvote;
				inviteData.canControl = parseInt(inviteData.inviteCount, 10) <= 1;
				inviteData.hideFooter = (parseInt(inviteData.uid, 10) === parseInt(req.uid, 10) && inviteData.invited) || !userData || inviteData.user.deleted;

				inviteData.upvoteCount = parseInt(inviteData.inviteCount ? inviteData.inviteCount : 0, 10);
				inviteData.downvoteCount = parseInt(inviteData.downvoteCount ? inviteData.downvoteCount : 0, 10);
				inviteData.resultVoteCount = inviteData.upvoteCount - inviteData.downvoteCount;
				inviteData.votePercent = meta.config.votePercent || 50;
				inviteData.userCount = parseInt(results.userCount, 10);
				inviteData.needVote = Math.round(inviteData.userCount * inviteData.votePercent / 100);
				inviteData.remainVote = inviteData.needVote - inviteData.upvoteCount + inviteData.downvoteCount;

				var date, minutes, hours;

				if (inviteData.invited) {
					date = new Date(parseInt(inviteData.invitedTime, 10));
					minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
					hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
					inviteData.invitedTime = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' - ' + hours + ':' + minutes;
				}

				if (inviteData.notJoined) {
					inviteData.expiredText = schedule.expire.text();

					if (inviteData.expiredTime) {
						date = new Date(parseInt(inviteData.expiredTime, 10));
						minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
						hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
						inviteData.expiredTime = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' - ' + hours + ':' + minutes;
					} else {
						inviteData.expiredTime = inviteData.invitedTime;
					}
				}

				date = new Date(parseInt(inviteData.timestamp, 10));
				minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
				hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
				inviteData.createdTime = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' - ' + hours + ':' + minutes;

				inviteData.inviterDeleted = inviteData.status === 'deleted';
				if (inviteData.inviterDeleted) {
					date = new Date(parseInt(inviteData.deletedTime, 10));
					minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
					hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
					inviteData.deletedTime = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' - ' + hours + ':' + minutes;
				}

				inviteData.isOpened = !!(inviteData.track && inviteData.track === 'open');
				inviteData.isDelivered = !!(inviteData.track && inviteData.track === 'delivered');
				if (inviteData.trackTime) {
					date = new Date(parseInt(inviteData.trackTime, 10));
					minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
					hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
					inviteData.trackTime = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' - ' + hours + ':' + minutes;
				}

				next(null, inviteData);
			});
		},
		function (inviteData, next) {
			var breadcrumbs = [
				{
					text: '[[global:header.invite]]',
					url: '/invite'
				},
				{
					text: inviteData.username,
					url: nconf.get('relative_path') + '/invite/' + inviteData.slug
				}
			];
			breadcrumbs = helpers.buildBreadcrumbs(breadcrumbs);
			inviteData.breadcrumbs = breadcrumbs;

			next(null, inviteData);
		}
	], function (err, data) {
		if (err) {
			return next(err);
		}

		data.privileges = userPrivileges;
		data['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10);
		data['downvote:disabled'] = parseInt(meta.config['downvote:disabled'], 10);
		data['feeds:disabledRSS'] = parseInt(meta.config['feeds:disabledRSS'], 10) || 0;
		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.rssFeedUrl = nconf.get('relative_path') + '/topic/' + data.tid + '.rss';

		invite.increaseViewCount(iid);

		plugins.fireHook('filter:parse.post', {
			postData: {
				content: data.content
			}
		}, function (err, contentData) {
			if (err) {
				return next(err);
			}
			data.content = contentData.postData.content;
			res.render('invite/details', data);
		});
	});
};

module.exports = inviteController;
