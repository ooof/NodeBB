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
        page = req.query.page || 1;

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
        uid = req.user ? req.user.uid : 0,
        userPrivileges;

    async.waterfall([
        function (next) {
            async.parallel({
                privileges: function (next) {
                    privileges.votes.get(vid, uid, next);
                },
                vote: function (next) {
                    votes.getVoteFields(vid, ['postcount', 'slug', 'deleted', 'mainPid', 'username'], next)
                }
            }, next)
        },
        function (results, next) {
            userPrivileges = results.privileges;

            var voteData = {};
            voteData.slug = results.vote.slug;
            voteData.username = results.vote.username;

            if (vid + '/' + req.params.slug !== results.vote.slug) {
                return helpers.notFound(req, res);
            }

            if ((parseInt(results.vote.deleted, 10) && !userPrivileges.view_deleted)) {
                return helpers.notAllowed(req, res);
            }

            posts.getPostData(results.vote.mainPid, function (err, postData) {
                if (err && err.message === '[[error:no-post]]' && !postData) {
                    return helpers.notFound(req, res);
                }

                user.getUserData(postData.uid, function (err, userData) {
                    if (err && err.message === '[[error:no-user]]' && !userData) {
                        return helpers.notFound(req, res);
                    }

                    voteData.posts = postData;
                    voteData.posts.deleted = parseInt(postData.deleted, 10) === 1;
                    voteData.posts.pinned = parseInt(postData.pinned, 10) === 1;
                    voteData.posts.locked = parseInt(postData.locked, 10) === 1;
                    voteData.posts.user = userData;
                    voteData.posts.user.banned = parseInt(userData.banned, 10) === 1;
                    voteData.posts.display_moderator_tools = userPrivileges.editable;

                    next(null, voteData);
                });
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

            if (voteData.posts && voteData.posts.content) {
                description = S(voteData.posts.content).stripTags().decodeHTMLEntities().s;
            }

            if (description.length > 255) {
                description = description.substr(0, 255) + '...';
            }

            description = validator.escape(description);
            description = description.replace(/&apos;/g, '&#x27;');

            description = description.replace(/\n/g, ' ');

            res.locals.metaTags = [
                {
                    name: "title",
                    content: voteData.username
                },
                {
                    name: "description",
                    content: description
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
        data['feeds:disabledRSS'] = parseInt(meta.config['feeds:disabledRSS'], 10) || 0;
        data['rssFeedUrl'] = nconf.get('relative_path') + '/votes/' + '' + data.posts.vid + '.rss';

        votes.increaseViewCount(vid);

        res.render('votes/details', data);
    });
};

module.exports = votesController;
