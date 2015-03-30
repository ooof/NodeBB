'use strict';

var async = require('async'),
    db = require('../database'),
    votes = require('../votes'),
    user = require('../user'),
    helpers = require('./helpers'),
    groups = require('../groups'),
    categories = require('../categories'),
    plugins = require('../plugins');

module.exports = function (privileges) {
    privileges.votes = {};

    privileges.votes.get = function (vid, uid, callback) {
        async.waterfall([
            async.apply(votes.getVoteFields, vid, ['uid', 'joined', 'invited']),
            function (vote, next) {
                async.parallel({
                    manage_vote: async.apply(helpers.hasEnoughReputationFor, 'privileges:manage_vote', uid),
                    isAdministrator: async.apply(user.isAdministrator, uid),
                    vote: function (next) {
                        next(null, vote)
                    }
                }, next);
            }
        ], function (err, results) {
            if (err) {
                return callback(err);
            }

            var vote = results.vote,
                isOwner = parseInt(uid, 10) === parseInt(vote.uid, 10),
                isAdmin = results.isAdministrator,
                editable = isAdmin || results.manage_vote,
                deletable = isAdmin || isOwner,

                data = {
                    invited: !!parseInt(vote.joined, 10),
                    joined: !!parseInt(vote.joined, 10),
                    editable: editable,
                    deletable: deletable,
                    view_deleted: isAdmin || results.manage_vote || results.isOwner,
                    vid: vid,
                    uid: uid
                };

            callback(null, data);
        });
    };

    privileges.votes.filter = function (privilege, tids, uid, callback) {
        if (!Array.isArray(tids) || !tids.length) {
            return callback(null, []);
        }

        votes.getVotesFields(tids, ['tid', 'cid'], function (err, votes) {
            if (err) {
                return callback(err);
            }

            var cids = votes.map(function (vote) {
                return vote.cid;
            });

            privileges.categories.filterCids(privilege, cids, uid, function (err, cids) {
                if (err) {
                    return callback(err);
                }

                tids = votes.filter(function (vote) {
                    return cids.indexOf(vote.cid) !== -1;
                }).map(function (vote) {
                    return vote.tid;
                });

                plugins.fireHook('filter:privileges.votes.filter', {
                    privilege: privilege,
                    uid: uid,
                    tids: tids
                }, function (err, data) {
                    callback(err, data ? data.tids : null);
                });
            });
        });
    };

    privileges.votes.canEdit = function (tid, uid, callback) {
        helpers.some([
            function (next) {
                votes.isOwner(tid, uid, next);
            },
            function (next) {
                helpers.hasEnoughReputationFor('privileges:manage_vote', uid, next);
            },
            function (next) {
                isAdminOrMod(tid, uid, next);
            }
        ], callback);
    };

    privileges.votes.canMove = function (tid, uid, callback) {
        isAdminOrMod(tid, uid, callback);
    };

    function isAdminOrMod(tid, uid, callback) {
        helpers.some([
            function (next) {
                votes.getVoteField(tid, 'cid', function (err, cid) {
                    if (err) {
                        return next(err);
                    }
                    user.isModerator(uid, cid, next);
                });
            },
            function (next) {
                user.isAdministrator(uid, next);
            }
        ], callback);
    }
};
