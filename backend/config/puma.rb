# Puma — web + Action Cable no mesmo processo.
#
# Threads: cada conexão WebSocket não ocupa thread do Puma (Action Cable tem
# seu próprio pool de workers), mas jobs/canais usam o pool do Active Record:
# mantenha RAILS_MAX_THREADS alinhado ao max_connections do database.yml.
threads_count = ENV.fetch("RAILS_MAX_THREADS", 5)
threads threads_count, threads_count

port ENV.fetch("PORT", 3000)

plugin :tmp_restart

# Solid Queue dentro do Puma (deploy de um pod só). async mantém dispatcher e
# workers como threads no processo; SOLID_QUEUE_MODE=fork opta por processos.
if ENV["SOLID_QUEUE_IN_PUMA"]
  plugin :solid_queue
  solid_queue_mode ENV.fetch("SOLID_QUEUE_MODE", "async").to_sym
end

pidfile ENV["PIDFILE"] if ENV["PIDFILE"]
