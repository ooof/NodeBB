<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
    <div class="panel-heading">通知文本内容设置</div>
    <div class="panel-body">
        <form>
            <div class="help-block">
                <h4>1. 投票通知</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-html"><strong>内容</strong></label>
                <textarea class="form-control" id="email-invite-html" data-field="notification:invite:upvote" style="min-height:75px;"></textarea>
            </div>
            <div class="help-block">
                <p>通知全站用户参与提名</p>
                <ol style="padding-left: 1.5em;">
                    <li>username 被提名人用户名</li>
                    <li>invitedByUsername 提名人用户名</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>2. 提名成功</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-invited-html"><strong>内容</strong></label>
                <textarea class="form-control" id="email-invite-invited-html" data-field="notification:invite:invited" style="min-height:75px;"></textarea>
            </div>
            <div class="help-block">
                <p>通知所有投票用户提名已通过并已发出邀请</p>
                <ol style="padding-left: 1.5em;">
                    <li>username 被提名人用户名</li>
                    <li>invitedByUsername 提名人用户名</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>3. 已加入</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-joined-html"><strong>内容</strong></label>
                <textarea class="form-control" id="email-invite-joined-html" data-field="notification:invite:joined" style="min-height:75px;"></textarea>
            </div>
            <div class="help-block">
                <p>通知所有投票用户提名已通过并已发出邀请</p>
                <ol style="padding-left: 1.5em;">
                    <li>username 被提名人用户名</li>
                    <li>invitedByUsername 提名人用户名</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>4. 即将过期提醒</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-warn-html"><strong>内容</strong></label>
                <textarea class="form-control" id="email-invite-warn-html" data-field="notification:invite:warn" style="min-height:75px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>time 提醒时间</li>
                    <li>username 被提名人用户名</li>
                    <li>upvoteByUsername 投票人用户名</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>5. 已过期提醒</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-failed-html"><strong>内容</strong></label>
                <textarea class="form-control" id="email-invite-failed-html" data-field="notification:invite:expire" style="min-height:75px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>time 过期时间</li>
                    <li>username 被提名人用户名</li>
                    <li>upvoteByUsername 投票人用户名</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>6. 用户退出后通知提名人</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-exit-html"><strong>内容</strong></label>
                <textarea class="form-control" id="email-invite-exit-html" data-field="notification:invite:exit" style="min-height:75px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>username 被提名人用户名</li>
                </ol>
            </div>
            <br>

            <div class="help-block">
                <h4>7. 用户退出后通知投票人</h4>
            </div>
            <div class="form-group">
                <label for="email-invite-exit-2-html"><strong>内容</strong></label>
                <textarea class="form-control" id="email-invite-exit-2-html" data-field="notification:invite:exit:2" style="min-height:75px;"></textarea>
            </div>
            <div class="help-block">
                <ol style="padding-left: 1.5em;">
                    <li>username 被提名人用户名</li>
                </ol>
            </div>
            <br>
        </form>
    </div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
