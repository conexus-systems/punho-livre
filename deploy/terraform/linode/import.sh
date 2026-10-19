#!/usr/bin/env bash
# Chamado pelo deploy-lke.yml@v1 (terraform_import_script) dentro de
# deploy/terraform/linode, entre o init e o plan.
#
# O reusable cria o namespace via kubectl ("Ensure namespace") antes do
# Terraform; sem importar, o plan tenta criá-lo de novo e falha com
# "already exists". Idempotente: só importa o que existe no cluster e ainda
# não está no state.
set -euo pipefail

NS="${TF_VAR_kubernetes_namespace:-${NS:-mugen-arena}}"
SLUG="mugen-arena"
ENVIRONMENT="${ENVIRONMENT:-production}"

import_if_missing() {
  local address="$1" kind="$2" name="$3" id="$4"
  if terraform state list 2>/dev/null | grep -qxF "$address"; then
    return 0
  fi
  if [ "$kind" = "namespace" ]; then
    kubectl get namespace "$name" >/dev/null 2>&1 || return 0
  else
    kubectl -n "$NS" get "$kind" "$name" >/dev/null 2>&1 || return 0
  fi
  echo "import ${address} <- ${id}"
  terraform import -input=false -no-color "$address" "$id"
}

import_if_missing 'module.app.kubernetes_namespace_v1.app[0]' namespace "$NS" "$NS"
import_if_missing 'module.app.kubernetes_secret_v1.app[0]' secret "${SLUG}-${ENVIRONMENT}-secrets" "${NS}/${SLUG}-${ENVIRONMENT}-secrets"
import_if_missing 'module.app.kubernetes_deployment_v1.web[0]' deployment "${SLUG}-web" "${NS}/${SLUG}-web"
import_if_missing 'module.app.kubernetes_service_v1.web[0]' service "${SLUG}-web" "${NS}/${SLUG}-web"
import_if_missing 'module.app.kubernetes_ingress_v1.web[0]' ingress "$SLUG" "${NS}/${SLUG}"
