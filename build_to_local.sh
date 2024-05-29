#!/bin/bash
set -e # 当任何一行命令执行失败时，退出脚本

# 清理Docker资源
cleanup_docker() {
    docker kill $(docker ps -q --filter "name=$app") || echo "没有运行的docker进程需要杀掉 ${app}"
    docker rm $(docker ps -aq --filter "name=$app") || echo "没有docker进程需要删除 ${app}"
    docker rmi -f $(docker images $app -q) || echo "没有docker镜像需要删除 ${app}"
    echo "Docker ${app} 资源清理完成。"
}

# 选择 app 应用
echo "请选择应用类型:"
echo "1) azure-openai-proxy"
read -p "输入选择 (1): " choice

# 选择 app 应用 及 dockerfile
dockerfile="Dockerfile" # 默认使用 Dockerfile
case $choice in
    1)
        app="azure-openai-proxy"
        ;;
    *)
        echo "无效的选择，退出..."
        exit 1
        ;;
esac
echo "你选择了应用: $app"
echo "使用的 Dockerfile: $dockerfile"

# 请求用户输入版本号，并验证格式
while true; do
    read -p "请输入版本号 (如 1.0.0):" ver
    if [[ $ver =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        export ver
        # 确保在用户输入版本号之后设置APP_T
        export APP_T=URL/$app:$ver
        break
    else
        echo "版本号与预期格式（MAJOR. MINOR. PATCH）不匹配，请重试"
    fi
done

# 停止并删除相关docker进程
echo "停止并删除相关docker进程..."
docker kill $(docker ps | grep $app | awk '{print $1}') || echo "No running docker process to kill for ${app}"
docker rm $(docker ps -a | grep $app | awk '{print $1}') || echo "No docker process to delete for ${app}"

# 删除相关docker镜像
docker rmi -f $(docker images | grep $app | awk '{print $3}') || echo "No docker image to delete for ${app}"
echo "Docker ${app} 镜像已删除完成."

# Docker操作
cleanup_docker
echo "正在构建docker镜像..."
docker build -t $app:$ver -f $dockerfile . || { echo "Docker build failed"; exit 1; }
# 确保此时APP_T已正确设置
docker tag $app:$ver $APP_T || { echo "Docker tag failed"; exit 1; }