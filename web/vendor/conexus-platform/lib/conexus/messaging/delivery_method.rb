# frozen_string_literal: true

require_relative "client"
require "digest"

module Conexus
  module Messaging
    # ActionMailer delivery method that routes mail through the CONEXUS API BFF.
    #
    #   config.action_mailer.delivery_method = :conexus_api
    #
    # The mailer views stay in the app; only delivery changes. The already
    # rendered subject/HTML/text go to the BFF, which owns provider choice,
    # fallback, retry and delivery status.
    #
    # Registered automatically by the Railtie, so migrating an app is a flag
    # flip plus CONEXUS_API_WEBHOOK_SECRET — no call site changes.
    #
    # Mailers can pin the event and the idempotency key to a domain fact:
    #
    #   headers["X-Conexus-Event"] = "invoice.created"
    #   headers["X-Conexus-Idempotency-Key"] = "invoice-#{invoice.id}-created"
    class DeliveryMethod
      class FallbackUnavailable < Error; end

      EVENT_HEADER = "X-Conexus-Event"
      IDEMPOTENCY_HEADER = "X-Conexus-Idempotency-Key"
      DEFAULT_EVENT = "email.sent"

      # Headers consumed here; they must not leak to the provider.
      CONEXUS_HEADERS = [EVENT_HEADER, IDEMPOTENCY_HEADER].freeze

      attr_reader :settings

      # settings (all optional, via config.action_mailer.conexus_api_settings):
      #   :client    — a Conexus::Messaging::Client, for tests or custom config
      #   :metadata  — callable receiving the mail, returning a Hash. Use it for
      #                app context such as the current tenant; the gem must not
      #                know about app models.
      #   :logger    — receives warnings when there is nothing to deliver
      #   :fallback  — callable receiving the mail, used when the BFF cannot be
      #                reached. Wired by install_delivery_method! to the app's
      #                previous delivery method, so an unreachable BFF degrades
      #                to the old path instead of losing the mail.
      def initialize(settings = {})
        @settings = settings || {}
      end

      def deliver!(mail)
        recipients = addresses(mail.to)

        if recipients.empty?
          logger&.warn("[Conexus] mail without recipient, nothing dispatched")
          return []
        end

        messages = recipients.map { |recipient| message_for(mail, recipient) }

        # One HTTP call either way: the BFF models one recipient per message,
        # so a mail with several `to` becomes a batch instead of N requests.
        messages.one? ? client.dispatch(**messages.first) : client.dispatch_bulk(messages)
      rescue DispatchError => e
        # Only worth falling back when the BFF is unreachable or broken. A 422
        # means it read the payload and refused it, so the old path would be
        # just as wrong, and a 401 means our secret is bad — both must surface.
        raise unless fallback && e.retryable?

        logger&.warn("[Conexus] API BFF unavailable (#{e.message}), delivering through the previous method")
        fallback.call(mail)
      end

      private

      def fallback
        callable = @settings[:fallback]
        callable if callable.respond_to?(:call)
      end

      def message_for(mail, recipient)
        {
          channel: "email",
          recipient: recipient,
          event: event_for(mail),
          idempotency_key: idempotency_key_for(mail, recipient),
          sender: addresses(mail.from).first,
          reply_to: addresses(mail.reply_to).first,
          subject: mail.subject,
          body: text_part(mail),
          html_body: html_part(mail),
          cc: presence(addresses(mail.cc)),
          bcc: presence(addresses(mail.bcc)),
          metadata: metadata_for(mail)
        }.compact
      end

      def event_for(mail)
        header(mail, EVENT_HEADER) || DEFAULT_EVENT
      end

      # Without an explicit key, dedupe the same content to the same recipient
      # on the same day, so a retried job does not send a second copy.
      def idempotency_key_for(mail, recipient)
        explicit = header(mail, IDEMPOTENCY_HEADER)
        # Same key with several recipients would collide on the BFF's unique
        # index and drop all but the first, so scope it per address.
        return "#{explicit}-#{Digest::SHA256.hexdigest(recipient)[0, 8]}" if explicit

        digest = Digest::SHA256.hexdigest(
          [recipient, mail.subject, html_part(mail) || text_part(mail), today].join("|")
        )
        "#{event_for(mail)}-#{digest[0, 32]}"
      end

      def metadata_for(mail)
        base = { "message_id" => mail.message_id }.compact
        extra = @settings[:metadata]
        base.merge!(stringify(extra.call(mail))) if extra.respond_to?(:call)
        presence(base)
      end

      def client
        @client ||= @settings[:client] || Client.new
      end

      def logger
        @settings[:logger]
      end

      def header(mail, name)
        presence(mail[name]&.to_s)
      end

      def html_part(mail)
        return mail.html_part.decoded if mail.html_part
        return mail.body.decoded if mail.mime_type == "text/html"

        nil
      end

      # Falls back to the raw body when no content type was set: without this a
      # plain `body "..."` mail would dispatch with neither body nor html_body
      # and the BFF would reject it for empty content.
      def text_part(mail)
        return mail.text_part.decoded if mail.text_part
        return nil if mail.multipart? || mail.mime_type == "text/html"

        presence(mail.body&.decoded)
      end

      def addresses(value)
        Array(value).map { |address| address.to_s.strip }.reject(&:empty?)
      end

      def today
        Time.now.utc.strftime("%Y-%m-%d")
      end

      def presence(value)
        return nil if value.nil?

        value.respond_to?(:empty?) && value.empty? ? nil : value
      end

      def stringify(hash)
        Hash(hash).each_with_object({}) { |(key, value), out| out[key.to_s] = value unless value.nil? }
      end
    end
  end
end
