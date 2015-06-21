<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
    <div class="panel-heading">邮件文本内容设置</div>
    <div class="panel-body">
        <form>
            <div class="help-block">
                <h4>通知全站投票</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-upvote-fromname"><strong>收件人姓名</strong></label>
                <input type="text" class="form-control" id="email-invite-upvote-fromname" data-field="email:invite:upvote:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-invite-upvote-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-invite-upvote-subject" data-field="email:invite:upvote:subject"/>
            </div>
            <div class="form-group">
                <label for="email-invite-upvote-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-invite-upvote-html" data-field="email:invite:upvote:html" style="min-height:130px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>emailUsername 收件人用户名</li>
                    <li>username 被提名人用户名</li>
                    <li>invitedByUsername 提名人用户名</li>
                    <li>link 提名帖链接</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>发送提名邮件</h4>
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
                    <li>向被提名人发出邀请邮件</li>
                    <li>username 被邀请人用户名</li>
                    <li>register_link 注册链接</li>
                    <li>from_username 提名人用户名</li>
                    <li>from_invite_username 提名人被提名的用户名</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>告知提名人提名成功</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-success-fromname"><strong>发件人姓名</strong></label>
                <input type="text" class="form-control" id="email-invite-success-fromname" data-field="email:invite:success:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-invite-success-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-invite-success-subject" data-field="email:invite:success:subject"/>
            </div>
            <div class="form-group">
                <label for="email-invite-success-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-invite-success-html" data-field="email:invite:success:html" style="min-height:130px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>发送邮件告知提名人票数达到，并已发送邀请成功</li>
                    <li>username 提名人用户名</li>
                    <li>invite_username 被提名的用户名</li>
                    <li>count 投票数量</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>告知提名人被提名人成功加入</h4>
            </div>
            <div class="form-group">
                <label for="email-invited-success-fromname"><strong>发件人姓名</strong></label>
                <input type="text" class="form-control" id="email-invited-success-fromname" data-field="email:invited:success:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-invited-success-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-invited-success-subject" data-field="email:invited:success:subject"/>
            </div>
            <div class="form-group">
                <label for="email-invited-success-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-invited-success-html" data-field="email:invited:success:html" style="min-height:130px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>发送邮件告知提名人票数达到，并已发送邀请成功</li>
                    <li>username 提名人用户名</li>
                    <li>invite_username 被提名的用户名</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>提名过期提醒</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-warn-fromname"><strong>发件人姓名</strong></label>
                <input type="text" class="form-control" id="email-invite-warn-fromname" data-field="email:inviteWarn:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-invite-warn-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-invite-warn-subject" data-field="email:inviteWarn:subject"/>
            </div>
            <div class="form-group">
                <label for="email-invite-warn-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-invite-warn-html" data-field="email:inviteWarn:html" style="min-height:130px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>发邮件告知提名人，提名即将过期</li>
                    <li>username 投票人用户名</li>
                    <li>invite_username 被提名的用户名</li>
                    <li>invite_link 提名贴链接</li>
                    <li>warn_time 提醒时间</li>
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
                    <li>发邮件告知提名人，提名已过期</li>
                    <li>username 投票人用户名</li>
                    <li>invite_username 被提名的用户名</li>
                    <li>invite_link 提名贴链接</li>
                    <li>expire_time 过期时间</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>用户退出</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-exit-fromname"><strong>发件人姓名</strong></label>
                <input type="text" class="form-control" id="email-invite-exit-fromname" data-field="email:inviteExit:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-invite-exit-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-invite-exit-subject" data-field="email:inviteExit:subject"/>
            </div>
            <div class="form-group">
                <label for="email-invite-exit-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-invite-exit-html" data-field="email:inviteExit:html" style="min-height:130px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>发送邮件告知提名人邀请过期，并可再次提名</li>
                    <li>username 提名人用户名</li>
                    <li>invite_username 被提名的用户名</li>
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
                <h4>重置成功</h4>
            </div>
            <div class="form-group">
                <label for="email-reset-success-fromname"><strong>收件人姓名</strong></label>
                <input type="text" class="form-control" id="email-reset-success-fromname" data-field="email:reset:success:fromname"/>
            </div>
            <div class="form-group">
                <label for="email-reset-success-subject"><strong>邮件标题</strong></label>
                <input type="text" class="form-control" id="email-reset-success-subject" data-field="email:reset:success:subject"/>
            </div>
            <div class="form-group">
                <label for="email-reset-success-html"><strong>邮件内容</strong></label>
                <textarea class="form-control" id="email-reset-success-html" data-field="email:reset:success:html" style="min-height:130px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>date 重置密码成功日期</li>
                </ol>
            </div>
            <br>
        </form>
    </div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
