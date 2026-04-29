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

## 环境变量

在项目根目录创建 `.env`：

```env
TRANSFER_PASSWORD=change-this-password
STORAGE_PROVIDER=vercel-blob
NEXT_PUBLIC_STORAGE_UPLOAD_MODE=vercel-blob-client
STORAGE_ACCESS=private
STORAGE_PREFIX=uploads/
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
```

说明：

- `TRANSFER_PASSWORD`：登录页面使用的访问密码
- `STORAGE_PROVIDER`：单源模式的存储提供方，当前内置 `vercel-blob`、`local` 和 `s3`
- `NEXT_PUBLIC_STORAGE_UPLOAD_MODE`：单源模式的上传模式。Vercel Blob 使用 `vercel-blob-client`，S3/Local 使用 `form-data`
- `STORAGE_ACCESS`：可选，支持 `private` 或 `public`，默认是 `private`
- `STORAGE_PREFIX`：可选，存储路径前缀，默认是 `uploads/`
- `BLOB_READ_WRITE_TOKEN`：Vercel Blob 读写令牌

推荐默认使用 `private`。当前实现里，图片列表和原图访问都要求登录态；应用内部预览图通过带 token 的接口地址加载。

## 多存储源

配置 `STORAGE_SOURCES` 后，系统右上角会出现存储源切换菜单。每个 source 都有自己的 provider、前缀、容量和凭证；切换后图片列表、上传、预览、下载和删除都会指向当前 source。

```env
STORAGE_SOURCES=vercel_blob1,cloudflare_1

STORAGE_SOURCE_VERCEL_BLOB1_LABEL=Vercel Blob 1
STORAGE_SOURCE_VERCEL_BLOB1_PROVIDER=vercel-blob
STORAGE_SOURCE_VERCEL_BLOB1_UPLOAD_MODE=vercel-blob-client
STORAGE_SOURCE_VERCEL_BLOB1_ACCESS=private
STORAGE_SOURCE_VERCEL_BLOB1_PREFIX=uploads/
STORAGE_SOURCE_VERCEL_BLOB1_TOTAL_CAPACITY=1GB
STORAGE_SOURCE_VERCEL_BLOB1_BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

STORAGE_SOURCE_CLOUDFLARE_1_LABEL=Cloudflare 1
STORAGE_SOURCE_CLOUDFLARE_1_PROVIDER=s3
STORAGE_SOURCE_CLOUDFLARE_1_UPLOAD_MODE=form-data
STORAGE_SOURCE_CLOUDFLARE_1_ACCESS=private
STORAGE_SOURCE_CLOUDFLARE_1_PREFIX=uploads/
STORAGE_SOURCE_CLOUDFLARE_1_TOTAL_CAPACITY=10GB
STORAGE_SOURCE_CLOUDFLARE_1_S3_BUCKET=your-r2-bucket
STORAGE_SOURCE_CLOUDFLARE_1_S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
STORAGE_SOURCE_CLOUDFLARE_1_S3_REGION=auto
STORAGE_SOURCE_CLOUDFLARE_1_S3_ACCESS_KEY_ID=your-r2-access-key-id
STORAGE_SOURCE_CLOUDFLARE_1_S3_SECRET_ACCESS_KEY=your-r2-secret-access-key
STORAGE_SOURCE_CLOUDFLARE_1_S3_FORCE_PATH_STYLE=true
```

source id 会被转换成大写环境变量片段，例如 `cloudflare_1` 对应 `STORAGE_SOURCE_CLOUDFLARE_1_*`。同一个服务商要配置多个实例时，只需要在 `STORAGE_SOURCES` 里放多个不同 id，并分别填写对应变量。

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

1. 创建一个 Blob Store，并拿到 `BLOB_READ_WRITE_TOKEN`
2. 在项目环境变量中配置 `TRANSFER_PASSWORD`、`STORAGE_PROVIDER=vercel-blob`、`BLOB_READ_WRITE_TOKEN`
3. 如有需要，额外设置 `STORAGE_ACCESS=private`
4. 部署项目

上传接口目前允许 `image/*` 与 `video/*`，单文件大小上限为 `200MB`。

如果要切到本地磁盘存储，可以使用：

```env
STORAGE_PROVIDER=local
NEXT_PUBLIC_STORAGE_UPLOAD_MODE=form-data
```

`local` provider 会把文件写入项目根目录的 `storage` 文件夹。

如果要接 Cloudflare R2，使用 `s3` provider，并把 endpoint 设置为 R2 的 S3 API 地址：

```env
STORAGE_PROVIDER=s3
NEXT_PUBLIC_STORAGE_UPLOAD_MODE=form-data
S3_BUCKET=your-r2-bucket
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=your-r2-access-key-id
S3_SECRET_ACCESS_KEY=your-r2-secret-access-key
S3_FORCE_PATH_STYLE=true
```

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
