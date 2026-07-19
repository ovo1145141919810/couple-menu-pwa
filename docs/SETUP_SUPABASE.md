# 正式版上线指南：Supabase + GitHub Pages

代码已经包含正式模式、数据库迁移、双账号权限、私有照片、实时同步、后台消息推送和自动部署。下面是仍需项目维护者在外部平台完成的一次性配置。女朋友不需要 GitHub、Supabase 或编程软件，只需要最终网址与她的应用账号。

> 不要把真实邮箱、密码、Auth UUID、Secret Key、数据库密码或真实照片发到聊天、写入仓库或放进 README。

## 1. 准备平台账号

- 一个 GitHub 账号：托管脱敏公开仓库和 GitHub Pages。
- 一个 Supabase 账号：托管真实账号、数据库、照片和 Realtime。
- 两个只用于本应用的登录邮箱，以及两组不同的强密码。

Supabase 客户端使用 `sb_publishable_...` Publishable Key。它可以出现在浏览器构建中；`sb_secret_...`、旧版 `service_role`、数据库密码绝不能进入前端。

## 2. 创建 Supabase 项目

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard) 并创建项目。
2. 区域选择靠近你们常住地的位置。
3. 使用密码管理器保存数据库密码，不要把它写进项目。
4. 等待项目初始化完成。

## 3. 应用全部数据库迁移

推荐使用 Supabase CLI：

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

如果暂时不使用 CLI，也可以在 Dashboard → SQL Editor 中，严格按文件名顺序执行 `supabase/migrations/` 中的 SQL：

1. `202607190001_initial_schema.sql`
2. `202607190002_public_seed.sql`
3. `202607190003_interaction_icons.sql`
4. `202607190004_production_hardening.sql`
5. `202607190005_interaction_responses.sql`
6. `202607190006_decline_message_replies.sql`
7. `202607190007_web_push_subscriptions.sql`

迁移会创建八张受 RLS 保护的表、原子状态函数、Realtime 发布配置，以及私有的 `dish-images`、`interaction-icons` Bucket。

执行后可在 SQL Editor 运行以下只读检查：

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'categories', 'dishes', 'interaction_options', 'wishlists', 'wishlist_items', 'reviews', 'push_subscriptions')
order by tablename;

select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```

第一条查询的八行 `rowsecurity` 都必须是 `true`；第二条应包含菜单、心愿与评价相关表。

## 4. 创建仅有的两个应用账号

1. Dashboard → Authentication → Users → Add user。
2. 分别创建女朋友和男朋友账号，使用不同密码，并标记邮箱已确认。
3. 复制两个用户的 UUID，**只在 Dashboard 私下使用**。
4. 在 SQL Editor 执行下面的模板，执行后不要保存带真实值的副本：

```sql
begin;

insert into public.profiles (id, role, display_name) values
  ('GIRLFRIEND_AUTH_UUID', 'girlfriend', '女朋友在应用中的昵称'),
  ('BOYFRIEND_AUTH_UUID', 'boyfriend', '男朋友在应用中的昵称');

commit;
```

验证结果：

```sql
select role, display_name from public.profiles order by role;
```

`role` 有唯一约束，因此数据库最多只能存在一个 `girlfriend` 和一个 `boyfriend`。

## 5. 锁定 Auth 配置

在 Authentication 配置中完成：

- Email Provider 保持启用。
- 关闭 **Allow new users to sign up**。
- 关闭匿名登录。
- 不提供注册页面，也不要启用第三方公开登录。
- 两个账号使用不同的强密码，建议至少 16 位并保存在密码管理器中。

在 Authentication → URL Configuration 中：

- 本地调试 Site URL 可先使用 `http://localhost:5173`。
- 上线后改成 `https://ovo1145141919810.github.io/couple-menu-pwa/`。
- 将同一 GitHub Pages 地址加入允许的 Redirect URLs。

关闭公开注册后，只有 Dashboard 中已经存在的两个账号可以登录。Supabase 官方配置说明见 [General configuration](https://supabase.com/docs/guides/auth/general-configuration)。

## 6. 本地连接正式模式

从 Dashboard 的 Connect 或 Settings → API Keys 中复制：

- Project URL
- Publishable Key（`sb_publishable_...`）

复制 `.env.example` 为 `.env.local`：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_VALUE
VITE_VAPID_PUBLIC_KEY=YOUR_PUBLIC_VAPID_KEY
```

运行：

```bash
npm install
npm run dev
```

打开首页 → 情侣登录，分别验证两个账号。`.env.local` 已被 Git 忽略。

## 7. 两台手机正式验收

建议先用两个独立浏览器会话模拟两台手机，再在真实手机验收：

1. 女朋友登录，提交“菜品 + 抱抱”的混合心愿单。
2. 男朋友端应在应用打开时实时出现红点；分别接菜、上菜并接受互动。
3. 女朋友端应实时看到状态变化，并能在上菜后提交 1–5 星评价。
4. 男朋友创建分类、菜品和可选照片；女朋友端应实时看到。
5. 双方各创建一个带图片图标的互动，验证另一方可以查看和回应。
6. 女朋友不能管理菜单；男朋友不能创建菜品订单。
7. 退出登录后，真实业务请求应无法读取数据。
8. 将应用切到后台再回来，数据应自动刷新；购物车在短暂断网时仍保留。
9. 两台手机分别从桌面 PWA 打开“消息提醒”，点击开启；关闭应用后互发一次互动，验证系统通知。

Supabase Postgres Changes 会遵守表上的 RLS，适合本项目只有两位用户的低频实时同步。私有照片通过 Storage RLS 与短时 Signed URL 访问。

## 8. 发布到 GitHub Pages

在 GitHub 仓库 Settings → Secrets and variables → Actions → **Variables** 创建：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`（公开密钥，不是 Secret）

不要创建 `VITE_SUPABASE_SECRET_KEY` 或 Service Role 变量。然后：

1. Settings → Pages → Source 选择 **GitHub Actions**。
2. 推送 `main`。
3. 等待 `CI` 和 `Deploy GitHub Pages` 两个工作流通过。
4. 打开 Pages 地址，先验证脱敏 Demo，再验证情侣登录。

工作流会自动执行隐私扫描、生产配置检查、测试和构建。Publishable Key 本来就是浏览器客户端使用的低权限密钥；真实安全边界是登录会话、最小数据库权限与 RLS。参见 [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)。

后台推送还需要部署 `supabase/functions/send-notification`，并在 Supabase Edge Function Secrets 中保存 `WEB_PUSH_PUBLIC_KEY`、`WEB_PUSH_PRIVATE_KEY` 与 `VAPID_SUBJECT`。私有 VAPID Key 绝不能进入 GitHub；iPhone/iPad 必须先添加到主屏幕，再由用户点击按钮请求通知权限。

## 9. 日常维护与故障恢复

- 免费项目暂停：在 Supabase Dashboard 点击 Resume project，应用中的本地购物车不会因此丢失。
- 上传失败：确认七个迁移都已执行，并检查两个 Storage Bucket 与策略。
- 收不到后台推送：确认已从主屏幕 PWA 打开并允许通知；检查 Edge Function 与三项 VAPID Secrets。
- 没有实时变化：确认 `supabase_realtime` publication 包含六张变化表，重新打开应用会主动刷新。
- 登录后提示没有角色：Auth 用户 UUID 尚未正确写入 `profiles`。
- 每次推送前运行：

```bash
npm run check:privacy
npm run check:production
npm run lint
npm run test:run
npm run build
```

定期从 Dashboard 导出数据库备份并下载重要照片。仓库迁移只能重建结构，不能恢复真实回忆。
