"use strict";

var welcomeController = {},
	async = require('async'),
	validator = require('validator'),
	meta = require('../meta');

welcomeController.home = function (req, res) {
	async.parallel({
		header: function (next) {
			res.locals.metaTags = [{
				name: "title",
				content: validator.escape(meta.config.title || 'NodeBB')
			}, {
				name: "description",
				content: validator.escape(meta.config.description || '')
			}, {
				property: 'og:title',
				content: 'Index | ' + validator.escape(meta.config.title || 'NodeBB')
			}, {
				property: 'og:type',
				content: 'website'
			}];

			if (meta.config['brand:logo']) {
				res.locals.metaTags.push({
					property: 'og:image',
					content: meta.config['brand:logo']
				});
			}

			next(null);
		}
	}, function (err, data) {
		if (err) {
			return next(err);
		}

		res.render('welcome/home', data);
	});
};

module.exports = welcomeController;
