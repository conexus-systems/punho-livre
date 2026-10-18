# frozen_string_literal: true

module Characters
  # PATCH /api/v1/admin/characters/:slug — aprova ou rejeita.
  #
  # Alvo: a submissão `pending` mais recente do slug; sem pendente, a versão
  # mais recente (permite mudar `premium` de um aprovado ou tirá-lo do ar).
  # `premium` omitido ao aprovar uma versão nova herda o da versão servida.
  class Review
    STATUSES = %w[approved rejected].freeze

    def self.call(...)
      new(...).call
    end

    def initialize(slug:, status:, premium: nil, reason: nil)
      @slug = slug
      @status = status.to_s
      @premium = premium
      @reason = reason
    end

    def call
      raise ArgumentError, "status must be one of #{STATUSES.join(', ')}" unless STATUSES.include?(@status)
      unless @premium.nil? || [ true, false ].include?(@premium)
        raise ArgumentError, "premium must be a boolean"
      end

      character, previous_status = Character.transaction do
        target = Character.pending.where(slug: @slug).order(id: :desc).lock.first ||
                 Character.where(slug: @slug).order(id: :desc).lock.first
        raise ActiveRecord::RecordNotFound, "character #{@slug} not found" unless target

        previous = target.status
        target.update!(attributes_for(target))
        [ target, previous ]
      end

      if previous_status != character.status
        CharacterReviewedNotificationJob.perform_later(character.id, character.status)
      end
      character
    end

    private

    def attributes_for(target)
      attrs = { status: @status, reviewed_at: Time.current }
      attrs[:reject_reason] = @status == "rejected" ? @reason.presence : nil
      attrs[:premium] = premium_for(target)
      attrs
    end

    def premium_for(target)
      return @premium unless @premium.nil?
      return target.premium unless target.pending? && @status == "approved"

      Character.served_for(@slug)&.premium || target.premium
    end
  end
end
