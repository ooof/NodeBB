<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
    <div class="panel-heading">邀请文本</div>
    <div class="panel-body">
        <form>
            <div class="help-block">
                <h4>邀请邮件</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-fromname"><strong>发件人姓名</strong></label>
                <input type="text" class="form-control" id="email-invite-fromname" data-field="email:invite:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-invite-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-invite-subject" data-field="email:invite:subject"/>
            </div>
            <div class="form-group">
                <label for="email-invite-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-invite-html" data-field="email:invite:html" style="min-height:130px;"></textarea>
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
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>reset_link 重置密码链接</li>
                </ol>
            </div>

            <br>
            <div class="help-block">
                <h4>提名失败</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-failed-fromname"><strong>发件人姓名</strong></label>
                <input type="text" class="form-control" id="email-invite-failed-fromname" data-field="email:inviteFailed:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-invite-failed-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-invite-failed-subject" data-field="email:inviteFailed:subject"/>
            </div>
            <div class="form-group">
                <label for="email-invite-failed-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-invite-failed-html" data-field="email:inviteFailed:html" style="min-height:130px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>username 提名人用户名</li>
                    <li>invite_username 被提名人用户名</li>
                    <li>invite_link 提名贴链接</li>
                </ol>
            </div>
        </form>
    </div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
