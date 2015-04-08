<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
    <div class="panel-heading">题名设置</div>
    <div class="panel-body">
        <form>
            <div class="form-group">
                <label for="vote-percent"><strong>提名比例</strong></label>
                <p class="help-block">小技巧：当管理员想直接邀请一个人的时候，可以设置数量为0%</p>
                <input type="range" id="vote-percent" min="0" max="100" value="50" data-field="votePercent"/><br />
            </div>
        </form>
    </div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
