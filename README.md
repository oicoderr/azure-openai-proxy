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
4. 启动 Docker
5. 执行 sudo sh build_to_local.sh
6. 执行 docker-compose up
7. 开始愉快的使用

## 部署
- 实践 “前期准备与本地运行” 步骤

## 欢迎批判，点个 Star 告别 BUG