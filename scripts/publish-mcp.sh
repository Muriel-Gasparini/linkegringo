#!/usr/bin/env bash
set -euo pipefail

# Diretório raiz do LinkeGringo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 1. Carrega NPM_TOKEN do .env se não estiver definido no ambiente
if [ -z "${NPM_TOKEN:-}" ]; then
  if [ -f "$ROOT_DIR/.env" ]; then
    NPM_TOKEN=$(grep -v '^#' "$ROOT_DIR/.env" | grep -E '^NPM_TOKEN=' | head -n 1 | cut -d '=' -f2- | tr -d ' "' || true)
  fi
fi

if [ -z "${NPM_TOKEN:-}" ]; then
  echo "❌ Erro: NPM_TOKEN não encontrado no ambiente nem no arquivo .env!"
  echo "💡 Defina NPM_TOKEN=<seu_token> no .env ou execute com NPM_TOKEN=... $0"
  exit 1
fi

echo "🚀 Publicação do pacote @linkegringo/mcp no NPM"
echo "================================================"

cd "$ROOT_DIR/packages/mcp"

# Opcional: bump de versão se fornecido (ex: ./scripts/publish-mcp.sh patch)
if [ -n "${1:-}" ]; then
  echo "🆙 Incrementando versão ($1)..."
  npm version "$1" --no-git-tag-version
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Versão a ser publicada: $CURRENT_VERSION"

# 2. Build do pacote
echo "🔨 1/3 Compilando pacote..."
cd "$ROOT_DIR"
pnpm --filter @linkegringo/mcp build

# 3. Testes unitários
echo "🧪 2/3 Executando testes..."
pnpm --filter @linkegringo/mcp test

# 4. Publicação no NPM Registry com o token de automação
echo "🚀 3/3 Publicando no registro público do NPM..."
cd "$ROOT_DIR/packages/mcp"

NPM_CONFIG_REGISTRY_NPMJS_ORG___AUTHTOKEN="$NPM_TOKEN" npm publish --access public

echo "================================================"
echo "🎉 Versão $CURRENT_VERSION de @linkegringo/mcp publicada com sucesso!"
NPM_CONFIG_REGISTRY_NPMJS_ORG___AUTHTOKEN="$NPM_TOKEN" npm view @linkegringo/mcp dist-tags
