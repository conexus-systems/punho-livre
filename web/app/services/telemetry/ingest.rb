# frozen_string_literal: true

module Telemetry
  # Valida e grava um lote de telemetria (POST /api/telemetry/batch).
  #
  # Envelope inválido (schema, session_id, app, lista de eventos) ⇒ Invalid (422).
  # Evento inválido (nome desconhecido, chave fora do esquema, tipo errado,
  # texto longo demais, data absurda ou algo com cara de e-mail) ⇒ descartado
  # e contado em `rejected`; os válidos são gravados. Nada do request (IP,
  # user-agent, Authorization) é gravado.
  class Ingest
    MAX_EVENTS = 100
    RETENTION = 90.days
    SESSION_FORMAT = /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/
    EMAIL_FORMAT = /[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/i
    MAX_NUMBER = 1_000_000_000

    class Invalid < StandardError
      attr_reader :details

      def initialize(details)
        @details = details
        super("invalid telemetry batch")
      end
    end

    def self.call(body, now: Time.current) = new(body, now).call

    def initialize(body, now)
      @body = body
      @now = now
    end

    def call
      app = validate_envelope!
      rows = []
      rejected = 0
      @body["events"].each do |event|
        row = event_row(event, app)
        row ? rows << row : rejected += 1
      end
      TelemetryEvent.insert_all(rows) if rows.any?
      { accepted: rows.size, rejected: rejected }
    end

    private

    def validate_envelope!
      errors = []
      errors << "body must be a JSON object" unless @body.is_a?(Hash)
      raise Invalid, errors if errors.any?

      errors << "schema must be #{Schema::VERSION}" unless @body["schema"] == Schema::VERSION
      errors << "session_id must be a random UUID" unless @body["session_id"].to_s.match?(SESSION_FORMAT)
      app = props_for(Schema::APP, @body["app"])
      errors << "app is invalid" unless app && app["version"] && app["platform"]
      events = @body["events"]
      errors << "events must be a list of 1..#{MAX_EVENTS}" unless events.is_a?(Array) && events.size.between?(1, MAX_EVENTS)
      raise Invalid, errors if errors.any?

      app
    end

    def event_row(event, app)
      return unless event.is_a?(Hash)

      spec = Schema::EVENTS[event["name"]]
      return unless spec

      at = occurred_at(event["at"])
      props = props_for(spec, event["props"] || {})
      return unless at && props

      {
        name: event["name"], session_id: @body["session_id"], occurred_at: at, props: props,
        platform: app["platform"], app_version: app["version"], os_version: app["os_version"],
        build: app["build"], screen_aspect: app["screen_aspect"], created_at: @now
      }
    end

    def occurred_at(value)
      at = Time.iso8601(value.to_s)
      at if at.between?(@now - RETENTION, @now + 1.day)
    rescue ArgumentError
      nil
    end

    # Todas as chaves precisam estar no esquema e com o tipo certo; nil se não.
    def props_for(spec, props)
      return unless props.is_a?(Hash)

      props.each_with_object({}) do |(key, value), out|
        rule = spec[key]
        return nil unless rule && valid_value?(rule, value)

        out[key] = value
      end
    end

    def valid_value?(rule, value)
      case rule[:type]
      when :string
        value.is_a?(String) && value.length <= rule[:max] && (rule[:values].nil? || rule[:values].include?(value)) &&
          !value.match?(EMAIL_FORMAT)
      when :integer then value.is_a?(Integer) && value.abs <= MAX_NUMBER
      when :number then value.is_a?(Numeric) && value.to_f.finite? && value.abs <= MAX_NUMBER
      when :boolean then [ true, false ].include?(value)
      else false
      end
    end
  end
end
