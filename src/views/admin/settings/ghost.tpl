<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
    <div class="panel-heading">前世幽灵</div>
    <div class="panel-body">
        <form>
            <div class="checkbox">
                <label>
                    <input type="checkbox" checked data-field="allowGhost"> <strong>开启前世幽灵</strong>
                </label>
            </div>
            <div class="form-group">
                <label for="ghost-time"><strong>默认间隔时间</strong></label>
                <input type="number" class="form-control" id="ghost-time" value="24" data-field="ghost:time"/>
                <p class="help-block">
                    请输入数字，默认24，即24小时
                </p>
                <br>
            </div>
            <div class="form-group">
                <label for="ghost-start-day"><strong>之前天数</strong></label>
                <input type="number" class="form-control" id="ghost-start-day" value="3" data-field="ghost:day"/>
                <p class="help-block">
                    小提示：设置0为当前时间的最近24个小时
                </p>
            </div>
        </form>
    </div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
