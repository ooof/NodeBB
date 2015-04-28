<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
    <div class="panel-heading">提名设置</div>
    <div class="panel-body">
        <form>
            <div class="checkbox">
                <label>
                    <input type="checkbox" checked data-field="invite:inviteSmart"> <strong>开启智能提名</strong>
                </label>
            </div><br />

            <div class="form-group">
                <label for="vote-percent"><strong>提名比例</strong></label>
                <input type="range" id="vote-percent" min="0" max="100" value="50" data-field="votePercent"/>
                <p class="help-block">小技巧：当管理员想直接邀请一个人的时候，可以设置数量为0%</p><br />
            </div>

            <div class="form-group">
                <p class="help-block">提醒时间</p>
                <label for="invite-warn-time"><strong>天数-数字</strong></label>
                <input type="number" class="form-control" id="invite-warn-time" value="5" data-field="invite:warnTime"/>
                <p class="help-block">支持小数，单位为天</p><br />
                <label for="invite-warn-text"><strong>天数对应文字</strong></label>
                <input type="text" class="form-control" id="invite-warn-text" value="五天" data-field="invite:warnText"/><br />
            </div>

            <div class="form-group">
                <p class="help-block">过期时间</p>
                <label for="invite-expire-time"><strong>天数-数字</strong></label>
                <input type="number" class="form-control" id="invite-expire-time" value="7" data-field="invite:expireTime"/><br />
                <label for="invite-expire-text"><strong>天数对应文字</strong></label>
                <input type="text" class="form-control" id="invite-expire-text" value="七天" data-field="invite:expireText"/><br />
            </div>
        </form>
    </div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
