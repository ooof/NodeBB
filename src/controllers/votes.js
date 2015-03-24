"use strict";

var votesController = {},
	nconf = require('nconf'),
	async = require('async'),
	validator = require('validator'),

	db = require('../database'),
	privileges = require('../privileges'),
	user = require('../user'),
	votes = require('../votes'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	pagination = require('../pagination'),
	helpers = require('./helpers'),
	utils = require('../../public/src/utils');

votesController.list = function (req, res, next) {
	var uid = req.user ? req.user.uid : 0,
		vid = 1,
		page = req.query.page || 1,
		userPrivileges;

	async.waterfall([
		function(next) {
			async.parallel({
				voteCount: function (next) {
					db.getObjectField('global', 'voteCount', next);
				},
				userSettings: function (next) {
					user.getSettings(uid, next);
				}
			}, next);
		},
		function (results, next) {
			var voteIndex = utils.isNumber(req.params.vote_index) ? parseInt(req.params.vote_index, 10) - 1 : 0;
			var voteCount = parseInt(results.voteCount, 10);

			if (voteIndex < 0 || voteIndex > Math.max(voteCount - 1, 0)) {
				return helpers.redirect(res, '/vote' + (voteIndex > voteCount ? '/' + voteCount : ''));
			}

			var settings = results.userSettings;

			if (!settings.usePagination) {
				voteIndex = Math.max(voteIndex - (settings.topicsPerPage - 1), 0);
			} else if (!req.query.page) {
				var index = Math.max(parseInt((voteIndex || 0), 10), 0);
				page = Math.ceil((index + 1) / settings.topicsPerPage);
				voteIndex = 0;
			}

			var set = 'vote_list:vids',
				reverse = false;

			if (settings.categoryTopicSort === 'newest_to_oldest') {
				reverse = true;
			} else if (settings.categoryTopicSort === 'most_posts') {
				reverse = true;
				set = 'vote_list:vids:posts';
			}

			var start = (page - 1) * settings.topicsPerPage + voteIndex,
				end = start + settings.topicsPerPage - 1;

			next(null, {
				vid: 1,
				set: set,
				reverse: reverse,
				start: start,
				end: end,
				uid: uid
			});
		},
		function (setting, next) {
			var data = {};
			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:header.votes]]', url: '/votes'}]);
			next(null, data)
		}
	], function (err, data) {
		if (err) {
			return next(err);
		}

		res.render('votes/list', data);
	});
};

votesController.details = function (req, res, next) {
	res.render('votes/details');
};

module.exports = votesController;
