# Native Transfer

一个用于个人或小范围团队的图片传输站。

它提供一个带密码保护的 Web 界面，支持上传原图、查看历史图片、复制链接、下载原图和删除文件。存储访问已经收敛在中间层里，默认支持 Vercel Blob、本地磁盘和 S3 兼容存储，例如 Cloudflare R2。前端使用 Next.js App Router 构建，适合部署成一个轻量的私有传图入口。

![libran](./public/project/c1.jpg)
![libran](./public/project/c2.jpg)

## 功能

- 密码登录，未授权用户不能访问图片列表和原图下载
- 上传图片到已配置的存储提供方
- 保留原图，不压缩、不转码
- 历史图片列表展示
- 图片大图预览
- 复制链接、下载原图、删除图片
- 适配桌面端和移动端

## 技术栈

- Next.js 16
- React 19
- Tailwind CSS 4
- 存储中间层，支持 Vercel Blob / Local / S3 兼容存储

## 存储配置

存储源的非敏感配置写在根目录的 [`storage-sources.config.ts`](./storage-sources.config.ts)。这里维护 source id、展示名称、provider、上传模式、访问级别、路径前缀、容量、bucket、endpoint 等信息。

当前默认配置包含：

- `cloudflare_1`：Cloudflare R2，S3 兼容存储
- `vercel_blob1`：Vercel Blob
- `vercel_blob2`：Vercel Blob

如果要新增、删除或调整存储源，优先修改 `storageSourceDefinitions`：

```ts
{
  id: "vercel_blob1",
  label: "Vercel Blob 1",
  provider: "vercel-blob",
  uploadMode: "vercel-blob-client",
  access: "private",
  prefix: "uploads/",
  totalCapacity: "1GB",
  tokenEnv: "VERCEL_BLOB1_TOKEN",
}
```

`tokenEnv`、`accessKeyIdEnv`、`secretAccessKeyEnv` 只保存环境变量名，实际密钥仍然只放在 `.env` 或部署平台的环境变量里。

## 环境变量

在项目根目录创建 `.env`，只放登录密码和存储凭证：

```env
TRANSFER_PASSWORD=change-this-password

CF_R2_KEY_ID=your-r2-access-key-id
CF_R2_SECRET_KEY=your-r2-secret-access-key
CF_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

VERCEL_BLOB1_TOKEN=vercel_blob_rw_xxx
VERCEL_BLOB2_TOKEN=vercel_blob_rw_xxx
```

说明：

- `TRANSFER_PASSWORD`：登录页面使用的访问密码
- `CF_R2_KEY_ID`：Cloudflare R2 Access Key ID
- `CF_R2_SECRET_KEY`：Cloudflare R2 Secret Access Key
- `CF_R2_ENDPOINT`：Cloudflare R2 S3 API endpoint
- `VERCEL_BLOB1_TOKEN` / `VERCEL_BLOB2_TOKEN`：对应 Vercel Blob Store 的读写令牌

推荐默认使用 `private`。当前实现里，图片列表和原图访问都要求登录态；应用内部预览图通过带 token 的接口地址加载。

系统右上角会根据 `storageSourceDefinitions` 出现存储源切换菜单。切换后图片列表、上传、预览、下载和删除都会指向当前 source。

## 本地开发

```bash
pnpm install
pnpm dev
```

默认启动后访问 [http://localhost:3000](http://localhost:3000)。

常用命令：

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
```

## 部署

推荐部署到 Vercel：

1. 按需创建 Vercel Blob Store 或 Cloudflare R2 bucket
2. 在 [`storage-sources.config.ts`](./storage-sources.config.ts) 配置非敏感的存储源信息
3. 在部署平台环境变量中配置 `TRANSFER_PASSWORD` 和各存储源需要的 token/access key
4. 部署项目

上传接口目前允许 `image/*` 与 `video/*`，单文件大小上限为 `200MB`。

如果要切到本地磁盘存储，在 `storageSourceDefinitions` 里添加 `provider: "local"`、`uploadMode: "form-data"` 的 source。`local` provider 会把文件写入项目根目录的 `storage/<source-id>` 文件夹。

如果要接 Cloudflare R2，在 `storageSourceDefinitions` 里添加 `provider: "s3"` 的 source，并把 `endpoint` 设置为 R2 的 S3 API 地址；`accessKeyIdEnv` 和 `secretAccessKeyEnv` 指向实际凭证所在的环境变量名。

## 目录结构

```text
app/
  api/
    auth/                # 登录 / 退出接口
    images/              # 图片列表、上传、读取、删除接口
  _components/           # 前端界面组件
  _lib/                  # 鉴权与存储封装
  page.tsx               # 首页入口
public/
  lotties/               # 上传/复制成功动效
```

## 行为说明

- 上传后的文件路径会带时间戳，避免重名冲突
- 历史列表按上传时间倒序显示
- 下载按钮优先打开原图下载地址
- 删除操作会直接删除当前存储源中的对应文件
- 登录态通过 HTTP Only Cookie 保存

## 适用场景

- 手机向电脑快速传原图
- 临时搭一个私有图片中转站
- 个人图库素材收集入口

如果你准备把它扩展成多人共享系统，建议继续补上用户体系、操作审计、过期策略和更细粒度的访问控制。
