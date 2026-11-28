#!/usr/bin/env bash
# nazoya for Windows - ビルド（Linux / この開発環境用）
# publish して単一ファイル exe を生成し、成果物パスを表示する。
set -euo pipefail
cd "$(dirname "$0")"

DOTNET="${DOTNET:-$HOME/workspace/tools/dotnet/dotnet}"
# /tmp は小さい tmpfs のため作業領域をワークスペース内に取る
export TMPDIR="${TMPDIR:-$HOME/workspace/.tmp-dotnet}"
mkdir -p "$TMPDIR"
export TAR_OPTIONS=--no-same-owner

# NuGet 復元はプロキシ経由で詰まるため、ローカルに用意した .nupkg 群から行う
"$DOTNET" publish Nazoya.csproj -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true \
  -p:RestoreSources="$HOME/workspace/tools/nuget-local" -o dist

echo "===== 完了 ====="
echo "成果物: $(pwd)/dist/Nazoya.exe"
ls -la dist/Nazoya.exe
