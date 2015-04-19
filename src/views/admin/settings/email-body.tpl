<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
    <div class="panel-heading">邀请邮件</div>
    <div class="panel-body">
        <form>
            <div class="form-group">
                <label for="email-body"><strong>主体内容</strong></label>
                <textarea class="form-control" id="email-body" data-field="email:body">您的朋友邀请您进入一个有趣的社区！</textarea>
            </div>
            <div class="form-group">
                <label for="email-click"><strong>点击内容</strong></label>
                <input type="text" class="form-control" id="email-click" value="点击进入！" data-field="email:click"/><br />
            </div>
            <div class="form-group">
                <label for="email-end"><strong>落款</strong></label>
                <input type="text" class="form-control" id="email-end" value="谢谢！" data-field="email:end"/><br />
            </div>
        </form>
    </div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
