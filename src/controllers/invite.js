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
	invite = require('../invite');

inviteController.list = function (req, res, next) {
	var uid = req.user ? req.user.uid : 0,
		page = req.query.page || 1;

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
			var inviteIndex = utils.isNumber(req.params.invite_index) ? parseInt(req.params.invite_index, 10) - 1 : 0;
			var inviteCount = parseInt(results.inviteCount, 10);

			if (inviteIndex < 0 || inviteIndex > Math.max(inviteCount - 1, 0)) {
				return helpers.redirect(res, '/invite' + (inviteIndex > inviteCount ? '/' + inviteCount : ''));
			}

			var settings = results.userSettings;

			if (!settings.usePagination) {
				inviteIndex = Math.max(inviteIndex - (settings.topicsPerPage - 1), 0);
			} else if (!req.query.page) {
				var index = Math.max(parseInt((inviteIndex || 0), 10), 0);
				page = Math.ceil((index + 1) / settings.topicsPerPage);
				inviteIndex = 0;
			}

			var set = 'invite:iid',
				reverse = false;

			var start = (page - 1) * settings.topicsPerPage + inviteIndex,
				end = start + settings.topicsPerPage - 1;

			next(null, {
				set: set,
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
			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:header.invite]]', url: '/invite'}]);

			next(null, data);
		}
	], function (err, data) {
		if (err) {
			return next(err);
		}

		res.render('invite/list', data);
	});
};

inviteController.details = function (req, res, next) {
	var iid = req.params.invite_id,
		uid = req.user ? req.user.uid : 0,
		userPrivileges;

	async.waterfall([
		function (next) {
			async.parallel({
				privileges: function (next) {
					privileges.invite.get(iid, uid, next);
				},
				inviteData: function (next) {
					invite.getInviteData(iid, next)
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


			user.getUserData(inviteData.uid, function (err, userData) {
				if (err && err.message === '[[error:no-user]]' && !userData) {
					return helpers.notFound(req, res);
				}

				inviteData.deleted = parseInt(inviteData.deleted, 10) === 1;
				inviteData.pinned = parseInt(inviteData.pinned, 10) === 1;
				inviteData.locked = parseInt(inviteData.locked, 10) === 1;
				inviteData.user = userData;
				inviteData.user.banned = parseInt(userData.banned, 10) === 1;
				inviteData.display_moderator_tools = userPrivileges.editable;

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
		data['rssFeedUrl'] = nconf.get('relative_path') + '/invite/' + '' + data.iid + '.rss';

		invite.increaseViewCount(iid);

		res.render('invite/details', data);
	});
};

module.exports = inviteController;