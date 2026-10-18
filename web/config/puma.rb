# Puma — web + Action Cable no mesmo processo (módulo rails-lke do platform-infra).
#
# Single mode (sem `workers`): WEB_CONCURRENCY ≤ 1 no pod. O Postgres da frota é
# compartilhado (max_connections 50) e o Solid Queue roda como threads aqui
# dentro; fork de processos multiplicaria as conexões.
#
# Threads: cada conexão WebSocket não ocupa thread do Puma (Action Cable tem
# seu próprio pool de workers), mas requests, canais e jobs dividem o pool do
# Active Record — ver max_connections em config/database.yml.
threads_count = ENV.fetch("RAILS_MAX_THREADS", 3)
threads threads_count, threads_count

port ENV.fetch("PORT", 3000)

plugin :tmp_restart

# Solid Queue dentro do Puma (padrão da frota): o secret K8s grava
# SOLID_QUEUE_IN_PUMA=true. Modo async — dispatcher e workers como threads no
# processo, nunca fork (JOB_THREADS / JOB_POLLING_INTERVAL em config/queue.yml).
plugin :solid_queue if ENV["SOLID_QUEUE_IN_PUMA"]
solid_queue_mode :async if ENV["SOLID_QUEUE_IN_PUMA"]

pidfile ENV["PIDFILE"] if ENV["PIDFILE"]
