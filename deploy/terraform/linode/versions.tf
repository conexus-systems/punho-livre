terraform {
  required_version = ">= 1.6.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.2"
    }
  }

  # State remoto (Object Storage S3-compatível da Linode). Configuração parcial:
  # o deploy-lke.yml@v1 passa bucket/key/endpoint/credenciais via -backend-config
  # a partir dos secrets TF_STATE_*. Sem backend o state seria efêmero e o
  # próximo apply tentaria recriar tudo.
  backend "s3" {}
}

# O job de deploy grava o kubeconfig em /tmp/kubeconfig (e exporta
# TF_VAR_kubeconfig_path). Nunca rode apply local: só "Deploy — Production".
provider "kubernetes" {
  config_path = var.kubeconfig_path
}
