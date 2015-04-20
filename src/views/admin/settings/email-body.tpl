<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
    <div class="panel-heading">邀请文本</div>
    <div class="panel-body">
        <form>
            <div class="help-block">
                <h4>邀请邮件</h4>
            </div>
            <div class="form-group">
                <label for="email-fromname"><strong>发件人姓名</strong></label>
                <input type="text" class="form-control" id="email-fromname" data-field="email:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-subject" data-field="email:subject"/>
            </div>
            <div class="form-group">
                <label for="email-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-html" data-field="email:html" style="min-height:130px;"></textarea>
                <br>
            </div>
            <div class="help-block">
                <p>参数都需要使用大括号包裹，所有输入框都支持变量嵌套。</p>
                <ol style="padding-left: 1.5em;">
                    <li>username 被邀请人用户名</li>
                    <li>register_link 注册链接</li>
                    <li>from_username 提名人用户名</li>
                    <li>from_invite_username 提名人被提名的用户名</li>
                </ol>
            </div>

            <br>
            <br>
            <div class="help-block">
                <h4>重置密码</h4>
            </div>
            <div class="form-group">
                <label for="email-reset-fromname"><strong>发件人姓名</strong></label>
                <input type="text" class="form-control" id="email-reset-fromname" data-field="email:reset:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-reset-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-reset-subject" data-field="email:reset:subject"/>
            </div>
            <div class="form-group">
                <label for="email-reset-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-reset-html" data-field="email:reset:html" style="min-height:130px;"></textarea>
                <br>
            </div>
            <div class="help-block">
                <p>参数都需要使用大括号包裹，所有输入框都支持变量嵌套。</p>
                <ol style="padding-left: 1.5em;">
                    <li>reset_link 重置密码链接</li>
                </ol>
            </div>
        </form>
    </div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
