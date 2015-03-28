"use strict";

var votesController = {},
	async = require('async'),
	S = require('string'),
	validator = require('validator'),
	nconf = require('nconf'),
	qs = require('querystring'),
	user = require('../user'),
	meta = require('../meta'),
	posts = require('../posts'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	helpers = require('./helpers'),
	pagination = require('../pagination'),
	utils = require('../../public/src/utils'),
	db = require('../database'),
	votes = require('../votes');

votesController.list = function (req, res, next) {
	var uid = req.user ? req.user.uid : 0,
		vid = 1,
		page = req.query.page || 1,
		userPrivileges;

	async.waterfall([
		function (next) {
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
				return helpers.redirect(res, '/votes' + (voteIndex > voteCount ? '/' + voteCount : ''));
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
				set: set,
				reverse: reverse,
				start: start,
				end: end,
				uid: uid
			});
		},
		function (data, next) {
			data.stop = data.end;
			votes.list.getVotes(data, next);
		},
		function (data, next) {
			res.locals.metaTags = [
				{
					name: 'title',
					content: '[[global:header.votes]]'
				},
				{
					property: 'og:title',
					content: '[[global:header.votes]]'
				},
				{
					property: "og:type",
					content: 'website'
				}
			];

			res.locals.linkTags = [
				{
					rel: 'alternate',
					type: 'application/rss+xml',
					href: nconf.get('url') + '/votes.rss'
				},
				{
					rel: 'up',
					href: nconf.get('url')
				}
			];

			next(null, data);
		},
		function (data, next) {
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
	var vid = req.params.vote_id,
		page = 1,
		sort = req.query.sort,
		uid = req.user ? req.user.uid : 0,
		userPrivileges;

	if (req.params.post_index && !utils.isNumber(req.param.post_index)) {
		return helpers.notFound(req, res);
	}

	async.waterfall([
		function (next) {
			async.parallel({
				privileges: function (next) {
					privileges.votes.get(vid, uid, next);
				},
				settings: function (next) {
					user.getSettings(uid, next)
				},
				vote: function (next) {
					votes.getVoteFields(vid, ['postcount', 'slug', 'deleted'], next)
				}
			}, next)
		},
		function (results, next) {
			userPrivileges = results.privileges;

			if (userPrivileges.disabled || vid + '/' + req.params.slug !== results.vote.slug) {
				return helpers.notFound(req, res);
			}

			if (!userPrivileges.read || (parseInt(results.vote.deleted, 10) && !userPrivileges.view_deleted)) {
				return helpers.notAllowed(req, res);
			}

			var settings = results.settings;
			var postCount = parseInt(results.vote.postcount, 10);
			var pageCount = Math.max(1, Math.ceil((postCount - 1) / settings.postsPerPage));

			if (utils.isNumber(req.params.post_index) && (req.params.post_index < 1 || req.params.post_index > postCount)) {
				return helpers.redirect(res, '/votes/' + req.params.vote_id + '/' + req.params.slug + (req.params.post_index > postCount ? '/' + postCount : ''));
			}

			if (settings.usePagination && (req.query.page < 1 || req.query.page > pageCount)) {
				return helpers.notFound(req, res);
			}

			var set = 'vid:' + vid + ':posts',
				reverse = false;

			// `sort` qs has priority over user setting
			if (sort === 'oldest_to_newest') {
				reverse = false;
			} else if (sort === 'newest_to_oldest') {
				reverse = true;
			} else if (sort === 'most_votes') {
				reverse = true;
				set = 'vid:' + vid + ':posts:votes';
			} else if (settings.topicPostSort === 'newest_to_oldest') {
				reverse = true;
			} else if (settings.topicPostSort === 'most_votes') {
				reverse = true;
				set = 'vid:' + vid + ':posts:votes';
			}

			var postIndex = 0;
			page = parseInt(req.query.page, 10) || 1;
			req.params.post_index = parseInt(req.param.post_index, 10) || 0;
			if (reverse && req.params.post_index === 1) {
				req.params.post_index = 0;
			}

			if (!settings.usePagination) {
				if (reverse) {
					postIndex = Math.max(0, postCount - (req.params.post_index || postCount) - (settings.postsPerPage - 1));
				} else {
					postIndex = Math.max(0, (req.params.post_index || 1) - (settings.postsPerPage + 1));
				}
			} else if (!req.query.page) {
				var index = 0;
				if (reverse) {
					index = Math.max(0, postCount - (req.params.post_index || postCount));
				} else {
					index = Math.max(0, req.params.post_index - 1) || 0;
				}

				page = Math.max(1, Math.ceil(index / settings.postsPerPage));
			}

			var start = (page - 1) * settings.postsPerPage + postIndex,
				end = start + settings.postsPerPage - 1;

			votes.getVoteWithPosts(vid, set, uid, start, end, reverse, function (err, voteData) {
				if (err && err.message === '[[error:no-vote]]' && !voteData) {
					return helpers.notFound(req, res);
				}

				if (err && !voteData) {
					return next(err)
				}

				voteData.pageCount = pageCount;
				voteData.currentPage = page;

				if (page > 1) {
					voteData.posts.splice(0, 1);
				}

				plugins.fireHook('filter:controllers.vote.get', voteData, next);
			});
		},
		function (voteData, next) {
			var breadcrumbs = [
				{
					text: '[[global:header.votes]]',
					url: '/votes'
				},
				{
					text: voteData.username,
					url: nconf.get('relative_path') + '/votes/' + voteData.slug
				}
			];
			breadcrumbs = helpers.buildBreadcrumbs(breadcrumbs);
			voteData.breadcrumbs = breadcrumbs;
			next(null, voteData);
		},
		function (voteData, next) {
			var description = '';

			if (voteData.posts[0] && voteData.posts[0].content) {
				description = S(voteData.posts[0].content).stripTags().decodeHTMLEntities().s;
			}

			if (description.length > 255) {
				description = description.substr(0, 255) + '...';
			}

			description = validator.escape(description);
			description = description.replace(/&apos;/g, '&#x27;');

			var ogImageUrl = '';
			if (voteData.thumb) {
				ogImageUrl = voteData.thumb;
			} else if (voteData.posts.length && voteData.posts[0] && voteData.posts[0].user && voteData.posts[0].user.picture) {
				ogImageUrl = voteData.posts[0].user.picture;
			} else if (meta.config['brand:logo']) {
				ogImageUrl = meta.config['brand:logo'];
			} else {
				ogImageUrl = '/logo.png';
			}

			if (ogImageUrl.indexOf('http') === -1) {
				ogImageUrl = nconf.get('url') + ogImageUrl;
			}

			description = description.replace(/\n/g, ' ');

			res.locals.metaTags = [
				{
					name: "title",
					content: voteData.username
				},
				{
					name: "description",
					content: description
				},
				{
					property: 'og:title',
					content: voteData.username.replace(/&amp;/g, '&')
				},
				{
					property: 'og:description',
					content: description
				},
				{
					property: "og:type",
					content: 'article'
				},
				{
					property: "og:url",
					content: nconf.get('url') + '/votes/' + voteData.slug
				},
				{
					property: 'og:image',
					content: ogImageUrl
				},
				{
					property: "og:image:url",
					content: ogImageUrl
				},
				{
					property: "article:published_time",
					content: utils.toISOString(voteData.timestamp)
				},
				{
					property: 'article:modified_time',
					content: utils.toISOString(voteData.lastposttime)
				}
			];

			res.locals.linkTags = [
				{
					rel: 'alternate',
					type: 'application/rss+xml',
					href: nconf.get('url') + '/votes/' + vid + '.rss'
				},
				{
					rel: 'canonical',
					href: nconf.get('url') + '/votes/' + voteData.slug
				}
			];

			next(null, voteData);
		}
	], function (err, data) {
		if (err) {
			return next(err);
		}

		data.privileges = userPrivileges;
		data['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10);
		data['downvote:disabled'] = parseInt(meta.config['downvote:disabled'], 10);
		data['feeds:disabledRSS'] = parseInt(meta.config['feeds:disabledRSS'], 10);
		data['rssFeedUrl'] = nconf.get('relative_path') + '/votes/' + '' + data.vid + '.rss';

		data.pagination = pagination.create(data.currentPage, data.pageCount);
		data.pagination.rel.forEach(function (rel) {
			res.locals.linkTags.push(rel);
		});

		votes.increaseViewCount(vid);

		res.render('votes/details', data);
	});
};

module.exports = votesController;
