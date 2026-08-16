#!/usr/bin/env bash
set -euo pipefail

# Claude Context Monitor — 发布脚本
#
# 开发者发布流程：
#   version bump → build → package → release → brew update
#
# 用法：bash scripts/release.sh <version>
# 示例：bash scripts/release.sh 0.2.1

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "用法: bash scripts/release.sh <version>" >&2
  exit 1
fi
VERSION="${VERSION#v}" # 去掉前缀 v

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VSIX="claude-code-context-monitor-${VERSION}.vsix"

echo "==> 1/6 更新 package.json 版本到 ${VERSION}"
node -e "const p=require('./package.json');p.version='${VERSION}';require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2) + '\n')"

echo "==> 2/6 安装依赖并编译"
npm install
npm run compile

echo "==> 3/6 运行测试"
npm test || { echo "测试失败，中止发布" >&2; exit 1; }

echo "==> 4/6 打包 .vsix"
npm run package

echo "==> 5/6 计算 sha256 并更新 Formula"
SHA256="$(shasum -a 256 "${VSIX}" | awk '{print $1}')"
echo "    sha256 = ${SHA256}"
node -e "const fs=require('fs');const v='${VERSION}';const s='${SHA256}';let f=fs.readFileSync('Formula/claude-context-monitor.rb','utf8');f=f.replace(/version \"[^\"]*\"/,'version \"'+v+'\"');f=f.replace(/releases\/download\/v[^\/]*\//g,'releases/download/v'+v+'/');f=f.replace(/-[0-9]+\.[0-9]+\.[0-9]+\.vsix/,'-'+v+'.vsix');f=f.replace(/sha256 \"[^\"]*\"/,'sha256 \"'+s+'\"');fs.writeFileSync('Formula/claude-context-monitor.rb',f)"

echo "==> 6/6 创建 GitHub Release"
if command -v gh >/dev/null 2>&1; then
  gh release create "v${VERSION}" "${VSIX}" \
    --title "v${VERSION}" \
    --notes "Claude Context Monitor v${VERSION}" || echo "!! gh release 失败，请手动创建"
else
  echo "!! 未安装 gh CLI，跳过 GitHub Release，请手动上传 ${VSIX}"
fi

cat <<EOF

发布完成。剩余手动步骤：
1. 提交并推送代码与 tag：
     git add -A && git commit -m "release v${VERSION}"
     git tag "v${VERSION}" && git push && git push --tags
2. 把 Formula/claude-context-monitor.rb 同步到 tap（harries233/homebrew-context）并推送。
3. 用户安装：
     brew tap harries233/homebrew-context
     brew install claude-context-monitor
EOF
