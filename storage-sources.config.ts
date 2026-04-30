export const storageSourceDefinitions = [
  {
    // 存储源唯一 ID，用于前端切换、Cookie 记忆和后端路由参数。
    id: "cloudflare_1",
    // 界面上展示的存储源名称。
    label: "Cloudflare 1",
    // 存储提供方。Cloudflare R2 使用 S3 兼容协议，所以这里填 s3。
    provider: "s3",
    // 上传模式。S3 兼容存储使用服务端表单上传。
    uploadMode: "form-data",
    // 文件访问级别。private 会要求通过应用鉴权后访问原文件。
    access: "private",
    // 文件保存路径前缀。
    prefix: "uploads/",
    // 当前存储源容量上限，仅用于界面容量显示。
    totalCapacity: "10GB",
    // S3 兼容存储配置，密钥值不要写在这里。
    s3: {
      // Bucket 名称。
      bucket: "picture",
      // S3 API endpoint 所在的环境变量名，Cloudflare R2 使用账号专属地址。
      endpointEnv: "CF_R2_ENDPOINT",
      // S3 region。Cloudflare R2 通常使用 auto。
      region: "auto",
      // 是否强制 path-style 访问。Cloudflare R2 建议开启。
      forcePathStyle: true,
      // Access Key ID 所在的环境变量名。
      accessKeyIdEnv: "CF_R2_KEY_ID",
      // Secret Access Key 所在的环境变量名。
      secretAccessKeyEnv: "CF_R2_SECRET_KEY",
    },
  },
  {
    // 存储源唯一 ID，用于前端切换、Cookie 记忆和后端路由参数。
    id: "vercel_blob1",
    // 界面上展示的存储源名称。
    label: "Vercel Blob 1",
    // 存储提供方。
    provider: "vercel-blob",
    // 上传模式。Vercel Blob 使用客户端直传。
    uploadMode: "vercel-blob-client",
    // 文件访问级别。private 会要求通过应用鉴权后访问原文件。
    access: "private",
    // 文件保存路径前缀。
    prefix: "uploads/",
    // 当前存储源容量上限，仅用于界面容量显示。
    totalCapacity: "1GB",
    // Vercel Blob 读写令牌所在的环境变量名。
    tokenEnv: "VERCEL_BLOB1_TOKEN",
  },
  {
    // 存储源唯一 ID，用于前端切换、Cookie 记忆和后端路由参数。
    id: "vercel_blob2",
    // 界面上展示的存储源名称。
    label: "Vercel Blob 2",
    // 存储提供方。
    provider: "vercel-blob",
    // 上传模式。Vercel Blob 使用客户端直传。
    uploadMode: "vercel-blob-client",
    // 文件访问级别。private 会要求通过应用鉴权后访问原文件。
    access: "private",
    // 文件保存路径前缀。
    prefix: "uploads/",
    // 当前存储源容量上限，仅用于界面容量显示。
    totalCapacity: "1GB",
    // Vercel Blob 读写令牌所在的环境变量名。
    tokenEnv: "VERCEL_BLOB2_TOKEN",
  },
];
