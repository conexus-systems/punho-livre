# frozen_string_literal: true

# Item de GET /api/v1/matches, sempre do ponto de vista de `player`.
module MatchSerializer
  module_function

  def call(match, player)
    side = match.side_of(player)
    other = 1 - side
    opponent = match.player_on(other)

    {
      id: match.id,
      opponent: { display_name: opponent.display_name, rating: opponent.rating },
      my_character: match.character_on(side),
      opponent_character: match.character_on(other),
      result: result_for(match, side),
      rating_delta: match.rating_delta_on(side),
      finished_at: match.finished_at&.utc&.iso8601
    }
  end

  # Partida "disputed" (relatos divergentes) não tem vencedor: vira "draw".
  def result_for(match, side)
    return "abandoned" if match.status == "abandoned"
    return "draw" if match.status == "disputed" || match.winner_side.nil?

    match.winner_side == side ? "win" : "loss"
  end
end
