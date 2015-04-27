var db = require('../database'),
	user = require('../user'),
	invite = require('../invite'),

	Update = {};

Update.get = function (req, res, next) {
	res.render('admin/manage/update');
};

module.exports = Update;