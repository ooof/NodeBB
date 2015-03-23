"use strict";

var votesController = {},
	nconf = require('nconf'),
	helpers = require('./helpers'),
	async = require('async');

votesController.list = function (req, res, next) {
	var uid = req.user ? req.user.uid : 0;

	async.waterfall([
		function (next) {
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
