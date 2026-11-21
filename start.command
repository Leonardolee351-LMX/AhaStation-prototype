#!/bin/bash
cd "$(dirname "$0")"

# Finder 启动时不会加载终端里的 PATH，这里补上常见安装位置
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.volta/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
fi
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "未检测到 Node.js / npm。请先安装 Node.js（https://nodejs.org），然后重新运行。"
  read -r -p "按 Enter 关闭… "
  exit 1
fi

node "./start.mjs"
status=$?
if [ "$status" -ne 0 ]; then
  read -r -p "启动失败，按 Enter 关闭… "
fi
exit "$status"
