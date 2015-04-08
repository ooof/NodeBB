"use strict";

var votePercentEl = $('#vote-percent'),
	previewEl,
	isInsert = false;

votePercentEl.change(function () {
	updatePreview($(this).val() + '%');
});

function updatePreview(text) {
	if (!isInsert) {
		isInsert = true;
		previewEl = $('</p>').css('text-align', 'center').text(text).insertAfter(votePercentEl);
	} else {
		previewEl.text(text);
	}
}
