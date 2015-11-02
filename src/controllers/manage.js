var Manage = {};

Manage.version = function (req, res) {
	res.render('admin/manage/version');
};

module.exports = Manage;
