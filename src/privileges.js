"use strict";

var privileges = {};

require('./privileges/categories')(privileges);
require('./privileges/topics')(privileges);
require('./privileges/votes')(privileges);
require('./privileges/posts')(privileges);

module.exports = privileges;