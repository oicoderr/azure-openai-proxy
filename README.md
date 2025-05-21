## Azure-Openai-Proxy

## 主要功能
- 代理前端项目 ChatGPT-Next-Web[下载地址](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web)代理 Microsoft Azure OpenAI 服务，无须修改 ChatGPT-Next-Web 代码, 可以在不同的模型在不同的地域下使用
- Docker shell 脚本 一键本地打包, 部署
- 不修改前端项目逻辑将 OpenAI API 转发至 Microsoft Azure API 服务

## 技术栈
- Deno
- Docker
- shell
  
## 前期准备与本地运行
1. 拉取 ChatGPT-Next-Web[下载地址](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web)项目
2. 将 ChatGPT-Next-Web 打包成镜像，如须需要 dalle 模型请[参考](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web/pull/4349)
3. logToFile.ts 为日志逻辑，可自行修改
4. **配置环境变量**: 参考 `.env.example` 文件创建一个 `.env` 文件。以下环境变量是 **必需的**，如果这些变量未在 `.env` 文件中正确设置或作为环境变量提供，应用程序将记录错误日志并无法启动:
   - `APIVERSION`: 您的 Azure OpenAI API 版本 (例如 `2024-02-01`)
   - `KEY1`: 您的 Azure OpenAI API 密钥 (用于 `.env.example` 中指定的第一组模型)
   - `KEY2`: 您的 Azure OpenAI API 密钥 (用于 `.env.example` 中指定的第二组模型，如果与 `KEY1` 不同的话)
5. 启动 Docker
6. 执行 sudo sh build_to_local.sh
7. 执行 docker-compose up
8. 开始愉快的使用

## 部署
- 实践 “前期准备与本地运行” 步骤

## 测试 (Testing)

本项目包含一套单元测试，用于验证代理的核心逻辑、错误处理机制以及对不同模型的支持情况。

要运行测试，请在项目根目录执行以下命令：

```bash
deno test --allow-env --allow-net azure-openai-proxy_test.ts
```

- `--allow-env`: 允许测试代码访问和设置环境变量 (测试中用于模拟配置)。
- `--allow-net`: 允许测试代码进行网络调用 (尽管大部分外部HTTP调用在测试中被mock，但此权限为某些测试场景或Deno的内部机制所需)。

## 欢迎批判，点个 Star 告别 BUG